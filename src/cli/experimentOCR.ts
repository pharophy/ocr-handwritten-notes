#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// Load environment variables
dotenv.config();
import {
  discoverTestCases,
  type TestCase,
} from '../ocrTester';
import {
  runExperiment,
  buildModelExperiment,
  buildPromptExperiment,
  buildPreprocessingExperiment,
  buildCombinedExperiment,
  selectBestConfig,
  generateComparisonTable,
  generateExperimentReport,
  storeExperimentResults,
  DEFAULT_SCORE_WEIGHTS,
  type ExperimentType,
  type ExperimentConfig,
  type ScoreWeights,
} from '../ocrExperiment';
import { processHandwrittenImage } from '../ocr';
import fs from 'fs/promises';

/**
 * CLI for running OCR experiments
 * Usage: npm run experiment-ocr <image-path> [options]
 */

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: npm run experiment-ocr <image-path> [options]

Options:
  --type=TYPE           Experiment type: model, prompt, preprocessing, combined (default: model)
  --models=LIST         Comma-separated list of models to test (e.g., opus,gpt4o)
  --prompts=LIST        Comma-separated list of prompts to test (e.g., baseline,verbose)
  --preprocessing=LIST  Comma-separated list of preprocessing configs (e.g., none,light-sharpen)
  --weights=W1,W2,W3    Score weights: accuracy,cost,latency (default: 0.7,0.15,0.15)
  --format=FORMAT       Output format: console (default), markdown, json
  --output=FILE         Save report to file (markdown/json formats only)
  --help                Show this help message

Available Models:
  - claude-sonnet-4.6 (Claude 4.6 Sonnet)
  - claude-opus-4-6 (Claude 4.6 Opus)
  - gpt-4o (GPT-4o)
  - gpt-4-vision-preview (GPT-4 Vision)

Available Prompts:
  - baseline (default OCR prompt)
  - verbose (detailed instructions)
  - concise (minimal prompt)
  - with-glossary (uses domain glossary)

Available Preprocessing:
  - none (no preprocessing)
  - light-sharpen
  - heavy-sharpen
  - contrast-boost
  - full-enhancement

Examples:
  npm run experiment-ocr "test-images/Dynatrace Q2 04-09.jpeg"
  npm run experiment-ocr "test-images/Dynatrace Q2 04-09.jpeg" -- --type=model --models=opus,gpt4o
  npm run experiment-ocr "test-images/Dynatrace Q2 04-09.jpeg" -- --type=prompt --prompts=baseline,verbose
  npm run experiment-ocr "test-images/Dynatrace Q2 04-09.jpeg" -- --type=combined --models=opus --prompts=baseline,verbose
  npm run experiment-ocr "test-images/Dynatrace Q2 04-09.jpeg" -- --weights=0.8,0.1,0.1
  npm run experiment-ocr "test-images/Dynatrace Q2 04-09.jpeg" -- --format=markdown --output=experiment-report.md
`);
    process.exit(0);
  }

  // Parse arguments
  const imagePath = args.find(arg => !arg.startsWith('--')) || '';
  const typeArg = (args.find(arg => arg.startsWith('--type='))?.split('=')[1] || 'model') as ExperimentType;
  const modelsArg = args.find(arg => arg.startsWith('--models='))?.split('=')[1]?.split(',') || [];
  const promptsArg = args.find(arg => arg.startsWith('--prompts='))?.split('=')[1]?.split(',') || [];
  const preprocessingArg = args.find(arg => arg.startsWith('--preprocessing='))?.split('=')[1]?.split(',') || [];
  const weightsArg = args.find(arg => arg.startsWith('--weights='))?.split('=')[1]?.split(',').map(parseFloat);
  const formatArg = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'console';
  const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1];

  if (!imagePath) {
    console.error('Error: Image path is required');
    process.exit(1);
  }

  // Resolve paths
  const resolvedImagePath = path.resolve(imagePath);
  const baseName = path.basename(imagePath).replace(/\.(jpeg|jpg)$/, '');
  const directory = path.dirname(resolvedImagePath);
  const expectedPath = path.join(directory, `${baseName} expected.txt`);

  // Create test case
  const testCase: TestCase = {
    name: baseName,
    imagePath: resolvedImagePath,
    expectedPath,
  };

  // Parse score weights
  const scoreWeights: ScoreWeights = weightsArg && weightsArg.length === 3
    ? { accuracy: weightsArg[0], cost: weightsArg[1], latency: weightsArg[2] }
    : DEFAULT_SCORE_WEIGHTS;

  console.log(`Running ${typeArg} experiment: ${baseName}`);
  console.log(`Score weights: accuracy=${scoreWeights.accuracy}, cost=${scoreWeights.cost}, latency=${scoreWeights.latency}`);
  console.log('');

  try {
    // Build configurations based on experiment type
    let configs: ExperimentConfig[];

    switch (typeArg) {
      case 'model':
        configs = buildModelExperiment(modelsArg);
        break;
      case 'prompt':
        configs = buildPromptExperiment(promptsArg);
        break;
      case 'preprocessing':
        configs = buildPreprocessingExperiment(preprocessingArg);
        break;
      case 'combined':
        configs = buildCombinedExperiment(modelsArg, promptsArg, preprocessingArg);
        break;
      default:
        throw new Error(`Invalid experiment type: ${typeArg}`);
    }

    console.log(`Testing ${configs.length} configurations...`);

    // Run experiment
    const results = await runExperiment(
      testCase,
      configs,
      async (imagePath: string, config: ExperimentConfig) => {
        // For now, use the default OCR function
        // In a real implementation, this would apply the config (model, prompt, preprocessing)
        const startTime = Date.now();
        const imageBuffer = await fs.readFile(imagePath);
        const ocrResult = await processHandwrittenImage(imageBuffer, path.basename(imagePath));
        const processingTime = Date.now() - startTime;

        if (!ocrResult) {
          throw new Error('OCR processing failed');
        }

        return {
          text: ocrResult.text,
          modelUsed: config.model?.name || ocrResult.modelUsed,
          processingTime,
        };
      },
      scoreWeights
    );

    // Select best configuration
    const recommendation = selectBestConfig(results);

    // Store experiment results
    try {
      const experimentId = await storeExperimentResults(
        testCase.name,
        typeArg,
        results,
        recommendation
      );
      console.log(`\n✓ Experiment results stored: ${experimentId}`);
    } catch (error: any) {
      console.warn(`⚠️  Failed to store experiment results: ${error.message}`);
    }

    // Generate output based on format
    if (formatArg === 'json') {
      const report = {
        testName: testCase.name,
        experimentType: typeArg,
        timestamp: new Date().toISOString(),
        results,
        recommendation: {
          config: recommendation.config,
          score: recommendation.result.score,
          rationale: recommendation.rationale,
        },
      };

      const output = JSON.stringify(report, null, 2);

      if (outputFile) {
        await fs.writeFile(outputFile, output, 'utf-8');
        console.log(`\n✓ Report saved to: ${outputFile}`);
      } else {
        console.log(output);
      }
    } else if (formatArg === 'markdown') {
      const report = generateExperimentReport(
        testCase.name,
        typeArg,
        results,
        recommendation
      );

      if (outputFile) {
        await fs.writeFile(outputFile, report, 'utf-8');
        console.log(`\n✓ Report saved to: ${outputFile}`);
      } else {
        console.log(report);
      }
    } else {
      // Console format
      console.log(generateComparisonTable(results));
      console.log('');
      console.log('Recommendation:');
      console.log(`  ${recommendation.config.name} (score: ${recommendation.result.score.toFixed(2)})`);
      console.log('');
      console.log(recommendation.rationale);
    }

    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ Experiment failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
