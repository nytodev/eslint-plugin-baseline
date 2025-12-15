/**
 * ESLint Formatter for baseline
 *
 * This formatter is used internally by the CLI.
 * It receives options via the context object, not environment variables.
 */

const path = require('path');
const { Baseline } = require('./core/baseline');
const { Reporter } = require('./core/reporter');

/**
 * Create a formatter with options
 * @param {Object} options
 * @param {boolean} [options.update] - Update/generate baseline
 * @param {string} [options.baselineFile] - Baseline file path
 * @param {boolean} [options.splitByRule] - Split by rule identifier
 * @param {boolean} [options.allowEmpty] - Allow empty baseline
 * @param {boolean} [options.reportUnmatched] - Report unmatched entries
 * @param {boolean} [options.color] - Enable colors
 * @param {boolean} [options.verbose] - Verbose output
 * @returns {Function} Formatter function
 */
function createFormatter(options = {}) {
    const {
        update = false,
        baselineFile = '.eslintbaseline.json',
        splitByRule = false,
        allowEmpty = false,
        reportUnmatched = false,
        color = true,
        verbose = false,
        errorsToBaseline = null, // Pre-filtered errors for --suppress-rule
    } = options;

    /**
     * Formatter function
     * @param {Array} results - ESLint results
     * @param {Object} context - ESLint context
     * @returns {string}
     */
    return function formatter(results, context) {
        const cwd = context?.cwd || process.cwd();

        const baseline = new Baseline({
            cwd,
            baselineFile,
            splitByRule,
        });

        const reporter = new Reporter({
            color,
            verbose,
            reportUnmatched,
        });

        if (update) {
            return handleUpdateMode(results, baseline, reporter, cwd, allowEmpty, errorsToBaseline);
        }

        return handleCheckMode(results, baseline, reporter, cwd, reportUnmatched);
    };
}

/**
 * Handle update mode (generate baseline)
 */
function handleUpdateMode(results, baseline, reporter, cwd, allowEmpty, errorsToBaseline = null) {
    let newBaseline;

    // Use pre-filtered errors if provided (from --suppress-rule)
    if (errorsToBaseline) {
        newBaseline = errorsToBaseline;
    } else {
        newBaseline = {};

        for (const result of results) {
            if (result.messages.length === 0) {
                continue;
            }

            const relativePath = path.relative(cwd, result.filePath);

            for (const msg of result.messages) {
                if (!msg.ruleId) {
                    continue;
                }

                if (!newBaseline[relativePath]) {
                    newBaseline[relativePath] = [];
                }

                newBaseline[relativePath].push({
                    ruleId: msg.ruleId,
                    line: msg.line,
                    column: msg.column,
                    message: msg.message,
                });
            }
        }
    }

    const saved = baseline.save(newBaseline, { allowEmpty });

    if (!saved) {
        return {
            output: reporter.formatError('Failed to save baseline (empty baseline not allowed)'),
            exitCode: 1,
        };
    }

    let totalErrors = 0;
    const ruleStats = {};

    for (const errors of Object.values(newBaseline)) {
        for (const error of errors) {
            totalErrors++;
            ruleStats[error.ruleId] = (ruleStats[error.ruleId] || 0) + 1;
        }
    }

    return {
        output: reporter.formatUpdate({
            totalErrors,
            fileCount: Object.keys(newBaseline).length,
            ruleStats,
        }),
        exitCode: 0,
    };
}

/**
 * Handle check mode (lint with baseline)
 */
function handleCheckMode(results, baseline, reporter, cwd, reportUnmatched) {
    baseline.load();

    const newErrors = [];
    let baselinedCount = 0;

    for (const result of results) {
        if (result.messages.length === 0) {
            continue;
        }

        const relativePath = path.relative(cwd, result.filePath);
        const fileNewErrors = [];

        for (const msg of result.messages) {
            if (!msg.ruleId) {
                fileNewErrors.push(msg);
                continue;
            }

            if (baseline.isInBaseline(result.filePath, msg.ruleId, msg.line, msg.message)) {
                baselinedCount++;
            } else {
                fileNewErrors.push(msg);
            }
        }

        if (fileNewErrors.length > 0) {
            newErrors.push({
                filePath: result.filePath,
                relativePath,
                messages: fileNewErrors,
            });
        }
    }

    // Always get unmatched entries to detect fixed errors
    const unmatched = baseline.getUnmatched();

    const checkResults = {
        newErrors,
        baselinedCount,
        unmatched,
        showUnmatchedDetails: reportUnmatched,
    };

    return {
        output: reporter.formatCheck(checkResults),
        exitCode: reporter.getExitCode(checkResults),
    };
}

module.exports = {
    createFormatter,
    handleUpdateMode,
    handleCheckMode,
};
