/**
 * ESLint Plugin Baseline - Type Definitions
 */

import { Linter, ESLint } from 'eslint';

export interface BaselineError {
    ruleId: string;
    line: number;
    column: number;
    message: string;
}

export interface BaselineData {
    [filePath: string]: BaselineError[];
}

export interface BaselineOptions {
    /** Working directory */
    cwd?: string;
    /** Path to baseline file (default: '.eslintbaseline.json') */
    baselineFile?: string;
    /** Split baseline into multiple files by rule */
    splitByRule?: boolean;
}

export interface BaselineStats {
    /** Total number of baselined errors */
    totalErrors: number;
    /** Number of files with baselined errors */
    fileCount: number;
    /** Error count by rule ID */
    ruleStats: { [ruleId: string]: number };
}

export interface UnmatchedEntry extends BaselineError {
    /** File path */
    file: string;
    /** Number of unmatched occurrences */
    unmatchedCount: number;
}

export declare class Baseline {
    /** Working directory */
    cwd: string;
    /** Baseline file path */
    baselineFile: string;
    /** Whether to split by rule */
    splitByRule: boolean;
    /** Loaded baseline data */
    data: BaselineData | null;
    /** Whether baseline has been loaded */
    loaded: boolean;

    constructor(options?: BaselineOptions);

    /** Get full path to baseline file */
    getBaselinePath(): string;

    /** Get directory for split baseline files */
    getSplitBaselineDir(): string;

    /** Load baseline from file */
    load(): BaselineData;

    /**
     * Check if an error is in the baseline
     * @returns true if error was in baseline (and consumes it)
     */
    isInBaseline(filePath: string, ruleId: string, line: number, message: string): boolean;

    /**
     * Save baseline to file
     * @returns true if saved successfully
     */
    save(data: BaselineData, options?: { allowEmpty?: boolean }): boolean;

    /** Get statistics about the baseline */
    getStats(): BaselineStats;

    /** Get unmatched baseline entries (fixed errors) */
    getUnmatched(): UnmatchedEntry[];

    /** Reset baseline state */
    reset(): void;
}

export interface ReporterOptions {
    /** Enable colored output */
    color?: boolean;
    /** Enable verbose output */
    verbose?: boolean;
    /** Report unmatched baseline entries */
    reportUnmatched?: boolean;
}

export interface CheckResults {
    newErrors: Array<{
        filePath: string;
        relativePath: string;
        messages: Linter.LintMessage[];
    }>;
    baselinedCount: number;
    unmatched?: UnmatchedEntry[];
    showUnmatchedDetails?: boolean;
}

export declare class Reporter {
    color: boolean;
    verbose: boolean;
    reportUnmatched: boolean;

    constructor(options?: ReporterOptions);

    /** Format update mode output */
    formatUpdate(stats: BaselineStats): string;

    /** Format check mode output */
    formatCheck(results: CheckResults): string;

    /** Format empty baseline message */
    formatEmptyBaseline(): string;

    /** Format error message */
    formatError(message: string): string;

    /** Get exit code based on results */
    getExitCode(results: CheckResults, options?: { reportUnmatchedAsError?: boolean }): number;
}

export interface FormatterOptions {
    /** Update/generate baseline mode */
    update?: boolean;
    /** Baseline file path */
    baselineFile?: string;
    /** Split by rule identifier */
    splitByRule?: boolean;
    /** Allow empty baseline */
    allowEmpty?: boolean;
    /** Report unmatched entries */
    reportUnmatched?: boolean;
    /** Enable colored output */
    color?: boolean;
    /** Enable verbose output */
    verbose?: boolean;
}

export interface FormatterResult {
    output: string;
    exitCode: number;
}

export type FormatterFunction = (
    results: ESLint.LintResult[],
    context?: { cwd?: string }
) => FormatterResult;

/** Create a formatter with options */
export declare function createFormatter(options?: FormatterOptions): FormatterFunction;

/** Default baseline file name */
export declare const DEFAULT_BASELINE_FILE: string;

/** Get or create baseline instance (for processor) */
export declare function getBaseline(options?: { cwd?: string }): Baseline;

/** Reset baseline instance (for testing) */
export declare function resetBaseline(): void;

/** ESLint Plugin */
declare const plugin: {
    meta: {
        name: string;
        version: string;
    };
    processors: {
        baseline: Linter.Processor;
    };
    configs: {
        recommended: {
            plugins: string[];
            processor: string;
        };
    };
    rules: {};
};

export default plugin;
