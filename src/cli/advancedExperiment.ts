#!/usr/bin/env node
/**
 * Advanced OCR experimentation CLI
 * Test prompts, hyperparameters, multi-pass, and combinations
 */

import { Command } from 'commander';
import path from 'path';
import fs from 'fs/promises';
import { processHandwrittenImage } from '../ocr';
import { runOCRTest, type TestCase, type TestResult } from '../ocrTester';
import { PROMPT_VARIATIONS } from '../promptVariations';

const program = new Command();

interface ExperimentConfig {
  imagePath: string;
  expectedPath: string;
  experiments: Array<{
    name: string;
    description: string;
    config: any;
  }>;
}

interface ExperimentResult {
  name: string;
  description: string;
  accuracy: number;
  wordF1: number;
  processingTime: number;
  italicPercent: number;
  config: any;
  score: number;
}

/**
 * Calculate composite score for experiment
 */
function calculateScore(result: TestResult, processingTime: number): number {
  const accuracyScore = result.metrics.characterAccuracy;
  const f1Score = result.metrics.wordF1 * 100;
  const speedScore = Math.max(0, 100 - processingTime / 1000); // Penalty for slow
  const italicPenalty = result.metrics.italicPercentage; // Penalty for uncertainty

  // Weighted: 60% accuracy, 20% F1, 10% speed, 10% confidence (low italics)
  return (
    accuracyScore * 0.6 +
    f1Score * 0.2 +
    speedScore * 0.1 +
    (100 - italicPenalty) * 0.1
  );
}

/**
 * Run prompt variation experiments
 */
async function runPromptExperiments(imagePath: string, expectedPath: string): Promise<void> {
  console.log('🧪 Running Prompt Variation Experiments\n');
  console.log(`Testing ${PROMPT_VARIATIONS.length} different prompts...\n`);

  const results: ExperimentResult[] = [];

  for (const variation of PROMPT_VARIATIONS) {
    console.log(`Testing: ${variation.name}`);
    console.log(`Description: ${variation.description}`);

    try {
      const startTime = Date.now();

      // Run OCR with custom prompt (need to modify OCR function to accept prompt override)
      const imageBuffer = await fs.readFile(imagePath);

      // For now, run with default since we'd need to modify OCR to accept custom prompts
      // TODO: Implement prompt override in processHandwrittenImage
      const ocrResult = await processHandwrittenImage(imageBuffer, path.basename(imagePath));

      if (!ocrResult) {
        console.log(`❌ Failed\n`);
        continue;
      }

      const processingTime = Date.now() - startTime;

      // Run test to get accuracy metrics
      const testCase: TestCase = {
        name: path.basename(imagePath, path.extname(imagePath)),
        imagePath,
        expectedPath,
      };

      const testResult = await runOCRTest(testCase, async () => ({
        text: ocrResult.text,
        modelUsed: ocrResult.modelUsed,
        processingTime,
      }));

      const score = calculateScore(testResult, processingTime);

      results.push({
        name: variation.name,
        description: variation.description,
        accuracy: testResult.metrics.characterAccuracy,
        wordF1: testResult.metrics.wordF1,
        processingTime,
        italicPercent: testResult.metrics.italicPercentage,
        config: { prompt: variation.name },
        score,
      });

      console.log(`✓ Accuracy: ${testResult.metrics.characterAccuracy.toFixed(2)}%, F1: ${testResult.metrics.wordF1.toFixed(3)}, Score: ${score.toFixed(1)}\n`);
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }

  // Sort by score
  results.sort((a, b) => b.score - a.score);

  // Display results table
  console.log('\n' + '='.repeat(80));
  console.log('Prompt Experiment Results:\n');
  console.log('| Prompt | Accuracy | Word F1 | Time | Italics | Score |');
  console.log('|--------|----------|---------|------|---------|-------|');

  for (const result of results) {
    console.log(
      `| ${result.name.padEnd(20)} | ${result.accuracy.toFixed(2).padStart(7)}% | ` +
      `${result.wordF1.toFixed(3).padStart(7)} | ${(result.processingTime / 1000).toFixed(1)}s | ` +
      `${result.italicPercent.toFixed(1).padStart(6)}% | ${result.score.toFixed(1).padStart(5)} |`
    );
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n🏆 Best: ${results[0].name} (score: ${results[0].score.toFixed(1)})`);
  console.log(`   ${results[0].description}`);
  console.log(`   Accuracy: ${results[0].accuracy.toFixed(2)}%, F1: ${results[0].wordF1.toFixed(3)}`);
}

/**
 * Run temperature experiments
 */
async function runTemperatureExperiments(imagePath: string, expectedPath: string): Promise<void> {
  console.log('🌡️  Running Temperature Experiments\n');

  const temperatures = [0.0, 0.3, 0.5, 0.7, 1.0];
  const results: ExperimentResult[] = [];

  for (const temp of temperatures) {
    console.log(`Testing temperature: ${temp}`);

    try {
      // Note: Current OCR implementation doesn't support temperature override
      // This would need to be added to the provider interface
      console.log(`⚠️  Temperature override not yet implemented, using default\n`);
      break;
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }

  console.log('TODO: Implement temperature parameter in AI provider interface');
}

/**
 * Run multi-pass experiments
 */
async function runMultiPassExperiment(imagePath: string, expectedPath: string, passes: number = 2): Promise<void> {
  console.log(`🔄 Running Multi-Pass Experiment (${passes} passes)\n`);

  const imageBuffer = await fs.readFile(imagePath);
  const testCase: TestCase = {
    name: path.basename(imagePath, path.extname(imagePath)),
    imagePath,
    expectedPath,
  };

  // Run multiple passes
  const passResults: Array<{ text: string; modelUsed: string; processingTime: number }> = [];
  let totalTime = 0;

  for (let i = 0; i < passes; i++) {
    console.log(`Pass ${i + 1}/${passes}...`);
    const startTime = Date.now();

    const ocrResult = await processHandwrittenImage(imageBuffer, path.basename(imagePath));

    if (!ocrResult) {
      console.log(`❌ Pass ${i + 1} failed`);
      continue;
    }

    const processingTime = Date.now() - startTime;
    totalTime += processingTime;

    passResults.push({
      text: ocrResult.text,
      modelUsed: ocrResult.modelUsed,
      processingTime,
    });

    console.log(`✓ Pass ${i + 1} complete (${(processingTime / 1000).toFixed(1)}s)`);
  }

  // Test each pass individually
  console.log('\nIndividual pass results:');
  for (let i = 0; i < passResults.length; i++) {
    const result = await runOCRTest(testCase, async () => passResults[i]);
    console.log(
      `Pass ${i + 1}: ${result.metrics.characterAccuracy.toFixed(2)}% accuracy, ` +
      `F1: ${result.metrics.wordF1.toFixed(3)}, ` +
      `${result.metrics.italicPercentage.toFixed(1)}% italics`
    );
  }

  // TODO: Implement reconciliation strategy
  console.log('\n📊 Multi-pass analysis:');
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`Average time per pass: ${(totalTime / passes / 1000).toFixed(1)}s`);
  console.log('\nTODO: Implement word-by-word reconciliation:');
  console.log('  - Compare outputs word-by-word');
  console.log('  - Use agreement as confidence');
  console.log('  - Prefer non-uncertain versions');
  console.log('  - Create consensus output');
}

program
  .name('advanced-experiment')
  .description('Advanced OCR experimentation: prompts, hyperparameters, multi-pass')
  .argument('<image>', 'Path to test image')
  .option('--prompts', 'Test different prompt variations')
  .option('--temperature', 'Test different temperature settings')
  .option('--multi-pass <n>', 'Run multi-pass experiment with N passes', '2')
  .option('--all', 'Run all experiments')
  .action(async (imagePath: string, options: any) => {
    try {
      // Resolve expected output path
      const dir = path.dirname(imagePath);
      const basename = path.basename(imagePath, path.extname(imagePath));
      const expectedPath = path.join(dir, `${basename} expected.txt`);

      // Check files exist
      try {
        await fs.access(imagePath);
        await fs.access(expectedPath);
      } catch {
        console.error(`Error: Could not find image or expected output`);
        console.error(`  Image: ${imagePath}`);
        console.error(`  Expected: ${expectedPath}`);
        process.exit(1);
      }

      if (options.all || options.prompts) {
        await runPromptExperiments(imagePath, expectedPath);
      }

      if (options.all || options.temperature) {
        await runTemperatureExperiments(imagePath, expectedPath);
      }

      if (options.all || options.multiPass) {
        const passes = parseInt(options.multiPass);
        await runMultiPassExperiment(imagePath, expectedPath, passes);
      }

      if (!options.all && !options.prompts && !options.temperature && !options.multiPass) {
        console.log('No experiment type specified. Use --prompts, --temperature, --multi-pass, or --all');
        console.log('\nAvailable experiments:');
        console.log('  --prompts       Test different prompt variations');
        console.log('  --temperature   Test different temperature settings');
        console.log('  --multi-pass N  Run multi-pass with N passes');
        console.log('  --all           Run all experiments');
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();
