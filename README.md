# eslint-plugin-baseline

A PHPStan-like baseline for ESLint. Ignore existing errors and only report new ones.

[![npm version](https://badge.fury.io/js/eslint-plugin-baseline.svg)](https://www.npmjs.com/package/eslint-plugin-baseline)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why?

When adopting ESLint on a legacy codebase, you might have hundreds or thousands of existing errors. Fixing them all at once is often impractical. This plugin lets you:

1. **Capture all existing errors** in a baseline file
2. **Ignore those errors** in subsequent runs
3. **Report only new errors** introduced after the baseline was created

This is the same approach used by [PHPStan](https://phpstan.org/user-guide/baseline) for PHP projects.

## Installation

```bash
npm install --save-dev eslint-plugin-baseline
```

## Quick Start

### 1. Generate the baseline

```bash
npx eslint-baseline --update
```

This creates `.eslintbaseline.json` containing all current errors.

### 2. Run ESLint with the baseline

```bash
npx eslint-baseline
```

Only new errors (not in the baseline) will be reported.

### 3. Commit the baseline

```bash
git add .eslintbaseline.json
git commit -m "chore: add eslint baseline"
```

## CLI Usage

```bash
# Generate or update the baseline
npx eslint-baseline --update

# Lint with baseline (default)
npx eslint-baseline

# Lint specific files/directories
npx eslint-baseline src/

# Split baseline by rule (like PHPStan baseline-per-identifier)
npx eslint-baseline --update --split-by-rule

# Report unmatched baseline entries (errors that no longer exist)
npx eslint-baseline --report-unmatched

# Allow empty baseline
npx eslint-baseline --update --allow-empty

# Pass additional arguments to ESLint
npx eslint-baseline -- --fix

# Verbose output
npx eslint-baseline --verbose
```

### CLI Options

| Option | Short | Description |
|--------|-------|-------------|
| `--update` | `-u` | Generate or update the baseline file |
| `--baseline-file <path>` | `-b` | Baseline file path (default: `.eslintbaseline.json`) |
| `--split-by-rule` | `-s` | Split baseline into multiple files by rule |
| `--allow-empty` | | Allow generating an empty baseline |
| `--report-unmatched` | `-r` | Report baseline entries that no longer match |
| `--verbose` | `-v` | Verbose output with rule statistics |
| `--no-color` | | Disable colored output |
| `--help` | `-h` | Show help |
| `--version` | | Show version |
| `--` | | Pass remaining arguments to ESLint |

## Baseline Format

### Single file (default)

```json
{
  "src/legacy/module.ts": [
    {
      "ruleId": "@typescript-eslint/no-unused-vars",
      "line": 42,
      "column": 5,
      "message": "'foo' is defined but never used."
    }
  ]
}
```

### Split by rule (`--split-by-rule`)

```
.eslintbaseline/
├── _loader.json
├── @typescript-eslint-no-unused-vars.json
├── @stylistic-indent.json
└── no-console.json
```

Each file contains only errors for that specific rule, making it easier to:

- Track progress on specific rules
- Assign different rules to different team members
- See which rules have the most violations

## ESLint Plugin Integration

You can also use the plugin directly in your ESLint configuration:

### Flat config (eslint.config.js)

```javascript
import baseline from 'eslint-plugin-baseline';

export default [
  {
    plugins: { baseline },
    processor: 'baseline/baseline',
  },
  // ... your other configs
];
```

### Legacy config (.eslintrc.js)

```javascript
module.exports = {
  plugins: ['baseline'],
  processor: 'baseline/baseline',
};
```

> **Note**: When using the processor, you'll need to run ESLint with special environment variables to generate the baseline. The CLI is recommended for most use cases.

## Comparison with PHPStan Baseline

| Feature | PHPStan | eslint-plugin-baseline |
|---------|---------|------------------------|
| Generate baseline | `--generate-baseline` | `--update` |
| Baseline file | `phpstan-baseline.neon` | `.eslintbaseline.json` |
| Format | NEON/PHP | JSON |
| Allow empty | `--allow-empty-baseline` | `--allow-empty` |
| Split by identifier | Extension required | `--split-by-rule` |
| Report unmatched | `reportUnmatchedIgnoredErrors` | `--report-unmatched` |
| Matching | Regex + path + count | Hash (rule + line + message) |

## How It Works

1. **Baseline generation**: When you run `--update`, the CLI runs ESLint and captures all errors with their exact location (file, line, column) and message.

2. **Error matching**: Each error is identified by a hash of `ruleId + line + message`. This ensures that:
   - Moving code to a different line creates a "new" error
   - Changing the error message creates a "new" error
   - Adding a new error of the same type on a different line is detected

3. **Filtering**: When linting, errors that match the baseline are filtered out, and only new errors are reported.

## Workflow

### Initial setup

```bash
# Generate baseline with all current errors
npx eslint-baseline --update

# Commit baseline
git add .eslintbaseline.json
git commit -m "chore: add eslint baseline"
```

### Daily development

```bash
# Run lint with baseline (only new errors reported)
npx eslint-baseline
```

### After fixing errors

```bash
# Regenerate baseline to remove fixed errors
npx eslint-baseline --update
git add .eslintbaseline.json
git commit -m "chore: update eslint baseline"
```

### CI/CD

```yaml
# GitHub Actions
- name: Lint
  run: npx eslint-baseline

# GitLab CI
lint:
  script:
    - npx eslint-baseline
```

## API

For programmatic usage:

```javascript
const { Baseline, Reporter, createFormatter } = require('eslint-plugin-baseline');

// Create baseline instance
const baseline = new Baseline({
  cwd: process.cwd(),
  baselineFile: '.eslintbaseline.json',
  splitByRule: false,
});

// Load baseline
baseline.load();

// Check if error is in baseline
const isBaselined = baseline.isInBaseline(filePath, ruleId, line, message);

// Get statistics
const stats = baseline.getStats();

// Get unmatched entries
const unmatched = baseline.getUnmatched();
```

## License

MIT
