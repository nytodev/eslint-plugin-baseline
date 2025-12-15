#!/usr/bin/env node

/**
 * ESLint Baseline CLI
 *
 * Usage:
 *   npx eslint-baseline [options] [files...]
 *
 * Examples:
 *   npx eslint-baseline                    # Lint with baseline
 *   npx eslint-baseline --update           # Generate/update baseline
 *   npx eslint-baseline --update src/      # Generate baseline for src/
 *   npx eslint-baseline --split-by-rule    # Split baseline by rule
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Baseline } = require('../src/core/baseline');
const { Reporter } = require('../src/core/reporter');
const { createFormatter } = require('../src/formatter');

// Parse arguments
const args = process.argv.slice(2);

const options = {
    update: false,
    baselineFile: '.eslintbaseline.json',
    splitByRule: false,
    allowEmpty: false,
    reportUnmatched: false,
    verbose: false,
    color: process.stdout.isTTY !== false,
    help: false,
    version: false,
    eslintArgs: [],
    files: [],
};

// Parse CLI arguments
let i = 0;
while (i < args.length) {
    const arg = args[i];

    switch (arg) {
        case '--update':
        case '-u':
            options.update = true;
            break;

        case '--baseline-file':
        case '-b':
            options.baselineFile = args[++i];
            break;

        case '--split-by-rule':
        case '-s':
            options.splitByRule = true;
            break;

        case '--allow-empty':
            options.allowEmpty = true;
            break;

        case '--report-unmatched':
        case '-r':
            options.reportUnmatched = true;
            break;

        case '--verbose':
        case '-v':
            options.verbose = true;
            break;

        case '--no-color':
            options.color = false;
            break;

        case '--help':
        case '-h':
            options.help = true;
            break;

        case '--version':
            options.version = true;
            break;

        case '--':
            // Everything after -- is passed to ESLint
            options.eslintArgs = args.slice(i + 1);
            i = args.length;
            break;

        default:
            if (arg.startsWith('-')) {
                // Unknown option, pass to ESLint
                options.eslintArgs.push(arg);
            } else {
                // File/directory
                options.files.push(arg);
            }
    }

    i++;
}

// Show help
if (options.help) {
    console.log(`
ESLint Baseline - Ignore existing errors, report only new ones

Usage:
  npx eslint-baseline [options] [files...]

Options:
  -u, --update           Generate or update the baseline file
  -b, --baseline-file    Baseline file path (default: .eslintbaseline.json)
  -s, --split-by-rule    Split baseline into multiple files by rule
  --allow-empty          Allow generating an empty baseline
  -r, --report-unmatched Report baseline entries that no longer match
  -v, --verbose          Verbose output
  --no-color             Disable colored output
  -h, --help             Show this help message
  --version              Show version
  --                     Pass remaining arguments to ESLint

Examples:
  npx eslint-baseline                          # Lint with baseline
  npx eslint-baseline --update                 # Generate baseline
  npx eslint-baseline --update src/            # Generate for src/ only
  npx eslint-baseline --split-by-rule          # Use split baseline
  npx eslint-baseline -- --fix                 # Pass --fix to ESLint

Environment:
  Reads ESLint configuration from eslint.config.js or .eslintrc.*
`);
    process.exit(0);
}

// Show version
if (options.version) {
    const pkg = require('../package.json');
    console.log(`eslint-baseline v${pkg.version}`);
    process.exit(0);
}

// Run ESLint and process results
async function run() {
    const cwd = process.cwd();

    // Determine files to lint
    const files = options.files.length > 0 ? options.files : ['.'];

    // Build ESLint arguments
    const eslintArgs = [
        '--format', 'json',
        ...options.eslintArgs,
        ...files,
    ];

    // Run ESLint
    const eslintResult = await runEslint(eslintArgs);

    if (eslintResult.error) {
        console.error(eslintResult.error);
        process.exit(2);
    }

    // Parse ESLint JSON output
    let results;
    try {
        results = JSON.parse(eslintResult.stdout);
    } catch (e) {
        // ESLint might have output errors/warnings to stdout
        if (eslintResult.stdout) {
            console.log(eslintResult.stdout);
        }
        if (eslintResult.stderr) {
            console.error(eslintResult.stderr);
        }
        process.exit(eslintResult.exitCode || 1);
    }

    // Create formatter with options
    const formatter = createFormatter({
        update: options.update,
        baselineFile: options.baselineFile,
        splitByRule: options.splitByRule,
        allowEmpty: options.allowEmpty,
        reportUnmatched: options.reportUnmatched,
        color: options.color,
        verbose: options.verbose,
    });

    // Format results
    const { output, exitCode } = formatter(results, { cwd });

    console.log(output);
    process.exit(exitCode);
}

/**
 * Run ESLint as a subprocess
 * @param {Array} args - ESLint arguments
 * @returns {Promise<Object>}
 */
function runEslint(args) {
    return new Promise((resolve) => {
        // Find ESLint binary
        const eslintPath = findEslint();

        if (!eslintPath) {
            resolve({
                error: 'ESLint not found. Install it with: npm install eslint',
                exitCode: 2,
            });
            return;
        }

        let stdout = '';
        let stderr = '';

        const child = spawn(process.execPath, [eslintPath, ...args], {
            cwd: process.cwd(),
            stdio: ['inherit', 'pipe', 'pipe'],
        });

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('error', (err) => {
            resolve({
                error: `Failed to run ESLint: ${err.message}`,
                exitCode: 2,
            });
        });

        child.on('close', (code) => {
            resolve({
                stdout,
                stderr,
                exitCode: code,
            });
        });
    });
}

/**
 * Find ESLint binary
 * @returns {string|null}
 */
function findEslint() {
    const cwd = process.cwd();

    // Potential ESLint locations in order of preference
    const searchPaths = [
        // Local project installation
        path.join(cwd, 'node_modules', 'eslint', 'bin', 'eslint.js'),
        // Local .bin (symlinked)
        path.join(cwd, 'node_modules', '.bin', 'eslint'),
        // Plugin's own node_modules (when installed as dependency)
        path.join(__dirname, '..', 'node_modules', 'eslint', 'bin', 'eslint.js'),
        // pnpm style
        path.join(cwd, 'node_modules', '.pnpm', 'eslint@*', 'node_modules', 'eslint', 'bin', 'eslint.js'),
    ];

    for (const searchPath of searchPaths) {
        // Handle glob patterns for pnpm
        if (searchPath.includes('*')) {
            const dir = path.dirname(path.dirname(searchPath));
            if (fs.existsSync(dir)) {
                try {
                    const entries = fs.readdirSync(path.dirname(dir));
                    for (const entry of entries) {
                        if (entry.startsWith('eslint@')) {
                            const fullPath = path.join(path.dirname(dir), entry, 'node_modules', 'eslint', 'bin', 'eslint.js');
                            if (fs.existsSync(fullPath)) {
                                return fullPath;
                            }
                        }
                    }
                } catch {
                    // Ignore errors
                }
            }
        } else if (fs.existsSync(searchPath)) {
            return searchPath;
        }
    }

    return null;
}

// Run
run().catch((err) => {
    console.error('Error:', err.message);
    process.exit(2);
});
