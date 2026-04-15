/**
 * Prompt engineering experiment
 * Test different prompt variations to improve accuracy
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { createAIProvider } from '../aiProvider';
import { runOCRTest, type TestCase } from '../ocrTester';
import { loadAIProviderConfig, loadHandwritingReference, getDomainGlossary, formatGlossaryContext } from '../handwritingReference';
import { PROMPT_VARIATIONS } from '../promptVariations';

// Import from ocr.ts
const PREPROCESSING_WIDTH = 1600;
const PREPROCESSING_HEIGHT = 7000;
const PREPROCESSING_SHARPEN_SIGMA = 1.0;
const PREPROCESSING_QUALITY = 95;
const COMPRESSION_QUALITY_HIGH = 90;

interface PromptResult {
  name: string;
  description: string;
  accuracy: number;
  wordF1: number;
  italicPercent: number;
  processingTime: number;
  score: number;
}

function condenseBulletLines(text: string): string {
  const lines = text.split('\n');
  const condensed: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      condensed.push(line);
      i++;
      continue;
    }

    const isBullet = /^[-•*#]/.test(trimmed);

    if (isBullet) {
      let bulletContent = line;
      let j = i + 1;

      while (j < lines.length) {
        const nextLine = lines[j];
        const nextTrimmed = nextLine.trim();

        if (nextTrimmed === '') break;

        const nextIsBullet = /^[-•*#]/.test(nextTrimmed);
        const currentIndent = line.length - line.trimStart().length;
        const nextIndent = nextLine.length - nextLine.trimStart().length;

        if (nextIsBullet && nextIndent <= currentIndent) break;

        bulletContent += ' ' + nextTrimmed;
        j++;
      }

      condensed.push(bulletContent);
      i = j;
    } else {
      condensed.push(line);
      i++;
    }
  }

  return condensed.join('\n');
}

function calculateScore(result: any, processingTime: number): number {
  const accuracyScore = result.metrics.characterAccuracy;
  const f1Score = result.metrics.wordF1 * 100;
  const speedScore = Math.max(0, 100 - processingTime / 1000);
  const italicPenalty = result.metrics.italicPercentage;

  // Weighted: 60% accuracy, 20% F1, 10% speed, 10% confidence (low italics)
  return (
    accuracyScore * 0.6 +
    f1Score * 0.2 +
    speedScore * 0.1 +
    (100 - italicPenalty) * 0.1
  );
}

async function runPromptExperiment(imagePath: string) {
  console.log('🧪 Prompt Engineering Experiment\n');
  console.log(`Testing ${PROMPT_VARIATIONS.length} prompt variations...\n`);

  const dir = path.dirname(imagePath);
  const basename = path.basename(imagePath, path.extname(imagePath));
  const expectedPath = path.join(dir, `${basename} expected.txt`);

  const testCase: TestCase = {
    name: basename,
    imagePath,
    expectedPath,
  };

  const imageBuffer = await fs.readFile(imagePath);
  const results: PromptResult[] = [];

  // Load provider config
  const refConfig = await loadHandwritingReference();
  const providerConfig = await loadAIProviderConfig(refConfig);
  const provider = createAIProvider(providerConfig);

  const glossary = getDomainGlossary(refConfig);
  const glossaryContext = formatGlossaryContext(glossary);

  // Preprocess image once (reuse for all prompts)
  console.log('Preprocessing image...');
  const preprocessed = await sharp(imageBuffer)
    .grayscale()
    .resize({ width: PREPROCESSING_WIDTH, height: PREPROCESSING_HEIGHT, fit: 'inside' })
    .normalize()
    .sharpen({ sigma: PREPROCESSING_SHARPEN_SIGMA })
    .jpeg({ quality: PREPROCESSING_QUALITY })
    .toBuffer();

  // Compress if needed
  let finalBuffer = preprocessed;
  if (preprocessed.length > 5 * 1024 * 1024) {
    console.log('Compressing image...');
    finalBuffer = await sharp(preprocessed)
      .jpeg({ quality: COMPRESSION_QUALITY_HIGH })
      .toBuffer();
  }

  const base64Image = finalBuffer.toString('base64');
  console.log(`Image ready: ${(finalBuffer.length / 1024 / 1024).toFixed(2)}MB\n`);

  for (const variation of PROMPT_VARIATIONS) {
    console.log(`Testing: ${variation.name}`);
    console.log(`  ${variation.description}`);

    try {
      const startTime = Date.now();

      // Build prompt with glossary context
      const fullPrompt = variation.systemPrompt + '\n\n' + glossaryContext + '\n\n' + variation.userPrompt;

      // Run OCR with custom prompt
      const response = await provider.generateVisionCompletion(
        fullPrompt,
        base64Image,
        'image/jpeg',
        'ocr'
      );

      const text = response.content || '';
      const condensed = condenseBulletLines(text);
      const processingTime = Date.now() - startTime;

      // Test accuracy
      const testResult = await runOCRTest(testCase, async () => ({
        text: condensed,
        modelUsed: response.model,
        processingTime,
      }));

      const score = calculateScore(testResult, processingTime);

      results.push({
        name: variation.name,
        description: variation.description,
        accuracy: testResult.metrics.characterAccuracy,
        wordF1: testResult.metrics.wordF1,
        italicPercent: testResult.metrics.italicPercentage,
        processingTime,
        score,
      });

      console.log(
        `  ✓ Accuracy: ${testResult.metrics.characterAccuracy.toFixed(2)}%, ` +
        `F1: ${testResult.metrics.wordF1.toFixed(3)}, ` +
        `Italics: ${testResult.metrics.italicPercentage.toFixed(1)}%, ` +
        `Score: ${score.toFixed(1)}, ` +
        `${(processingTime / 1000).toFixed(1)}s\n`
      );
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}\n`);
    }
  }

  if (results.length === 0) {
    console.log('No successful tests');
    return;
  }

  // Analysis
  console.log('='.repeat(100));
  console.log('Prompt Engineering Results\n');

  // Sort by score
  const sortedByScore = [...results].sort((a, b) => b.score - a.score);

  console.log('| Prompt | Accuracy | Word F1 | Italics | Score |');
  console.log('|--------|----------|---------|---------|-------|');

  for (const result of sortedByScore) {
    const name = result.name.padEnd(22);
    console.log(
      `| ${name} | ${result.accuracy.toFixed(2).padStart(7)}% | ` +
      `${result.wordF1.toFixed(3).padStart(7)} | ${result.italicPercent.toFixed(1).padStart(6)}% | ` +
      `${result.score.toFixed(1).padStart(5)} |`
    );
  }

  console.log('\n' + '='.repeat(100));

  // Find best
  const bestResult = sortedByScore[0];
  const baselineResult = results.find(r => r.name === 'baseline');

  console.log(`\n🏆 Best Prompt: ${bestResult.name}`);
  console.log(`   ${bestResult.description}`);
  console.log(`   Accuracy: ${bestResult.accuracy.toFixed(2)}%`);
  console.log(`   Word F1: ${bestResult.wordF1.toFixed(3)}`);
  console.log(`   Italics: ${bestResult.italicPercent.toFixed(1)}%`);
  console.log(`   Score: ${bestResult.score.toFixed(1)}`);

  if (baselineResult && bestResult.name !== 'baseline') {
    const accuracyGain = bestResult.accuracy - baselineResult.accuracy;
    const italicReduction = baselineResult.italicPercent - bestResult.italicPercent;

    console.log(`\n📈 vs Baseline:`);
    console.log(`   Accuracy: ${accuracyGain > 0 ? '+' : ''}${accuracyGain.toFixed(2)}%`);
    console.log(`   Italics: ${italicReduction > 0 ? '-' : '+'}${Math.abs(italicReduction).toFixed(1)}%`);
  }

  console.log('\n💡 Key Insights:');

  // Analyze italic reduction
  const italicPercentages = results.map(r => r.italicPercent);
  const avgItalics = italicPercentages.reduce((a, b) => a + b, 0) / italicPercentages.length;
  const minItalics = Math.min(...italicPercentages);
  const maxItalics = Math.max(...italicPercentages);

  console.log(`\nUncertainty (Italics) Analysis:`);
  console.log(`  Average: ${avgItalics.toFixed(1)}%`);
  console.log(`  Range: ${minItalics.toFixed(1)}% - ${maxItalics.toFixed(1)}%`);
  console.log(`  Best reduction: ${(maxItalics - minItalics).toFixed(1)} percentage points`);

  if (minItalics < avgItalics - 5) {
    console.log(`  ✓ Prompting can SIGNIFICANTLY reduce uncertainty`);
    console.log(`  → Best prompt reduces italics by ${(avgItalics - minItalics).toFixed(1)}%`);
  } else {
    console.log(`  → Prompting has MINIMAL impact on uncertainty`);
  }

  // Analyze accuracy improvements
  const accuracies = results.map(r => r.accuracy);
  const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  const maxAccuracy = Math.max(...accuracies);

  console.log(`\nAccuracy Analysis:`);
  console.log(`  Average: ${avgAccuracy.toFixed(2)}%`);
  console.log(`  Best: ${maxAccuracy.toFixed(2)}%`);
  console.log(`  Improvement potential: ${(maxAccuracy - avgAccuracy).toFixed(2)}%`);

  // Top 3 recommendations
  console.log(`\n🎯 Top 3 Prompts:`);
  for (let i = 0; i < Math.min(3, sortedByScore.length); i++) {
    const result = sortedByScore[i];
    console.log(`  ${i + 1}. ${result.name}: ${result.accuracy.toFixed(2)}% accuracy, ${result.italicPercent.toFixed(1)}% italics`);
  }

  // Save results
  const resultsPath = path.join('test-results', 'prompt-experiment.json');
  await fs.writeFile(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    imagePath,
    results: sortedByScore,
    bestPrompt: bestResult.name,
    bestAccuracy: bestResult.accuracy,
    lowestItalics: minItalics,
    statistics: {
      accuracy: { avg: avgAccuracy, max: maxAccuracy },
      italics: { avg: avgItalics, min: minItalics, max: maxItalics },
    },
  }, null, 2));

  console.log(`\n💾 Results saved to: ${resultsPath}`);
}

// Run experiment
const imagePath = process.argv[2] || 'test-images/Dynatrace Q2 04-09.jpeg';

runPromptExperiment(imagePath)
  .then(() => {
    console.log('\n✓ Experiment complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Experiment failed:', error);
    process.exit(1);
  });
