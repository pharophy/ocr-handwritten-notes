#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// Load environment variables
dotenv.config();
import {
  runBatchTests,
  formatBatchResults,
  generateMarkdownReport,
  type TestResult,
} from '../ocrTester';
import { processHandwrittenImage } from '../ocr';
import fs from 'fs/promises';

/**
 * CLI for running the full OCR test suite
 * Usage: npm run test-ocr-suite [--directory=DIR] [--format=console|markdown|json] [--output=FILE]
 */

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Usage: npm run test-ocr-suite [options]

Options:
  --directory=DIR   Test images directory (default: test-images)
  --format=FORMAT   Output format: console (default), markdown, json
  --output=FILE     Save report to file (only for markdown/json formats)
  --help            Show this help message

Examples:
  npm run test-ocr-suite
  npm run test-ocr-suite -- --format=markdown --output=test-report.md
  npm run test-ocr-suite -- --directory=test-images
`);
    process.exit(0);
  }

  // Parse arguments
  const directory = args.find(arg => arg.startsWith('--directory='))?.split('=')[1] || 'test-images';
  const formatArg = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'console';
  const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1];

  const resolvedDir = path.resolve(directory);

  console.log(`Running OCR test suite in: ${resolvedDir}`);

  try {
    // Run batch tests
    const results = await runBatchTests(resolvedDir, async (imagePath: string) => {
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

    // Generate output based on format
    let output: string;

    if (formatArg === 'json') {
      output = JSON.stringify(results, null, 2);
    } else if (formatArg === 'markdown') {
      output = generateMarkdownReport(results);
    } else {
      output = formatBatchResults(results);
    }

    // Write to file or console
    if (outputFile) {
      await fs.writeFile(outputFile, output, 'utf-8');
      console.log(`\n✓ Report saved to: ${outputFile}`);
    } else {
      console.log(output);
    }

    // Exit with appropriate code
    const passCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    process.exit(passCount === totalCount ? 0 : 1);
  } catch (error: any) {
    console.error(`\n❌ Test suite failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
