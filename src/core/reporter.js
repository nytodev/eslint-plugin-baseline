/**
 * Reporter for ESLint baseline results
 *
 * Handles formatting and display of lint results with baseline filtering.
 */

const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
    magenta: '\x1b[35m',
};

/**
 * Reporter class for baseline results
 */
class Reporter {
    /**
     * @param {Object} options
     * @param {boolean} [options.color] - Enable color output
     * @param {boolean} [options.verbose] - Verbose output
     * @param {boolean} [options.reportUnmatched] - Report unmatched baseline entries
     */
    constructor(options = {}) {
        this.color = options.color !== false;
        this.verbose = options.verbose || false;
        this.reportUnmatched = options.reportUnmatched || false;
    }

    /**
     * Get color code or empty string if colors disabled
     * @private
     * @param {string} colorName
     * @returns {string}
     */
    _c(colorName) {
        return this.color ? COLORS[colorName] : '';
    }

    /**
     * Format update mode output (baseline generation)
     * @param {Object} stats - Baseline statistics
     * @returns {string}
     */
    formatUpdate(stats) {
        let output = '';

        output += `${this._c('green')}${this._c('bold')}Baseline updated!${this._c('reset')}\n`;
        output += `${this._c('cyan')}${stats.totalErrors}${this._c('reset')} errors in `;
        output += `${this._c('cyan')}${stats.fileCount}${this._c('reset')} files\n`;

        if (this.verbose && Object.keys(stats.ruleStats).length > 0) {
            output += `\n${this._c('bold')}Errors by rule:${this._c('reset')}\n`;

            const sortedRules = Object.entries(stats.ruleStats)
                .sort((a, b) => b[1] - a[1]);

            for (const [ruleId, count] of sortedRules) {
                output += `  ${this._c('dim')}${ruleId}${this._c('reset')}: ${count}\n`;
            }
        }

        return output;
    }

    /**
     * Format check mode output (lint with baseline)
     * @param {Object} results
     * @param {Array} results.newErrors - New errors (not in baseline)
     * @param {number} results.baselinedCount - Count of baselined errors
     * @param {Array} [results.unmatched] - Unmatched baseline entries
     * @returns {string}
     */
    formatCheck(results) {
        let output = '';

        const { newErrors, baselinedCount, unmatched, showUnmatchedDetails } = results;

        // Count new errors and warnings by rule
        let totalNewErrors = 0;
        let totalNewWarnings = 0;
        const newErrorsByRule = {};

        for (const file of newErrors) {
            for (const msg of file.messages) {
                if (msg.severity === 2) {
                    totalNewErrors++;
                } else {
                    totalNewWarnings++;
                }
                if (msg.ruleId) {
                    newErrorsByRule[msg.ruleId] = (newErrorsByRule[msg.ruleId] || 0) + 1;
                }
            }
        }

        // Display new errors
        if (newErrors.length > 0) {
            output += `${this._c('bold')}New errors (not in baseline):${this._c('reset')}\n\n`;

            for (const file of newErrors) {
                output += `${this._c('cyan')}${file.relativePath}${this._c('reset')}\n`;

                for (const msg of file.messages) {
                    const severity = msg.severity === 2
                        ? `${this._c('red')}error${this._c('reset')}`
                        : `${this._c('yellow')}warning${this._c('reset')}`;

                    output += `  ${this._c('dim')}${msg.line}:${msg.column}${this._c('reset')}  `;
                    output += `${severity}  ${msg.message}  `;
                    output += `${this._c('dim')}${msg.ruleId || ''}${this._c('reset')}\n`;
                }

                output += '\n';
            }

            // Show breakdown by rule in verbose mode
            if (this.verbose && Object.keys(newErrorsByRule).length > 0) {
                output += `${this._c('bold')}New errors by rule:${this._c('reset')}\n`;
                const sortedRules = Object.entries(newErrorsByRule)
                    .sort((a, b) => b[1] - a[1]);

                for (const [ruleId, count] of sortedRules) {
                    output += `  ${this._c('dim')}${ruleId}${this._c('reset')}: ${count}\n`;
                }
                output += '\n';
            }
        }

        // Report unmatched baseline entries (details only with --report-unmatched)
        if (showUnmatchedDetails && unmatched && unmatched.length > 0) {
            output += `${this._c('magenta')}${this._c('bold')}Unmatched baseline entries:${this._c('reset')}\n`;
            output += `${this._c('dim')}These errors no longer exist in the codebase.${this._c('reset')}\n\n`;

            // Group by file
            const byFile = {};
            for (const entry of unmatched) {
                if (!byFile[entry.file]) {
                    byFile[entry.file] = [];
                }
                byFile[entry.file].push(entry);
            }

            for (const [file, entries] of Object.entries(byFile)) {
                output += `${this._c('cyan')}${file}${this._c('reset')}\n`;
                for (const entry of entries) {
                    output += `  ${this._c('dim')}${entry.line}:${entry.column}${this._c('reset')}  `;
                    output += `${this._c('magenta')}unmatched${this._c('reset')}  `;
                    output += `${entry.message}  `;
                    output += `${this._c('dim')}${entry.ruleId}${this._c('reset')}\n`;
                }
                output += '\n';
            }
        }

        // Summary
        output += `${this._c('bold')}Summary:${this._c('reset')}\n`;

        if (baselinedCount > 0) {
            output += `  ${this._c('dim')}${baselinedCount} errors ignored (baseline)${this._c('reset')}\n`;
        }

        if (unmatched && unmatched.length > 0) {
            output += `  ${this._c('magenta')}${unmatched.length} baseline errors fixed${this._c('reset')}\n`;
        }

        if (totalNewErrors > 0 || totalNewWarnings > 0) {
            output += `  ${this._c('red')}${totalNewErrors} new errors${this._c('reset')}`;
            if (totalNewWarnings > 0) {
                output += `, ${this._c('yellow')}${totalNewWarnings} new warnings${this._c('reset')}`;
            }
            output += '\n';
        } else {
            output += `  ${this._c('green')}No new errors!${this._c('reset')}\n`;
        }

        // Suggestion to update baseline if errors were fixed
        if (unmatched && unmatched.length > 0) {
            output += `\n${this._c('cyan')}Tip:${this._c('reset')} ${unmatched.length} baseline errors have been fixed.\n`;
            output += `     Run ${this._c('bold')}npx eslint-baseline --update${this._c('reset')} to update the baseline.\n`;
        }

        return output;
    }

    /**
     * Format empty baseline message
     * @returns {string}
     */
    formatEmptyBaseline() {
        return `${this._c('yellow')}No baseline found. Run with --update to generate one.${this._c('reset')}\n`;
    }

    /**
     * Format error message
     * @param {string} message
     * @returns {string}
     */
    formatError(message) {
        return `${this._c('red')}${this._c('bold')}Error:${this._c('reset')} ${message}\n`;
    }

    /**
     * Get exit code based on results
     * @param {Object} results
     * @param {Array} results.newErrors
     * @param {Array} [results.unmatched]
     * @param {Object} [options]
     * @param {boolean} [options.reportUnmatchedAsError]
     * @returns {number}
     */
    getExitCode(results, options = {}) {
        const { newErrors, unmatched } = results;
        const { reportUnmatchedAsError } = options;

        // Count actual errors (not warnings)
        let hasErrors = false;
        for (const file of newErrors) {
            for (const msg of file.messages) {
                if (msg.severity === 2) {
                    hasErrors = true;
                    break;
                }
            }
            if (hasErrors) break;
        }

        if (hasErrors) {
            return 1;
        }

        if (reportUnmatchedAsError && unmatched && unmatched.length > 0) {
            return 1;
        }

        return 0;
    }
}

module.exports = {
    Reporter,
    COLORS,
};
