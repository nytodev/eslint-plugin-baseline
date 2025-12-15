/**
 * Baseline file management
 *
 * Handles reading, writing, and managing the baseline file.
 * Supports both single file and split-by-rule formats.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_BASELINE_FILE = '.eslintbaseline.json';

/**
 * Baseline class for managing ESLint error baselines
 */
class Baseline {
    /**
     * @param {Object} options
     * @param {string} [options.baselineFile] - Path to baseline file
     * @param {string} [options.cwd] - Working directory
     * @param {boolean} [options.splitByRule] - Split baseline by rule identifier
     */
    constructor(options = {}) {
        this.cwd = options.cwd || process.cwd();
        this.baselineFile = options.baselineFile || DEFAULT_BASELINE_FILE;
        this.splitByRule = options.splitByRule || false;
        this.data = null;
        this.index = null;
        this.loaded = false;
    }

    /**
     * Get the full path to the baseline file
     * @returns {string}
     */
    getBaselinePath() {
        if (path.isAbsolute(this.baselineFile)) {
            return this.baselineFile;
        }
        return path.join(this.cwd, this.baselineFile);
    }

    /**
     * Get the directory for split baseline files
     * @returns {string}
     */
    getSplitBaselineDir() {
        const baselinePath = this.getBaselinePath();
        return baselinePath.replace(/\.json$/, '');
    }

    /**
     * Load baseline from file
     * @returns {Object} Baseline data
     */
    load() {
        if (this.loaded) {
            return this.data;
        }

        if (this.splitByRule) {
            this.data = this._loadSplitBaseline();
        } else {
            this.data = this._loadSingleBaseline();
        }

        this._buildIndex();
        this.loaded = true;

        return this.data;
    }

    /**
     * Load single baseline file
     * @private
     * @returns {Object}
     */
    _loadSingleBaseline() {
        const baselinePath = this.getBaselinePath();

        if (!fs.existsSync(baselinePath)) {
            return {};
        }

        try {
            const content = fs.readFileSync(baselinePath, 'utf8');
            const data = JSON.parse(content);
            return this._validateBaselineData(data);
        } catch (error) {
            console.error(`[eslint-baseline] Error loading baseline: ${error.message}`);
            return {};
        }
    }

    /**
     * Validate baseline data structure
     * @private
     * @param {*} data - Parsed JSON data
     * @returns {Object} Validated baseline data
     */
    _validateBaselineData(data) {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            console.error('[eslint-baseline] Invalid baseline format: expected object');
            return {};
        }

        const validated = {};

        for (const [filePath, errors] of Object.entries(data)) {
            if (!Array.isArray(errors)) {
                console.error(`[eslint-baseline] Invalid errors for ${filePath}: expected array`);
                continue;
            }

            const validErrors = errors.filter((error) => {
                if (typeof error !== 'object' || error === null) {
                    return false;
                }
                if (typeof error.ruleId !== 'string' || typeof error.line !== 'number') {
                    return false;
                }
                return true;
            });

            if (validErrors.length > 0) {
                validated[filePath] = validErrors;
            }
        }

        return validated;
    }

    /**
     * Load split baseline (multiple files by rule)
     * @private
     * @returns {Object}
     */
    _loadSplitBaseline() {
        const baselineDir = this.getSplitBaselineDir();

        if (!fs.existsSync(baselineDir)) {
            return {};
        }

        const merged = {};

        try {
            const files = fs.readdirSync(baselineDir).filter((f) => f.endsWith('.json') && f !== '_loader.json');

            for (const file of files) {
                const fullPath = path.join(baselineDir, file);
                let content;

                try {
                    content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                } catch (parseError) {
                    console.error(`[eslint-baseline] Error parsing ${file}: ${parseError.message}`);
                    continue;
                }

                const validated = this._validateBaselineData(content);

                // Merge into main object
                for (const [sourceFile, errors] of Object.entries(validated)) {
                    if (!merged[sourceFile]) {
                        merged[sourceFile] = [];
                    }
                    merged[sourceFile].push(...errors);
                }
            }
        } catch (error) {
            console.error(`[eslint-baseline] Error loading split baseline: ${error.message}`);
        }

        return merged;
    }

    /**
     * Build index for fast lookups
     * @private
     */
    _buildIndex() {
        this.index = new Map();

        for (const [file, errors] of Object.entries(this.data)) {
            const hashes = new Map();

            for (const error of errors) {
                const hash = this._generateHash(error.ruleId, error.line, error.message);
                hashes.set(hash, (hashes.get(hash) || 0) + 1);
            }

            this.index.set(file, hashes);
        }
    }

    /**
     * Generate hash for an error
     * @private
     * @param {string} ruleId
     * @param {number} line
     * @param {string} message
     * @returns {string}
     */
    _generateHash(ruleId, line, message) {
        return crypto
            .createHash('md5')
            .update(`${ruleId}:${line}:${message}`)
            .digest('hex')
            .substring(0, 12);
    }

    /**
     * Check if an error is in the baseline and consume it
     * @param {string} filePath - Relative file path
     * @param {string} ruleId - ESLint rule ID
     * @param {number} line - Line number
     * @param {string} message - Error message
     * @returns {boolean} True if error was in baseline
     */
    isInBaseline(filePath, ruleId, line, message) {
        if (!this.loaded) {
            this.load();
        }

        const relativePath = path.relative(this.cwd, filePath);
        const fileHashes = this.index.get(relativePath);

        if (!fileHashes) {
            return false;
        }

        const hash = this._generateHash(ruleId, line, message);
        const count = fileHashes.get(hash);

        if (count && count > 0) {
            if (count === 1) {
                fileHashes.delete(hash);
            } else {
                fileHashes.set(hash, count - 1);
            }
            return true;
        }

        return false;
    }

    /**
     * Save baseline to file
     * @param {Object} data - Baseline data
     * @param {Object} [options]
     * @param {boolean} [options.allowEmpty] - Allow empty baseline
     */
    save(data, options = {}) {
        const allowEmpty = options.allowEmpty || false;

        // Check if empty
        const isEmpty = Object.keys(data).length === 0;
        if (isEmpty && !allowEmpty) {
            console.log('[eslint-baseline] No errors to baseline. Use --allow-empty to create empty baseline.');
            return false;
        }

        if (this.splitByRule) {
            this._saveSplitBaseline(data);
        } else {
            this._saveSingleBaseline(data);
        }

        return true;
    }

    /**
     * Save single baseline file
     * @private
     * @param {Object} data
     */
    _saveSingleBaseline(data) {
        const baselinePath = this.getBaselinePath();
        const sorted = this._sortBaseline(data);

        fs.writeFileSync(baselinePath, JSON.stringify(sorted, null, 2));
    }

    /**
     * Save split baseline (multiple files by rule)
     * @private
     * @param {Object} data
     */
    _saveSplitBaseline(data) {
        const baselineDir = this.getSplitBaselineDir();

        // Create directory if not exists
        if (!fs.existsSync(baselineDir)) {
            fs.mkdirSync(baselineDir, { recursive: true });
        }

        // Group by rule
        const byRule = {};

        for (const [filePath, errors] of Object.entries(data)) {
            for (const error of errors) {
                const ruleId = error.ruleId.replace(/\//g, '-'); // Safe filename
                if (!byRule[ruleId]) {
                    byRule[ruleId] = {};
                }
                if (!byRule[ruleId][filePath]) {
                    byRule[ruleId][filePath] = [];
                }
                byRule[ruleId][filePath].push(error);
            }
        }

        // Clear existing files
        if (fs.existsSync(baselineDir)) {
            const existingFiles = fs.readdirSync(baselineDir).filter((f) => f.endsWith('.json'));
            for (const file of existingFiles) {
                fs.unlinkSync(path.join(baselineDir, file));
            }
        }

        // Write individual files
        const ruleFiles = [];
        for (const [ruleId, ruleData] of Object.entries(byRule)) {
            const fileName = `${ruleId}.json`;
            const filePath = path.join(baselineDir, fileName);
            const sorted = this._sortBaseline(ruleData);

            fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2));
            ruleFiles.push(fileName);
        }

        // Write loader file
        const loaderPath = path.join(baselineDir, '_loader.json');
        fs.writeFileSync(loaderPath, JSON.stringify({
            description: 'ESLint baseline split by rule identifier',
            files: ruleFiles.sort(),
        }, null, 2));
    }

    /**
     * Sort baseline for consistent output
     * @private
     * @param {Object} data
     * @returns {Object}
     */
    _sortBaseline(data) {
        const sorted = {};
        const sortedKeys = Object.keys(data).sort();

        for (const key of sortedKeys) {
            sorted[key] = data[key].sort((a, b) => {
                if (a.line !== b.line) {
                    return a.line - b.line;
                }
                return a.ruleId.localeCompare(b.ruleId);
            });
        }

        return sorted;
    }

    /**
     * Get statistics about the baseline
     * @returns {Object}
     */
    getStats() {
        if (!this.loaded) {
            this.load();
        }

        let totalErrors = 0;
        const fileCount = Object.keys(this.data).length;
        const ruleStats = {};

        for (const errors of Object.values(this.data)) {
            for (const error of errors) {
                totalErrors++;
                ruleStats[error.ruleId] = (ruleStats[error.ruleId] || 0) + 1;
            }
        }

        return {
            totalErrors,
            fileCount,
            ruleStats,
        };
    }

    /**
     * Get unmatched baseline entries (errors that no longer exist)
     * @returns {Array}
     */
    getUnmatched() {
        const unmatched = [];

        for (const [file, hashes] of this.index.entries()) {
            for (const [hash, count] of hashes.entries()) {
                if (count > 0) {
                    // Find the original error info
                    const fileErrors = this.data[file] || [];
                    for (const error of fileErrors) {
                        const errorHash = this._generateHash(error.ruleId, error.line, error.message);
                        if (errorHash === hash) {
                            unmatched.push({
                                file,
                                ...error,
                                unmatchedCount: count,
                            });
                            break;
                        }
                    }
                }
            }
        }

        return unmatched;
    }

    /**
     * Reset the baseline state
     */
    reset() {
        this.data = null;
        this.index = null;
        this.loaded = false;
    }

    /**
     * Prune baseline - remove entries that no longer exist in current errors
     * @param {Object} currentErrors - Current ESLint errors by file
     * @returns {Object} Pruned baseline data and stats
     */
    prune(currentErrors) {
        if (!this.loaded) {
            this.load();
        }

        const pruned = {};
        let removedCount = 0;
        let keptCount = 0;

        // Build index of current errors
        const currentIndex = new Map();
        for (const [file, errors] of Object.entries(currentErrors)) {
            const hashes = new Set();
            for (const error of errors) {
                const hash = this._generateHash(error.ruleId, error.line, error.message);
                hashes.add(hash);
            }
            currentIndex.set(file, hashes);
        }

        // Filter baseline to only keep errors that still exist
        for (const [file, errors] of Object.entries(this.data)) {
            const currentHashes = currentIndex.get(file);

            if (!currentHashes) {
                // File no longer has errors, remove all
                removedCount += errors.length;
                continue;
            }

            const keptErrors = [];
            for (const error of errors) {
                const hash = this._generateHash(error.ruleId, error.line, error.message);
                if (currentHashes.has(hash)) {
                    keptErrors.push(error);
                    keptCount++;
                } else {
                    removedCount++;
                }
            }

            if (keptErrors.length > 0) {
                pruned[file] = keptErrors;
            }
        }

        return {
            data: pruned,
            removedCount,
            keptCount,
        };
    }

    /**
     * Filter errors by specific rules
     * @param {Object} errors - Errors by file
     * @param {string[]} rules - Rule IDs to include
     * @returns {Object} Filtered errors
     */
    filterByRules(errors, rules) {
        const ruleSet = new Set(rules);
        const filtered = {};

        for (const [file, fileErrors] of Object.entries(errors)) {
            const matchingErrors = fileErrors.filter((e) => ruleSet.has(e.ruleId));
            if (matchingErrors.length > 0) {
                filtered[file] = matchingErrors;
            }
        }

        return filtered;
    }

    /**
     * Get detailed statistics about the baseline
     * @returns {Object}
     */
    getDetailedStats() {
        if (!this.loaded) {
            this.load();
        }

        let totalErrors = 0;
        const fileCount = Object.keys(this.data).length;
        const ruleStats = {};
        const fileStats = {};
        const severityStats = { error: 0, warning: 0 };

        for (const [file, errors] of Object.entries(this.data)) {
            fileStats[file] = {
                count: errors.length,
                rules: {},
            };

            for (const error of errors) {
                totalErrors++;
                ruleStats[error.ruleId] = (ruleStats[error.ruleId] || 0) + 1;
                fileStats[file].rules[error.ruleId] = (fileStats[file].rules[error.ruleId] || 0) + 1;

                if (error.severity === 1) {
                    severityStats.warning++;
                } else {
                    severityStats.error++;
                }
            }
        }

        // Sort rules by count
        const sortedRules = Object.entries(ruleStats)
            .sort((a, b) => b[1] - a[1])
            .map(([rule, count]) => ({ rule, count }));

        // Sort files by error count
        const sortedFiles = Object.entries(fileStats)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([file, stats]) => ({ file, ...stats }));

        return {
            totalErrors,
            fileCount,
            ruleCount: Object.keys(ruleStats).length,
            ruleStats: sortedRules,
            fileStats: sortedFiles,
            severityStats,
        };
    }

    /**
     * Check if baseline exists
     * @returns {boolean}
     */
    exists() {
        if (this.splitByRule) {
            return fs.existsSync(this.getSplitBaselineDir());
        }
        return fs.existsSync(this.getBaselinePath());
    }

    /**
     * Delete baseline file(s)
     */
    delete() {
        if (this.splitByRule) {
            const dir = this.getSplitBaselineDir();
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true });
            }
        } else {
            const file = this.getBaselinePath();
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        }
    }
}

module.exports = {
    Baseline,
    DEFAULT_BASELINE_FILE,
};
