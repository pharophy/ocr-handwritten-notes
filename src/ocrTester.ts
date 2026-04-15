import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);

// Baseline file path
const BASELINE_FILE = 'test-results/baseline.json';

// ============================================================================
// Types
// ============================================================================

export interface TestCase {
  name: string;
  imagePath: string;
  expectedPath: string;
}

export interface TestMetrics {
  characterAccuracy: number;
  wordPrecision: number;
  wordRecall: number;
  wordF1: number;
  editDistance: number;
  totalChars: number;
  correctChars: number;
  totalWords: number;
  correctWords: number;
  italicCount: number;
  italicPercentage: number;
}

export interface TestResult {
  testCase: TestCase;
  actualOutput: string;
  expectedOutput: string;
  metrics: TestMetrics;
  passed: boolean;
  diffLines: DiffLine[];
  modelUsed?: string;
  processingTime?: number;
  timestamp?: string;
}

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber?: number;
}

export interface BaselineResult {
  testName: string;
  modelUsed: string;
  timestamp: string;
  metrics: TestMetrics;
  processingTime: number;
  costEstimate: number;
}

export interface BaselineData {
  version: string;
  baselines: Record<string, BaselineResult>;
}

export interface ComparisonDelta {
  characterAccuracy: number;
  wordF1: number;
  italicPercentage: number;
  processingTime: number;
  costEstimate: number;
}

// ============================================================================
// Test Case Discovery
// ============================================================================

/**
 * Discover test cases in a directory by finding paired .jpeg + expected.txt files
 */
export async function discoverTestCases(directory: string): Promise<TestCase[]> {
  const testCases: TestCase[] = [];

  try {
    const entries = await readdir(directory);

    // Find all .jpeg files
    const imageFiles = entries.filter(f =>
      f.endsWith('.jpeg') || f.endsWith('.jpg')
    );

    for (const imageFile of imageFiles) {
      // Derive expected output file name
      const baseName = imageFile.replace(/\.(jpeg|jpg)$/, '');
      const expectedFileName = `${baseName} expected.txt`;

      // Check if expected output exists
      if (entries.includes(expectedFileName)) {
        testCases.push({
          name: baseName,
          imagePath: path.join(directory, imageFile),
          expectedPath: path.join(directory, expectedFileName),
        });
      }
    }

    return testCases;
  } catch (error: any) {
    throw new Error(`Failed to discover test cases in ${directory}: ${error.message}`);
  }
}

/**
 * Load expected output text from file
 */
export async function loadExpectedOutput(expectedPath: string): Promise<string> {
  try {
    const content = await readFile(expectedPath, 'utf-8');
    return content.trim();
  } catch (error: any) {
    throw new Error(`Failed to load expected output from ${expectedPath}: ${error.message}`);
  }
}

// ============================================================================
// Placeholder functions for upcoming tasks
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed to transform str1 into str2
 */
export function calculateEditDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create 2D array for dynamic programming
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    dp[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        // Characters match, no operation needed
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        // Take minimum of insert, delete, or replace
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return dp[len1][len2];
}

/**
 * Normalize text for comparison (case-insensitive, markdown-agnostic)
 * Strips ALL markdown formatting to compare only words/letters/numbers
 * Per user requirement: "markdown formatting for italic or otherwise should be ignored"
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    // Remove ALL markdown formatting
    .replace(/\*\*(.+?)\*\*/g, '$1')  // Bold: **text** -> text
    .replace(/\*(.+?)\*/g, '$1')      // Italic: *text* -> text
    .replace(/_(.+?)_/g, '$1')        // Italic: _text_ -> text
    .replace(/^(#+)\s+/gm, '')        // Headers: # text -> text
    .replace(/^(\s*)[•*-]\s+/gm, '$1') // Bullets: remove symbols but keep indent
    .replace(/->|→/g, '→');           // Normalize arrows
}

/**
 * Calculate character-level accuracy metrics
 */
export function calculateCharacterAccuracy(actual: string, expected: string): {
  accuracy: number;
  editDistance: number;
  totalChars: number;
  correctChars: number;
} {
  // Normalize to lowercase for case-insensitive comparison
  const normalizedActual = normalizeForComparison(actual);
  const normalizedExpected = normalizeForComparison(expected);

  const editDistance = calculateEditDistance(normalizedActual, normalizedExpected);
  const totalChars = normalizedExpected.length;
  const correctChars = Math.max(0, totalChars - editDistance);
  const accuracy = totalChars > 0 ? (correctChars / totalChars) * 100 : 0;

  return {
    accuracy,
    editDistance,
    totalChars,
    correctChars,
  };
}

/**
 * Calculate word-level precision, recall, and F1 score
 */
export function calculateWordMetrics(actual: string, expected: string): {
  precision: number;
  recall: number;
  f1: number;
  totalWords: number;
  correctWords: number;
} {
  // Normalize and tokenize into words
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(w => w.length > 0);
  };

  const actualWords = normalizeText(actual);
  const expectedWords = normalizeText(expected);

  // Count word matches
  const actualWordSet = new Set(actualWords);
  const expectedWordSet = new Set(expectedWords);

  // True positives: words in both actual and expected
  let truePositives = 0;
  for (const word of actualWordSet) {
    if (expectedWordSet.has(word)) {
      truePositives++;
    }
  }

  // Calculate metrics
  const precision = actualWords.length > 0 ? truePositives / actualWords.length : 0;
  const recall = expectedWords.length > 0 ? truePositives / expectedWords.length : 0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    precision,
    recall,
    f1,
    totalWords: expectedWords.length,
    correctWords: truePositives,
  };
}

/**
 * Generate unified diff showing line-by-line differences
 */
export function generateUnifiedDiff(actual: string, expected: string): DiffLine[] {
  const actualLines = actual.split('\n');
  const expectedLines = expected.split('\n');
  const diffLines: DiffLine[] = [];

  const maxLen = Math.max(actualLines.length, expectedLines.length);

  for (let i = 0; i < maxLen; i++) {
    const actualLine = actualLines[i];
    const expectedLine = expectedLines[i];

    if (actualLine === expectedLine) {
      // Lines match
      if (actualLine !== undefined) {
        diffLines.push({
          type: 'unchanged',
          content: actualLine,
          lineNumber: i + 1,
        });
      }
    } else {
      // Lines differ
      if (expectedLine !== undefined) {
        diffLines.push({
          type: 'removed',
          content: expectedLine,
          lineNumber: i + 1,
        });
      }
      if (actualLine !== undefined) {
        diffLines.push({
          type: 'added',
          content: actualLine,
          lineNumber: i + 1,
        });
      }
    }
  }

  return diffLines;
}

/**
 * Format diff lines for console output
 */
export function formatDiff(diffLines: DiffLine[]): string {
  return diffLines
    .map(line => {
      const prefix = line.type === 'added' ? '+ ' :
                    line.type === 'removed' ? '- ' :
                    '  ';
      return `${prefix}${line.content}`;
    })
    .join('\n');
}

/**
 * Count italic markers in OCR output
 */
export function countItalicMarkers(text: string): {
  count: number;
  percentage: number;
  totalWords: number;
} {
  // Count italic markers (*word* pattern)
  const italicPattern = /\*([^[\]]+?)\*/g;
  const italicMatches = text.match(italicPattern) || [];
  const italicCount = italicMatches.length;

  // Count total words (excluding italic markers)
  const textWithoutItalics = text.replace(italicPattern, '');
  const words = textWithoutItalics.split(/[\s\n\r,;.!?()[\]{}]+/).filter(w => w.length > 0);
  const totalWords = words.length + italicCount;

  const percentage = totalWords > 0 ? (italicCount / totalWords) * 100 : 0;

  return {
    count: italicCount,
    percentage,
    totalWords,
  };
}

/**
 * Run OCR test: process image and compare against expected output
 */
export async function runOCRTest(
  testCase: TestCase,
  ocrFunction: (imagePath: string) => Promise<{ text: string; modelUsed: string; processingTime?: number }>
): Promise<TestResult> {
  const startTime = Date.now();

  // Load expected output
  const expectedOutput = await loadExpectedOutput(testCase.expectedPath);

  // Run OCR on the image
  const ocrResult = await ocrFunction(testCase.imagePath);
  const actualOutput = ocrResult.text;
  const processingTime = ocrResult.processingTime || (Date.now() - startTime);

  // Calculate character-level metrics
  const charMetrics = calculateCharacterAccuracy(actualOutput, expectedOutput);

  // Calculate word-level metrics
  const wordMetrics = calculateWordMetrics(actualOutput, expectedOutput);

  // Count italic markers
  const italicMetrics = countItalicMarkers(actualOutput);

  // Generate diff
  const diffLines = generateUnifiedDiff(actualOutput, expectedOutput);

  // Combine all metrics
  const metrics: TestMetrics = {
    characterAccuracy: charMetrics.accuracy,
    wordPrecision: wordMetrics.precision,
    wordRecall: wordMetrics.recall,
    wordF1: wordMetrics.f1,
    editDistance: charMetrics.editDistance,
    totalChars: charMetrics.totalChars,
    correctChars: charMetrics.correctChars,
    totalWords: wordMetrics.totalWords,
    correctWords: wordMetrics.correctWords,
    italicCount: italicMetrics.count,
    italicPercentage: italicMetrics.percentage,
  };

  // Determine if test passed (using reasonable thresholds)
  const passed = metrics.characterAccuracy >= 80 && metrics.wordF1 >= 0.7;

  return {
    testCase,
    actualOutput,
    expectedOutput,
    metrics,
    passed,
    diffLines,
    modelUsed: ocrResult.modelUsed,
    processingTime,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Baseline Management
// ============================================================================

/**
 * Load baseline data from file
 */
export async function loadBaseline(): Promise<BaselineData | null> {
  try {
    const data = await readFile(BASELINE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist yet
    }
    throw new Error(`Failed to load baseline: ${error.message}`);
  }
}

/**
 * Save baseline data to file
 */
export async function saveBaseline(baseline: BaselineData): Promise<void> {
  try {
    // Ensure directory exists
    const dir = path.dirname(BASELINE_FILE);
    try {
      await mkdir(dir, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }

    await writeFile(BASELINE_FILE, JSON.stringify(baseline, null, 2), 'utf-8');
  } catch (error: any) {
    throw new Error(`Failed to save baseline: ${error.message}`);
  }
}

/**
 * Store test result as baseline
 */
export async function storeBaseline(
  testResult: TestResult,
  costEstimate: number = 0
): Promise<void> {
  const baseline = await loadBaseline() || {
    version: '1.0',
    baselines: {},
  };

  const baselineResult: BaselineResult = {
    testName: testResult.testCase.name,
    modelUsed: testResult.modelUsed || 'unknown',
    timestamp: testResult.timestamp || new Date().toISOString(),
    metrics: testResult.metrics,
    processingTime: testResult.processingTime || 0,
    costEstimate,
  };

  baseline.baselines[testResult.testCase.name] = baselineResult;
  await saveBaseline(baseline);
}

/**
 * Get baseline for a specific test
 */
export async function getBaseline(testName: string): Promise<BaselineResult | null> {
  const baseline = await loadBaseline();
  if (!baseline || !baseline.baselines[testName]) {
    return null;
  }
  return baseline.baselines[testName];
}

/**
 * Compare test result against baseline
 */
export function compareToBaseline(
  testResult: TestResult,
  baseline: BaselineResult,
  currentCostEstimate: number = 0
): ComparisonDelta {
  return {
    characterAccuracy: testResult.metrics.characterAccuracy - baseline.metrics.characterAccuracy,
    wordF1: testResult.metrics.wordF1 - baseline.metrics.wordF1,
    italicPercentage: testResult.metrics.italicPercentage - baseline.metrics.italicPercentage,
    processingTime: (testResult.processingTime || 0) - baseline.processingTime,
    costEstimate: currentCostEstimate - baseline.costEstimate,
  };
}

/**
 * Format comparison delta for display
 */
export function formatComparisonDelta(delta: ComparisonDelta): string {
  const lines: string[] = [];

  const formatChange = (value: number, unit: string, reverse: boolean = false) => {
    const sign = (reverse ? -value : value) >= 0 ? '+' : '';
    const emoji = (reverse ? -value : value) >= 0 ? '✅' : '⚠️';
    return `${sign}${value.toFixed(2)}${unit} ${emoji}`;
  };

  lines.push('Comparison vs Baseline:');
  lines.push(`  Accuracy:  ${formatChange(delta.characterAccuracy, '%')}`);
  lines.push(`  Word F1:   ${formatChange(delta.wordF1, '')}`);
  lines.push(`  Italics:   ${formatChange(delta.italicPercentage, '%', true)}`); // Lower is better
  lines.push(`  Latency:   ${formatChange(delta.processingTime / 1000, 's', true)}`); // Lower is better
  lines.push(`  Cost:      ${formatChange(delta.costEstimate, '$', true)}`); // Lower is better

  return lines.join('\n');
}

/**
 * Update baseline when better configuration is validated
 */
export async function updateBaseline(
  testName: string,
  testResult: TestResult,
  costEstimate: number = 0
): Promise<void> {
  await storeBaseline(testResult, costEstimate);
  console.log(`✓ Updated baseline for test: ${testName}`);
}

// ============================================================================
// Test Reporting
// ============================================================================

/**
 * Format test result for console output
 */
export function formatTestResult(result: TestResult, showDiff: boolean = false): string {
  const lines: string[] = [];
  const status = result.passed ? '✅ PASS' : '❌ FAIL';

  lines.push(`\n${'='.repeat(80)}`);
  lines.push(`Test: ${result.testCase.name} ${status}`);
  lines.push(`${'='.repeat(80)}`);
  lines.push(`Model: ${result.modelUsed || 'unknown'}`);
  lines.push(`Processing Time: ${((result.processingTime || 0) / 1000).toFixed(2)}s`);
  lines.push(`Timestamp: ${result.timestamp || 'N/A'}`);
  lines.push('');

  lines.push('Metrics:');
  lines.push(`  Character Accuracy: ${result.metrics.characterAccuracy.toFixed(2)}%`);
  lines.push(`  Word Precision:     ${(result.metrics.wordPrecision * 100).toFixed(2)}%`);
  lines.push(`  Word Recall:        ${(result.metrics.wordRecall * 100).toFixed(2)}%`);
  lines.push(`  Word F1 Score:      ${result.metrics.wordF1.toFixed(3)}`);
  lines.push(`  Edit Distance:      ${result.metrics.editDistance}`);
  lines.push(`  Correct Chars:      ${result.metrics.correctChars} / ${result.metrics.totalChars}`);
  lines.push(`  Correct Words:      ${result.metrics.correctWords} / ${result.metrics.totalWords}`);
  lines.push(`  Italic Count:       ${result.metrics.italicCount} (${result.metrics.italicPercentage.toFixed(2)}%)`);

  if (showDiff && !result.passed) {
    lines.push('');
    lines.push('Diff (Expected vs Actual):');
    lines.push('-'.repeat(80));
    lines.push(formatDiff(result.diffLines));
    lines.push('-'.repeat(80));
  }

  return lines.join('\n');
}

/**
 * Format batch test results for console output
 */
export function formatBatchResults(results: TestResult[]): string {
  const lines: string[] = [];
  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  lines.push(`\n${'='.repeat(80)}`);
  lines.push(`Test Suite Summary: ${passCount}/${totalCount} passed`);
  lines.push(`${'='.repeat(80)}`);
  lines.push('');

  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    const accuracy = result.metrics.characterAccuracy.toFixed(1);
    const f1 = result.metrics.wordF1.toFixed(3);
    lines.push(`${status} ${result.testCase.name.padEnd(40)} Accuracy: ${accuracy}% | F1: ${f1}`);
  }

  lines.push('');

  // Summary statistics
  const avgAccuracy = results.reduce((sum, r) => sum + r.metrics.characterAccuracy, 0) / totalCount;
  const avgF1 = results.reduce((sum, r) => sum + r.metrics.wordF1, 0) / totalCount;
  const avgTime = results.reduce((sum, r) => sum + (r.processingTime || 0), 0) / totalCount;

  lines.push('Averages:');
  lines.push(`  Character Accuracy: ${avgAccuracy.toFixed(2)}%`);
  lines.push(`  Word F1 Score:      ${avgF1.toFixed(3)}`);
  lines.push(`  Processing Time:    ${(avgTime / 1000).toFixed(2)}s`);

  return lines.join('\n');
}

/**
 * Generate Markdown report for batch test results
 */
export function generateMarkdownReport(results: TestResult[]): string {
  const lines: string[] = [];
  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const timestamp = new Date().toISOString();

  lines.push('# OCR Test Report');
  lines.push('');
  lines.push(`**Generated:** ${timestamp}`);
  lines.push(`**Tests:** ${passCount}/${totalCount} passed`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Test | Status | Accuracy | Word F1 | Italics | Time |');
  lines.push('|------|--------|----------|---------|---------|------|');

  for (const result of results) {
    const status = result.passed ? '✅ Pass' : '❌ Fail';
    const accuracy = result.metrics.characterAccuracy.toFixed(1);
    const f1 = result.metrics.wordF1.toFixed(3);
    const italics = result.metrics.italicPercentage.toFixed(1);
    const time = ((result.processingTime || 0) / 1000).toFixed(2);

    lines.push(`| ${result.testCase.name} | ${status} | ${accuracy}% | ${f1} | ${italics}% | ${time}s |`);
  }

  lines.push('');

  // Average metrics
  const avgAccuracy = results.reduce((sum, r) => sum + r.metrics.characterAccuracy, 0) / totalCount;
  const avgF1 = results.reduce((sum, r) => sum + r.metrics.wordF1, 0) / totalCount;
  const avgItalics = results.reduce((sum, r) => sum + r.metrics.italicPercentage, 0) / totalCount;
  const avgTime = results.reduce((sum, r) => sum + (r.processingTime || 0), 0) / totalCount;

  lines.push('## Aggregate Metrics');
  lines.push('');
  lines.push(`- **Average Accuracy:** ${avgAccuracy.toFixed(2)}%`);
  lines.push(`- **Average Word F1:** ${avgF1.toFixed(3)}`);
  lines.push(`- **Average Italics:** ${avgItalics.toFixed(2)}%`);
  lines.push(`- **Average Time:** ${(avgTime / 1000).toFixed(2)}s`);
  lines.push('');

  // Detailed results for failed tests
  const failedTests = results.filter(r => !r.passed);
  if (failedTests.length > 0) {
    lines.push('## Failed Tests');
    lines.push('');

    for (const result of failedTests) {
      lines.push(`### ${result.testCase.name}`);
      lines.push('');
      lines.push('**Metrics:**');
      lines.push(`- Character Accuracy: ${result.metrics.characterAccuracy.toFixed(2)}%`);
      lines.push(`- Word F1: ${result.metrics.wordF1.toFixed(3)}`);
      lines.push(`- Edit Distance: ${result.metrics.editDistance}`);
      lines.push(`- Italic Count: ${result.metrics.italicCount} (${result.metrics.italicPercentage.toFixed(2)}%)`);
      lines.push('');

      // Show abbreviated diff (first 20 lines)
      const diffPreview = result.diffLines.slice(0, 20);
      lines.push('**Diff Preview:**');
      lines.push('```');
      lines.push(formatDiff(diffPreview));
      if (result.diffLines.length > 20) {
        lines.push(`... (${result.diffLines.length - 20} more lines)`);
      }
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Check if test result meets accuracy thresholds
 */
export function checkAccuracyThresholds(
  result: TestResult,
  minCharAccuracy: number = 80,
  minWordF1: number = 0.7
): {
  passed: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (result.metrics.characterAccuracy < minCharAccuracy) {
    reasons.push(`Character accuracy ${result.metrics.characterAccuracy.toFixed(2)}% below threshold ${minCharAccuracy}%`);
  }

  if (result.metrics.wordF1 < minWordF1) {
    reasons.push(`Word F1 score ${result.metrics.wordF1.toFixed(3)} below threshold ${minWordF1}`);
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

/**
 * Run batch test execution for all test cases in a directory
 */
export async function runBatchTests(
  directory: string,
  ocrFunction: (imagePath: string) => Promise<{ text: string; modelUsed: string; processingTime?: number }>
): Promise<TestResult[]> {
  const testCases = await discoverTestCases(directory);
  const results: TestResult[] = [];

  console.log(`\nDiscovered ${testCases.length} test cases in ${directory}`);
  console.log('');

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`Running test ${i + 1}/${testCases.length}: ${testCase.name}...`);

    try {
      const result = await runOCRTest(testCase, ocrFunction);
      results.push(result);

      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${testCase.name} (${result.metrics.characterAccuracy.toFixed(1)}% accuracy)`);
    } catch (error: any) {
      console.error(`❌ Failed to run test ${testCase.name}: ${error.message}`);
    }
  }

  return results;
}
