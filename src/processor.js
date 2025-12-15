/**
 * ESLint Processor for baseline filtering
 *
 * This processor filters out errors that are in the baseline,
 * allowing only new errors to be reported.
 */

const path = require('path');
const { Baseline } = require('./core/baseline');

let baselineInstance = null;

/**
 * Get or create baseline instance
 * @param {Object} options
 * @returns {Baseline}
 */
function getBaseline(options = {}) {
    if (!baselineInstance) {
        baselineInstance = new Baseline({
            cwd: options.cwd || process.cwd(),
            baselineFile: process.env.ESLINT_BASELINE_FILE || '.eslintbaseline.json',
            splitByRule: process.env.ESLINT_BASELINE_SPLIT === 'true',
        });
        baselineInstance.load();
    }
    return baselineInstance;
}

/**
 * Reset the baseline instance (for testing)
 */
function resetBaseline() {
    if (baselineInstance) {
        baselineInstance.reset();
    }
    baselineInstance = null;
}

/**
 * Baseline processor
 */
const baselineProcessor = {
    meta: {
        name: 'baseline',
        version: '1.0.0',
    },

    /**
     * Preprocess - pass through unchanged
     * @param {string} text - Source code
     * @param {string} filename - File path
     * @returns {Array}
     */
    preprocess(text, filename) {
        // Ensure baseline is loaded
        getBaseline();
        return [text];
    },

    /**
     * Postprocess - filter messages through baseline
     * @param {Array} messages - Array of message arrays
     * @param {string} filename - File path
     * @returns {Array}
     */
    postprocess(messages, filename) {
        const baseline = getBaseline();

        // If no baseline data, return all messages
        if (!baseline.data || Object.keys(baseline.data).length === 0) {
            return messages.flat();
        }

        const allMessages = messages.flat();
        const filteredMessages = [];

        for (const msg of allMessages) {
            // Keep parsing errors
            if (!msg.ruleId) {
                filteredMessages.push(msg);
                continue;
            }

            // Check if in baseline
            if (!baseline.isInBaseline(filename, msg.ruleId, msg.line, msg.message)) {
                filteredMessages.push(msg);
            }
        }

        return filteredMessages;
    },

    supportsAutofix: true,
};

module.exports = {
    baselineProcessor,
    getBaseline,
    resetBaseline,
};
