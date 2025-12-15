/**
 * ESLint Plugin Baseline
 *
 * A PHPStan-like baseline for ESLint.
 * Ignore existing errors and only report new ones.
 *
 * @example
 * // eslint.config.js
 * import baseline from 'eslint-plugin-baseline';
 *
 * export default [
 *   {
 *     plugins: { baseline },
 *     processor: 'baseline/baseline',
 *   },
 * ];
 */

const { baselineProcessor, getBaseline, resetBaseline } = require('./processor');
const { Baseline, DEFAULT_BASELINE_FILE } = require('./core/baseline');
const { Reporter } = require('./core/reporter');
const { createFormatter } = require('./formatter');

/**
 * ESLint Plugin export
 */
const plugin = {
    meta: {
        name: 'eslint-plugin-baseline',
        version: require('../package.json').version,
    },

    /**
     * Processors
     */
    processors: {
        baseline: baselineProcessor,
    },

    /**
     * Configs
     */
    configs: {
        /**
         * Recommended config - enables baseline processor
         */
        recommended: {
            plugins: ['baseline'],
            processor: 'baseline/baseline',
        },
    },

    /**
     * Rules (none - we use processor)
     */
    rules: {},
};

// Export for CommonJS
module.exports = plugin;

// Named exports for utilities
module.exports.Baseline = Baseline;
module.exports.Reporter = Reporter;
module.exports.createFormatter = createFormatter;
module.exports.DEFAULT_BASELINE_FILE = DEFAULT_BASELINE_FILE;
module.exports.getBaseline = getBaseline;
module.exports.resetBaseline = resetBaseline;
