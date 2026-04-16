import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import {
  runOCRTest,
  type TestCase,
  type TestResult,
} from './ocrTester';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// ============================================================================
// Types
// ============================================================================

export type ExperimentType = 'model' | 'prompt' | 'preprocessing' | 'combined';

export interface ModelConfig {
  name: string;
  provider: 'anthropic' | 'openai';
  modelId: string;
  costPerMToken?: number;
}

export interface PromptConfig {
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

export interface PreprocessingConfig {
  name: string;
  sharpen?: number;
  contrast?: number;
  denoise?: boolean;
}

export interface ExperimentConfig {
  name: string;
  model?: ModelConfig;
  prompt?: PromptConfig;
  preprocessing?: PreprocessingConfig;
}

export interface ExperimentResult {
  config: ExperimentConfig;
  testResult: TestResult;
  costEstimate: number;
  score: number;
}

export interface ScoreWeights {
  accuracy: number;
  cost: number;
  latency: number;
}

export interface ExperimentReport {
  testName: string;
  experimentType: ExperimentType;
  timestamp: string;
  results: ExperimentResult[];
  recommendation: {
    config: ExperimentConfig;
    score: number;
    rationale: string;
  };
}

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_MODELS: ModelConfig[] = [
  {
    name: 'Claude 4.6 Sonnet',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4.6',
    costPerMToken: 3.00,
  },
  {
    name: 'Claude 4.6 Opus',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
    costPerMToken: 15.00,
  },
  {
    name: 'GPT-5',
    provider: 'openai',
    modelId: 'gpt-5',
    costPerMToken: 2.50,
  },
  {
    name: 'GPT-5 Mini',
    provider: 'openai',
    modelId: 'gpt-5-mini',
    costPerMToken: 0.50,
  },
  {
    name: 'GPT-4.1',
    provider: 'openai',
    modelId: 'gpt-4.1',
    costPerMToken: 2.50,
  },
  {
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    modelId: 'gpt-4.1-mini',
    costPerMToken: 0.50,
  },
];

export const DEFAULT_PROMPTS: PromptConfig[] = [
  {
    name: 'baseline',
    systemPrompt: 'You are an expert OCR system for handwritten notes.',
    userPromptTemplate: 'Transcribe this handwritten image. Preserve formatting and mark uncertain words with *asterisks*.',
  },
  {
    name: 'verbose',
    systemPrompt: 'You are an expert OCR system for handwritten notes. Pay careful attention to handwriting variations, crossed-out text, and unclear characters.',
    userPromptTemplate: 'Transcribe this handwritten image. Preserve all formatting including bullets, indentation, and line breaks. Mark any uncertain words with *asterisks*. If text is completely illegible, use *[illegible]*.',
  },
  {
    name: 'concise',
    systemPrompt: 'You are an OCR system.',
    userPromptTemplate: 'Transcribe this image.',
  },
  {
    name: 'with-glossary',
    systemPrompt: 'You are an expert OCR system for handwritten notes. Use the provided domain glossary to recognize technical terms and acronyms.',
    userPromptTemplate: 'Transcribe this handwritten image using the domain glossary. Preserve formatting and mark uncertain words with *asterisks*.',
  },
];

export const DEFAULT_PREPROCESSING: PreprocessingConfig[] = [
  {
    name: 'none',
  },
  {
    name: 'light-sharpen',
    sharpen: 1.2,
  },
  {
    name: 'heavy-sharpen',
    sharpen: 2.0,
  },
  {
    name: 'contrast-boost',
    contrast: 1.3,
  },
  {
    name: 'full-enhancement',
    sharpen: 1.5,
    contrast: 1.2,
    denoise: true,
  },
];

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  accuracy: 0.70,
  cost: 0.15,
  latency: 0.15,
};

// ============================================================================
// Experiment Execution
// ============================================================================

/**
 * Run OCR with a specific configuration
 */
export async function runOCRWithConfig(
  imagePath: string,
  config: ExperimentConfig,
  ocrFunction: (imagePath: string, config: ExperimentConfig) => Promise<{ text: string; modelUsed: string; processingTime?: number }>
): Promise<{ text: string; modelUsed: string; processingTime: number }> {
  const startTime = Date.now();
  const result = await ocrFunction(imagePath, config);
  const processingTime = result.processingTime || (Date.now() - startTime);

  return {
    text: result.text,
    modelUsed: result.modelUsed,
    processingTime,
  };
}

/**
 * Run experiment with multiple configurations
 */
export async function runExperiment(
  testCase: TestCase,
  configs: ExperimentConfig[],
  ocrFunction: (imagePath: string, config: ExperimentConfig) => Promise<{ text: string; modelUsed: string; processingTime?: number }>,
  scoreWeights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): Promise<ExperimentResult[]> {
  const results: ExperimentResult[] = [];

  for (const config of configs) {
    console.log(`\nRunning experiment: ${config.name}...`);

    try {
      // Run OCR test with this configuration
      const testResult = await runOCRTest(testCase, async (imagePath: string) => {
        return await runOCRWithConfig(imagePath, config, ocrFunction);
      });

      // Estimate cost (rough estimate based on image size and model)
      const imageSize = fs.statSync(testCase.imagePath).size;
      const tokensEstimate = Math.ceil(imageSize / 100); // Very rough: ~100 bytes per token
      const costPerMToken = config.model?.costPerMToken || 3.00;
      const costEstimate = (tokensEstimate / 1000000) * costPerMToken;

      // Calculate score
      const score = calculateScore(testResult, costEstimate, scoreWeights);

      results.push({
        config,
        testResult,
        costEstimate,
        score,
      });

      console.log(`✓ Complete: ${testResult.metrics.characterAccuracy.toFixed(1)}% accuracy, score: ${score.toFixed(2)}`);
    } catch (error: any) {
      console.error(`❌ Failed to run configuration ${config.name}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Calculate composite score for an experiment result
 */
export function calculateScore(
  testResult: TestResult,
  costEstimate: number,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): number {
  // Normalize metrics to 0-100 scale
  const accuracyScore = testResult.metrics.characterAccuracy; // Already 0-100

  // Cost score: inverse of cost, normalized to 0-100 (lower cost = higher score)
  // Assume $0.10 per image is the high end
  const costScore = Math.max(0, 100 - (costEstimate / 0.10) * 100);

  // Latency score: inverse of processing time, normalized to 0-100 (lower time = higher score)
  // Assume 30 seconds is the high end
  const latencyScore = Math.max(0, 100 - ((testResult.processingTime || 0) / 30000) * 100);

  // Weighted composite score
  const compositeScore =
    (accuracyScore * weights.accuracy) +
    (costScore * weights.cost) +
    (latencyScore * weights.latency);

  return compositeScore;
}

/**
 * Select best configuration from experiment results
 */
export function selectBestConfig(results: ExperimentResult[]): {
  config: ExperimentConfig;
  result: ExperimentResult;
  rationale: string;
} {
  if (results.length === 0) {
    throw new Error('No experiment results to compare');
  }

  // Sort by score descending
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const best = sorted[0];

  // Generate rationale
  const rationale = generateRationale(best, results);

  return {
    config: best.config,
    result: best,
    rationale,
  };
}

/**
 * Generate rationale for why a configuration was selected
 */
function generateRationale(best: ExperimentResult, allResults: ExperimentResult[]): string {
  const lines: string[] = [];

  lines.push(`Selected "${best.config.name}" with composite score ${best.score.toFixed(2)}/100.`);
  lines.push('');

  // Compare to other configs
  const others = allResults.filter(r => r.config.name !== best.config.name);

  if (others.length > 0) {
    lines.push('Comparison:');

    for (const other of others) {
      const accDiff = best.testResult.metrics.characterAccuracy - other.testResult.metrics.characterAccuracy;
      const costDiff = other.costEstimate - best.costEstimate; // Higher diff means best is cheaper
      const timeDiff = (other.testResult.processingTime || 0) - (best.testResult.processingTime || 0); // Higher diff means best is faster

      const reasons: string[] = [];

      if (Math.abs(accDiff) > 1) {
        reasons.push(`${accDiff > 0 ? '+' : ''}${accDiff.toFixed(1)}% accuracy`);
      }

      if (Math.abs(costDiff) > 0.001) {
        reasons.push(`$${Math.abs(costDiff).toFixed(3)} ${costDiff > 0 ? 'cheaper' : 'more expensive'}`);
      }

      if (Math.abs(timeDiff) > 1000) {
        reasons.push(`${Math.abs(timeDiff / 1000).toFixed(1)}s ${timeDiff > 0 ? 'faster' : 'slower'}`);
      }

      if (reasons.length > 0) {
        lines.push(`  vs "${other.config.name}": ${reasons.join(', ')}`);
      }
    }
  }

  lines.push('');
  lines.push('Key metrics:');
  lines.push(`  - Accuracy: ${best.testResult.metrics.characterAccuracy.toFixed(2)}%`);
  lines.push(`  - Word F1: ${best.testResult.metrics.wordF1.toFixed(3)}`);
  lines.push(`  - Cost: $${best.costEstimate.toFixed(4)}`);
  lines.push(`  - Latency: ${((best.testResult.processingTime || 0) / 1000).toFixed(2)}s`);
  lines.push(`  - Italics: ${best.testResult.metrics.italicPercentage.toFixed(2)}%`);

  return lines.join('\n');
}

// ============================================================================
// Experiment Type Builders
// ============================================================================

/**
 * Build configurations for model experiment
 */
export function buildModelExperiment(models: string[] = []): ExperimentConfig[] {
  const selectedModels = models.length > 0
    ? DEFAULT_MODELS.filter(m => models.includes(m.name.toLowerCase().replace(/\s+/g, '')) || models.includes(m.modelId))
    : DEFAULT_MODELS;

  return selectedModels.map(model => ({
    name: model.name,
    model,
  }));
}

/**
 * Build configurations for prompt experiment
 */
export function buildPromptExperiment(prompts: string[] = []): ExperimentConfig[] {
  const selectedPrompts = prompts.length > 0
    ? DEFAULT_PROMPTS.filter(p => prompts.includes(p.name))
    : DEFAULT_PROMPTS;

  return selectedPrompts.map(prompt => ({
    name: `Prompt: ${prompt.name}`,
    prompt,
  }));
}

/**
 * Build configurations for preprocessing experiment
 */
export function buildPreprocessingExperiment(preprocessings: string[] = []): ExperimentConfig[] {
  const selectedPreprocessings = preprocessings.length > 0
    ? DEFAULT_PREPROCESSING.filter(p => preprocessings.includes(p.name))
    : DEFAULT_PREPROCESSING;

  return selectedPreprocessings.map(preprocessing => ({
    name: `Preprocess: ${preprocessing.name}`,
    preprocessing,
  }));
}

/**
 * Build configurations for combined matrix experiment
 */
export function buildCombinedExperiment(
  models: string[] = [],
  prompts: string[] = [],
  preprocessings: string[] = []
): ExperimentConfig[] {
  const selectedModels = models.length > 0
    ? DEFAULT_MODELS.filter(m => models.includes(m.name.toLowerCase().replace(/\s+/g, '')) || models.includes(m.modelId))
    : [DEFAULT_MODELS[0]]; // Default to first model

  const selectedPrompts = prompts.length > 0
    ? DEFAULT_PROMPTS.filter(p => prompts.includes(p.name))
    : [DEFAULT_PROMPTS[0]]; // Default to first prompt

  const selectedPreprocessings = preprocessings.length > 0
    ? DEFAULT_PREPROCESSING.filter(p => preprocessings.includes(p.name))
    : [DEFAULT_PREPROCESSING[0]]; // Default to no preprocessing

  // Generate all combinations
  const configs: ExperimentConfig[] = [];

  for (const model of selectedModels) {
    for (const prompt of selectedPrompts) {
      for (const preprocessing of selectedPreprocessings) {
        configs.push({
          name: `${model.name} + ${prompt.name} + ${preprocessing.name}`,
          model,
          prompt,
          preprocessing,
        });
      }
    }
  }

  return configs;
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate tabular comparison report
 */
export function generateComparisonTable(results: ExperimentResult[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('Experiment Results:');
  lines.push('');

  // Table header
  lines.push('| Configuration | Accuracy | Word F1 | Cost | Latency | Italics | Score |');
  lines.push('|--------------|----------|---------|------|---------|---------|-------|');

  // Sort by score descending
  const sorted = [...results].sort((a, b) => b.score - a.score);

  for (const result of sorted) {
    const config = result.config.name.padEnd(20).substring(0, 20);
    const accuracy = `${result.testResult.metrics.characterAccuracy.toFixed(1)}%`.padStart(8);
    const f1 = result.testResult.metrics.wordF1.toFixed(3).padStart(7);
    const cost = `$${result.costEstimate.toFixed(4)}`.padStart(6);
    const latency = `${((result.testResult.processingTime || 0) / 1000).toFixed(1)}s`.padStart(7);
    const italics = `${result.testResult.metrics.italicPercentage.toFixed(1)}%`.padStart(7);
    const score = result.score.toFixed(1).padStart(5);

    lines.push(`| ${config} | ${accuracy} | ${f1} | ${cost} | ${latency} | ${italics} | ${score} |`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Generate Markdown experiment report
 */
export function generateExperimentReport(
  testName: string,
  experimentType: ExperimentType,
  results: ExperimentResult[],
  recommendation: { config: ExperimentConfig; result: ExperimentResult; rationale: string }
): string {
  const lines: string[] = [];

  lines.push(`# OCR Experiment Report: ${testName}`);
  lines.push('');
  lines.push(`**Type:** ${experimentType}`);
  lines.push(`**Date:** ${new Date().toISOString()}`);
  lines.push(`**Configurations Tested:** ${results.length}`);
  lines.push('');

  lines.push('## Comparison Table');
  lines.push('');
  lines.push('| Configuration | Accuracy | Word F1 | Cost | Latency | Italics | Score |');
  lines.push('|--------------|----------|---------|------|---------|---------|-------|');

  const sorted = [...results].sort((a, b) => b.score - a.score);

  for (const result of sorted) {
    const name = result.config.name;
    const acc = result.testResult.metrics.characterAccuracy.toFixed(1);
    const f1 = result.testResult.metrics.wordF1.toFixed(3);
    const cost = result.costEstimate.toFixed(4);
    const latency = ((result.testResult.processingTime || 0) / 1000).toFixed(1);
    const italics = result.testResult.metrics.italicPercentage.toFixed(1);
    const score = result.score.toFixed(1);

    const marker = result.config.name === recommendation.config.name ? '⭐ ' : '';

    lines.push(`| ${marker}${name} | ${acc}% | ${f1} | $${cost} | ${latency}s | ${italics}% | ${score} |`);
  }

  lines.push('');

  lines.push('## Recommendation');
  lines.push('');
  lines.push(`**${recommendation.config.name}**`);
  lines.push('');
  lines.push(recommendation.rationale);
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Experiment Result Persistence
// ============================================================================

const EXPERIMENTS_DIR = 'test-results/experiments';

export interface StoredExperiment {
  id: string;
  testName: string;
  experimentType: ExperimentType;
  timestamp: string;
  results: Array<{
    configName: string;
    modelUsed: string;
    accuracy: number;
    wordF1: number;
    costEstimate: number;
    processingTime: number;
    italicPercentage: number;
    score: number;
  }>;
  recommendation: {
    configName: string;
    score: number;
  };
}

/**
 * Store experiment results to disk
 */
export async function storeExperimentResults(
  testName: string,
  experimentType: ExperimentType,
  results: ExperimentResult[],
  recommendation: { config: ExperimentConfig; result: ExperimentResult }
): Promise<string> {
  try {
    // Ensure directory exists
    await mkdir(EXPERIMENTS_DIR, { recursive: true });

    // Generate unique ID
    const timestamp = new Date().toISOString();
    const id = `${testName.replace(/\s+/g, '-')}-${experimentType}-${Date.now()}`;

    // Create stored experiment object
    const stored: StoredExperiment = {
      id,
      testName,
      experimentType,
      timestamp,
      results: results.map(r => ({
        configName: r.config.name,
        modelUsed: r.testResult.modelUsed || 'unknown',
        accuracy: r.testResult.metrics.characterAccuracy,
        wordF1: r.testResult.metrics.wordF1,
        costEstimate: r.costEstimate,
        processingTime: r.testResult.processingTime || 0,
        italicPercentage: r.testResult.metrics.italicPercentage,
        score: r.score,
      })),
      recommendation: {
        configName: recommendation.config.name,
        score: recommendation.result.score,
      },
    };

    // Write to file
    const filePath = path.join(EXPERIMENTS_DIR, `${id}.json`);
    await writeFile(filePath, JSON.stringify(stored, null, 2), 'utf-8');

    return id;
  } catch (error: any) {
    throw new Error(`Failed to store experiment results: ${error.message}`);
  }
}

/**
 * Load experiment results from disk
 */
export async function loadExperiment(id: string): Promise<StoredExperiment | null> {
  try {
    const filePath = path.join(EXPERIMENTS_DIR, `${id}.json`);
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to load experiment: ${error.message}`);
  }
}

/**
 * List all stored experiments
 */
export async function listExperiments(): Promise<StoredExperiment[]> {
  try {
    const files = await fs.readdir(EXPERIMENTS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const experiments: StoredExperiment[] = [];

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(EXPERIMENTS_DIR, file);
        const data = await readFile(filePath, 'utf-8');
        experiments.push(JSON.parse(data));
      } catch (error: any) {
        console.error(`Failed to load experiment ${file}: ${error.message}`);
      }
    }

    // Sort by timestamp descending
    experiments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return experiments;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw new Error(`Failed to list experiments: ${error.message}`);
  }
}

/**
 * Get experiment history for a specific test
 */
export async function getExperimentHistory(testName: string): Promise<StoredExperiment[]> {
  const allExperiments = await listExperiments();
  return allExperiments.filter(e => e.testName === testName);
}

/**
 * Generate cost-accuracy tradeoff report
 */
export function generateCostAccuracyReport(experiments: StoredExperiment[]): string {
  const lines: string[] = [];

  lines.push('# Cost-Accuracy Tradeoff Analysis');
  lines.push('');

  if (experiments.length === 0) {
    lines.push('No experiments found.');
    return lines.join('\n');
  }

  lines.push('| Test | Type | Best Config | Accuracy | Cost | Score |');
  lines.push('|------|------|-------------|----------|------|-------|');

  for (const exp of experiments) {
    const bestResult = exp.results.find(r => r.configName === exp.recommendation.configName);
    if (bestResult) {
      const test = exp.testName;
      const type = exp.experimentType;
      const config = exp.recommendation.configName;
      const accuracy = bestResult.accuracy.toFixed(1);
      const cost = bestResult.costEstimate.toFixed(4);
      const score = exp.recommendation.score.toFixed(1);

      lines.push(`| ${test} | ${type} | ${config} | ${accuracy}% | $${cost} | ${score} |`);
    }
  }

  lines.push('');

  // Calculate aggregate metrics
  const allResults = experiments.flatMap(e => e.results);
  if (allResults.length > 0) {
    const avgAccuracy = allResults.reduce((sum, r) => sum + r.accuracy, 0) / allResults.length;
    const avgCost = allResults.reduce((sum, r) => sum + r.costEstimate, 0) / allResults.length;
    const avgLatency = allResults.reduce((sum, r) => sum + r.processingTime, 0) / allResults.length;

    lines.push('## Aggregate Statistics');
    lines.push('');
    lines.push(`- **Average Accuracy:** ${avgAccuracy.toFixed(2)}%`);
    lines.push(`- **Average Cost:** $${avgCost.toFixed(4)}`);
    lines.push(`- **Average Latency:** ${(avgLatency / 1000).toFixed(2)}s`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format experiment history for display
 */
export function formatExperimentHistory(experiments: StoredExperiment[]): string {
  const lines: string[] = [];

  lines.push(`\nExperiment History (${experiments.length} experiments)`);
  lines.push('');

  for (const exp of experiments) {
    const date = new Date(exp.timestamp).toLocaleString();
    lines.push(`${exp.id}`);
    lines.push(`  Test: ${exp.testName}`);
    lines.push(`  Type: ${exp.experimentType}`);
    lines.push(`  Date: ${date}`);
    lines.push(`  Configurations: ${exp.results.length}`);
    lines.push(`  Recommended: ${exp.recommendation.configName} (score: ${exp.recommendation.score.toFixed(1)})`);
    lines.push('');
  }

  return lines.join('\n');
}
