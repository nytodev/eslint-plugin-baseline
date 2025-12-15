/**
 * Tests for eslint-plugin-baseline
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { Baseline } = require('../src/core/baseline');
const { Reporter } = require('../src/core/reporter');
const { createFormatter } = require('../src/formatter');

describe('Baseline', () => {
    test('should create empty baseline', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        baseline.load();
        assert.deepStrictEqual(baseline.data, {});

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });

    test('should save and load baseline', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        const data = {
            'src/file.ts': [
                {
                    ruleId: 'no-unused-vars',
                    line: 10,
                    column: 5,
                    message: 'Variable is not used',
                },
            ],
        };

        baseline.save(data, { allowEmpty: true });

        // Create new instance to load
        const baseline2 = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        baseline2.load();
        assert.deepStrictEqual(baseline2.data, data);

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });

    test('should match errors in baseline', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        const data = {
            'src/file.ts': [
                {
                    ruleId: 'no-unused-vars',
                    line: 10,
                    column: 5,
                    message: 'Variable is not used',
                },
            ],
        };

        baseline.save(data, { allowEmpty: true });
        baseline.reset();
        baseline.load();

        // Should match
        const filePath = path.join(tmpDir, 'src/file.ts');
        const isMatch = baseline.isInBaseline(filePath, 'no-unused-vars', 10, 'Variable is not used');
        assert.strictEqual(isMatch, true);

        // Should not match (different line)
        baseline.reset();
        baseline.load();
        const isNotMatch = baseline.isInBaseline(filePath, 'no-unused-vars', 11, 'Variable is not used');
        assert.strictEqual(isNotMatch, false);

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });

    test('should get unmatched entries', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        const data = {
            'src/file.ts': [
                {
                    ruleId: 'no-unused-vars',
                    line: 10,
                    column: 5,
                    message: 'Variable is not used',
                },
                {
                    ruleId: 'no-console',
                    line: 20,
                    column: 1,
                    message: 'Unexpected console statement',
                },
            ],
        };

        baseline.save(data, { allowEmpty: true });
        baseline.reset();
        baseline.load();

        // Consume one error
        const filePath = path.join(tmpDir, 'src/file.ts');
        baseline.isInBaseline(filePath, 'no-unused-vars', 10, 'Variable is not used');

        // Get unmatched
        const unmatched = baseline.getUnmatched();
        assert.strictEqual(unmatched.length, 1);
        assert.strictEqual(unmatched[0].ruleId, 'no-console');

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });
});

describe('Reporter', () => {
    test('should format update output', () => {
        const reporter = new Reporter({ color: false });

        const stats = {
            totalErrors: 10,
            fileCount: 3,
            ruleStats: {
                'no-unused-vars': 5,
                'no-console': 5,
            },
        };

        const output = reporter.formatUpdate(stats);
        assert.ok(output.includes('Baseline updated'));
        assert.ok(output.includes('10'));
        assert.ok(output.includes('3'));
    });

    test('should format check output', () => {
        const reporter = new Reporter({ color: false });

        const results = {
            newErrors: [
                {
                    filePath: '/path/to/file.ts',
                    relativePath: 'file.ts',
                    messages: [
                        { severity: 2, line: 10, column: 5, message: 'Error', ruleId: 'test' },
                    ],
                },
            ],
            baselinedCount: 5,
            unmatched: [],
        };

        const output = reporter.formatCheck(results);
        assert.ok(output.includes('New errors'));
        assert.ok(output.includes('5 errors ignored'));
    });

    test('should return correct exit code', () => {
        const reporter = new Reporter();

        // No errors
        assert.strictEqual(reporter.getExitCode({ newErrors: [], unmatched: [] }), 0);

        // With errors
        const withErrors = {
            newErrors: [{
                messages: [{ severity: 2 }],
            }],
            unmatched: [],
        };
        assert.strictEqual(reporter.getExitCode(withErrors), 1);

        // Only warnings
        const onlyWarnings = {
            newErrors: [{
                messages: [{ severity: 1 }],
            }],
            unmatched: [],
        };
        assert.strictEqual(reporter.getExitCode(onlyWarnings), 0);
    });
});

describe('Formatter', () => {
    test('should create formatter', () => {
        const formatter = createFormatter({
            update: false,
            baselineFile: '.eslintbaseline.json',
        });

        assert.strictEqual(typeof formatter, 'function');
    });
});

describe('Split Baseline', () => {
    test('should save and load split baseline', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
            splitByRule: true,
        });

        const data = {
            'src/file.ts': [
                {
                    ruleId: 'no-unused-vars',
                    line: 10,
                    column: 5,
                    message: 'Variable is not used',
                },
                {
                    ruleId: 'no-console',
                    line: 20,
                    column: 1,
                    message: 'Unexpected console',
                },
            ],
            'src/other.ts': [
                {
                    ruleId: 'no-unused-vars',
                    line: 5,
                    column: 1,
                    message: 'Variable x is not used',
                },
            ],
        };

        baseline.save(data, { allowEmpty: true });

        // Verify directory structure
        const baselineDir = path.join(tmpDir, '.eslintbaseline');
        assert.ok(fs.existsSync(baselineDir), 'Baseline directory should exist');

        const files = fs.readdirSync(baselineDir);
        assert.ok(files.includes('no-unused-vars.json'), 'Should have no-unused-vars.json');
        assert.ok(files.includes('no-console.json'), 'Should have no-console.json');
        assert.ok(files.includes('_loader.json'), 'Should have _loader.json');

        // Load and verify
        const baseline2 = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
            splitByRule: true,
        });

        baseline2.load();

        // Should have all errors merged
        assert.strictEqual(baseline2.data['src/file.ts'].length, 2);
        assert.strictEqual(baseline2.data['src/other.ts'].length, 1);

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });

    test('should handle namespaced rules in split baseline', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
            splitByRule: true,
        });

        const data = {
            'src/file.ts': [
                {
                    ruleId: '@typescript-eslint/no-unused-vars',
                    line: 10,
                    column: 5,
                    message: 'Variable is not used',
                },
            ],
        };

        baseline.save(data, { allowEmpty: true });

        // Verify filename uses dashes instead of slashes
        const baselineDir = path.join(tmpDir, '.eslintbaseline');
        const files = fs.readdirSync(baselineDir);
        assert.ok(
            files.includes('@typescript-eslint-no-unused-vars.json'),
            'Should escape slashes in rule name'
        );

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });
});

describe('Baseline Validation', () => {
    test('should handle invalid baseline format', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baselinePath = path.join(tmpDir, '.eslintbaseline.json');

        // Write invalid baseline (array instead of object)
        fs.writeFileSync(baselinePath, '[]');

        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        baseline.load();
        assert.deepStrictEqual(baseline.data, {});

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });

    test('should handle malformed JSON', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baselinePath = path.join(tmpDir, '.eslintbaseline.json');

        // Write malformed JSON
        fs.writeFileSync(baselinePath, '{ invalid json }');

        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        baseline.load();
        assert.deepStrictEqual(baseline.data, {});

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });

    test('should filter invalid error entries', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baselinePath = path.join(tmpDir, '.eslintbaseline.json');

        // Write baseline with some invalid entries
        const data = {
            'src/file.ts': [
                { ruleId: 'valid-rule', line: 10, message: 'Valid error' },
                { ruleId: 123, line: 10, message: 'Invalid ruleId type' },
                { ruleId: 'valid-rule', line: 'ten', message: 'Invalid line type' },
                null,
                'string instead of object',
            ],
        };
        fs.writeFileSync(baselinePath, JSON.stringify(data));

        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        baseline.load();

        // Should only have the valid entry
        assert.strictEqual(baseline.data['src/file.ts'].length, 1);
        assert.strictEqual(baseline.data['src/file.ts'][0].ruleId, 'valid-rule');

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });

    test('should handle non-array errors value', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baselinePath = path.join(tmpDir, '.eslintbaseline.json');

        // Write baseline with non-array errors
        const data = {
            'src/file.ts': 'not an array',
            'src/valid.ts': [
                { ruleId: 'test', line: 1, message: 'test' },
            ],
        };
        fs.writeFileSync(baselinePath, JSON.stringify(data));

        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        baseline.load();

        // Should only have the valid file entry
        assert.ok(!baseline.data['src/file.ts']);
        assert.strictEqual(baseline.data['src/valid.ts'].length, 1);

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });
});

describe('Baseline Statistics', () => {
    test('should calculate correct statistics', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        const data = {
            'src/file1.ts': [
                { ruleId: 'no-unused-vars', line: 10, column: 5, message: 'Error 1' },
                { ruleId: 'no-unused-vars', line: 20, column: 5, message: 'Error 2' },
                { ruleId: 'no-console', line: 30, column: 1, message: 'Error 3' },
            ],
            'src/file2.ts': [
                { ruleId: 'no-console', line: 5, column: 1, message: 'Error 4' },
            ],
        };

        baseline.save(data, { allowEmpty: true });
        baseline.reset();
        baseline.load();

        const stats = baseline.getStats();

        assert.strictEqual(stats.totalErrors, 4);
        assert.strictEqual(stats.fileCount, 2);
        assert.strictEqual(stats.ruleStats['no-unused-vars'], 2);
        assert.strictEqual(stats.ruleStats['no-console'], 2);

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });

    test('should calculate detailed statistics', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        const data = {
            'src/file1.ts': [
                { ruleId: 'no-unused-vars', line: 10, column: 5, message: 'Error 1' },
                { ruleId: 'no-console', line: 30, column: 1, message: 'Error 2' },
            ],
            'src/file2.ts': [
                { ruleId: 'no-console', line: 5, column: 1, message: 'Error 3' },
            ],
        };

        baseline.save(data, { allowEmpty: true });
        baseline.reset();
        baseline.load();

        const stats = baseline.getDetailedStats();

        assert.strictEqual(stats.totalErrors, 3);
        assert.strictEqual(stats.fileCount, 2);
        assert.strictEqual(stats.ruleCount, 2);
        assert.ok(Array.isArray(stats.ruleStats));
        assert.ok(Array.isArray(stats.fileStats));

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });
});

describe('Baseline Prune', () => {
    test('should prune fixed errors', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        // Original baseline with 3 errors
        const originalData = {
            'src/file.ts': [
                { ruleId: 'no-unused-vars', line: 10, column: 5, message: 'Error 1' },
                { ruleId: 'no-console', line: 20, column: 1, message: 'Error 2' },
                { ruleId: 'no-debugger', line: 30, column: 1, message: 'Error 3' },
            ],
        };

        baseline.save(originalData, { allowEmpty: true });
        baseline.reset();
        baseline.load();

        // Current errors (one fixed)
        const currentErrors = {
            'src/file.ts': [
                { ruleId: 'no-unused-vars', line: 10, column: 5, message: 'Error 1' },
                { ruleId: 'no-console', line: 20, column: 1, message: 'Error 2' },
                // no-debugger was fixed
            ],
        };

        const result = baseline.prune(currentErrors);

        assert.strictEqual(result.removedCount, 1);
        assert.strictEqual(result.keptCount, 2);
        assert.strictEqual(result.data['src/file.ts'].length, 2);

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });

    test('should remove entire file when all errors fixed', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        const originalData = {
            'src/file1.ts': [
                { ruleId: 'no-console', line: 10, column: 1, message: 'Error 1' },
            ],
            'src/file2.ts': [
                { ruleId: 'no-console', line: 20, column: 1, message: 'Error 2' },
            ],
        };

        baseline.save(originalData, { allowEmpty: true });
        baseline.reset();
        baseline.load();

        // Only file2 has errors now
        const currentErrors = {
            'src/file2.ts': [
                { ruleId: 'no-console', line: 20, column: 1, message: 'Error 2' },
            ],
        };

        const result = baseline.prune(currentErrors);

        assert.strictEqual(result.removedCount, 1);
        assert.strictEqual(result.keptCount, 1);
        assert.ok(!result.data['src/file1.ts']);
        assert.ok(result.data['src/file2.ts']);

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });
});

describe('Baseline Filter by Rules', () => {
    test('should filter errors by specific rules', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        const errors = {
            'src/file.ts': [
                { ruleId: 'no-unused-vars', line: 10, message: 'Error 1' },
                { ruleId: 'no-console', line: 20, message: 'Error 2' },
                { ruleId: 'no-debugger', line: 30, message: 'Error 3' },
            ],
        };

        const filtered = baseline.filterByRules(errors, ['no-console']);

        assert.strictEqual(filtered['src/file.ts'].length, 1);
        assert.strictEqual(filtered['src/file.ts'][0].ruleId, 'no-console');

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });

    test('should filter multiple rules', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        const errors = {
            'src/file.ts': [
                { ruleId: 'no-unused-vars', line: 10, message: 'Error 1' },
                { ruleId: 'no-console', line: 20, message: 'Error 2' },
                { ruleId: 'no-debugger', line: 30, message: 'Error 3' },
            ],
        };

        const filtered = baseline.filterByRules(errors, ['no-console', 'no-debugger']);

        assert.strictEqual(filtered['src/file.ts'].length, 2);

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });
});

describe('Baseline Existence', () => {
    test('should detect baseline existence', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-baseline-'));
        const baseline = new Baseline({
            cwd: tmpDir,
            baselineFile: '.eslintbaseline.json',
        });

        assert.strictEqual(baseline.exists(), false);

        baseline.save({ 'file.ts': [{ ruleId: 'test', line: 1, message: 'test' }] });

        assert.strictEqual(baseline.exists(), true);

        baseline.delete();

        assert.strictEqual(baseline.exists(), false);

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
    });
});
