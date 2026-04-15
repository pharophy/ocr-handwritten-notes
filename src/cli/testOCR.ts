#!/usr/bin/env node

import path from 'path';
import {
  discoverTestCases,
  runOCRTest,
  formatTestResult,
  getBaseline,
  compareToBaseline,
  formatComparisonDelta,
  checkAccuracyThresholds,
  type TestCase,
} from '../ocrTester';
import { processHandwrittenImage } from '../ocr';
import fs from 'fs/promises';

/**
 * CLI for running a single OCR test case
 * Usage: npm run test-ocr <image-path> [--show-diff] [--format=console|json]
 */

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: npm run test-ocr <image-path> [options]

Options:
  --show-diff       Show detailed line-by-line diff for failed tests
  --format=FORMAT   Output format: console (default), json, markdown
  --min-accuracy=N  Minimum character accuracy threshold (default: 80)
  --min-f1=N        Minimum word F1 threshold (default: 0.7)
  --compare-baseline Compare against baseline if available
  --help            Show this help message

Examples:
  npm run test-ocr "test-images/Dynatrace Q2 04-09.jpeg"
  npm run test-ocr "test-images/Dynatrace Q2 04-09.jpeg" -- --show-diff
  npm run test-ocr "test-images/Dynatrace Q2 04-09.jpeg" -- --format=json
`);
    process.exit(0);
  }

  // Parse arguments
  const imagePath = args.find(arg => !arg.startsWith('--')) || '';
  const showDiff = args.includes('--show-diff');
  const formatArg = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'console';
  const minAccuracy = parseFloat(args.find(arg => arg.startsWith('--min-accuracy='))?.split('=')[1] || '80');
  const minF1 = parseFloat(args.find(arg => arg.startsWith('--min-f1='))?.split('=')[1] || '0.7');
  const compareBaseline = args.includes('--compare-baseline');

  if (!imagePath) {
    console.error('Error: Image path is required');
    process.exit(1);
  }

  // Resolve image path
  const resolvedImagePath = path.resolve(imagePath);

  // Derive expected output path
  const baseName = path.basename(imagePath).replace(/\.(jpeg|jpg)$/, '');
  const directory = path.dirname(resolvedImagePath);
  const expectedPath = path.join(directory, `${baseName} expected.txt`);

  // Create test case
  const testCase: TestCase = {
    name: baseName,
    imagePath: resolvedImagePath,
    expectedPath,
  };

  console.log(`Running OCR test: ${baseName}`);
  console.log(`Image: ${resolvedImagePath}`);
  console.log(`Expected: ${expectedPath}`);

  try {
    // Run OCR test
    const result = await runOCRTest(testCase, async (imagePath: string) => {
      const startTime = Date.now();
      const imageBuffer = await fs.readFile(imagePath);
      const ocrResult = await processHandwrittenImage(imageBuffer, path.basename(imagePath));
      const processingTime = Date.now() - startTime;

      if (!ocrResult) {
        throw new Error('OCR processing failed');
      }

      return {
        text: ocrResult.text,
        modelUsed: ocrResult.modelUsed,
        processingTime,
      };
    });

    // Check thresholds
    const thresholdCheck = checkAccuracyThresholds(result, minAccuracy, minF1);
    const passed = thresholdCheck.passed;

    // Output based on format
    if (formatArg === 'json') {
      console.log(JSON.stringify({
        ...result,
        passed,
        thresholdCheck,
      }, null, 2));
    } else if (formatArg === 'markdown') {
      console.log('# OCR Test Result');
      console.log('');
      console.log(`**Test:** ${result.testCase.name}`);
      console.log(`**Status:** ${passed ? '✅ Pass' : '❌ Fail'}`);
      console.log('');
      console.log('## Metrics');
      console.log(`- Character Accuracy: ${result.metrics.characterAccuracy.toFixed(2)}%`);
      console.log(`- Word F1: ${result.metrics.wordF1.toFixed(3)}`);
      console.log(`- Edit Distance: ${result.metrics.editDistance}`);
      console.log(`- Italic Count: ${result.metrics.italicCount} (${result.metrics.italicPercentage.toFixed(2)}%)`);
    } else {
      // Console format
      console.log(formatTestResult(result, showDiff));

      if (!thresholdCheck.passed) {
        console.log('\nThreshold Check Failed:');
        for (const reason of thresholdCheck.reasons) {
          console.log(`  ❌ ${reason}`);
        }
      }
    }

    // Compare to baseline if requested
    if (compareBaseline) {
      const baseline = await getBaseline(testCase.name);
      if (baseline) {
        const delta = compareToBaseline(result, baseline, 0);
        console.log('');
        console.log(formatComparisonDelta(delta));
      } else {
        console.log('\n⚠️  No baseline found for this test');
      }
    }

    process.exit(passed ? 0 : 1);
  } catch (error: any) {
    console.error(`\n❌ Test failed with error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
