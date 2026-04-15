/**
 * Image preprocessing experiment
 * Test different preprocessing strategies to improve OCR accuracy
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { runOCRTest, type TestCase } from '../ocrTester';
import { createAIProvider } from '../aiProvider';
import { loadAIProviderConfig, loadHandwritingReference, getDomainGlossary, formatGlossaryContext } from '../handwritingReference';
import { condenseBulletLines } from '../ocr';

interface PreprocessConfig {
  name: string;
  description: string;
  apply: (buffer: Buffer) => Promise<Buffer>;
}

const PREPROCESSING_STRATEGIES: PreprocessConfig[] = [
  {
    name: 'baseline',
    description: 'Current production preprocessing',
    apply: async (buffer) => {
      return sharp(buffer)
        .grayscale()
        .resize({ width: 1600, height: 7000, fit: 'inside' })
        .normalize()
        .sharpen({ sigma: 1.0 })
        .jpeg({ quality: 95 })
        .toBuffer();
    },
  },
  {
    name: 'high-contrast',
    description: 'Increased contrast for better character definition',
    apply: async (buffer) => {
      return sharp(buffer)
        .grayscale()
        .resize({ width: 1600, height: 7000, fit: 'inside' })
        .normalize()
        .linear(1.5, -30) // Increase contrast
        .sharpen({ sigma: 1.0 })
        .jpeg({ quality: 95 })
        .toBuffer();
    },
  },
  {
    name: 'extra-sharp',
    description: 'Stronger sharpening for clearer edges',
    apply: async (buffer) => {
      return sharp(buffer)
        .grayscale()
        .resize({ width: 1600, height: 7000, fit: 'inside' })
        .normalize()
        .sharpen({ sigma: 2.0 }) // Double sharpening
        .jpeg({ quality: 95 })
        .toBuffer();
    },
  },
  {
    name: 'higher-resolution',
    description: 'Keep more detail with larger dimensions',
    apply: async (buffer) => {
      return sharp(buffer)
        .grayscale()
        .resize({ width: 2400, height: 10000, fit: 'inside' }) // 50% larger
        .normalize()
        .sharpen({ sigma: 1.0 })
        .jpeg({ quality: 95 })
        .toBuffer();
    },
  },
  {
    name: 'threshold-binary',
    description: 'Binary threshold for stark black/white',
    apply: async (buffer) => {
      return sharp(buffer)
        .grayscale()
        .resize({ width: 1600, height: 7000, fit: 'inside' })
        .normalize()
        .threshold(128) // Binary threshold
        .sharpen({ sigma: 1.0 })
        .jpeg({ quality: 95 })
        .toBuffer();
    },
  },
  {
    name: 'minimal',
    description: 'Minimal processing - just grayscale and resize',
    apply: async (buffer) => {
      return sharp(buffer)
        .grayscale()
        .resize({ width: 1600, height: 7000, fit: 'inside' })
        .jpeg({ quality: 95 })
        .toBuffer();
    },
  },
  {
    name: 'quality-boost',
    description: 'Maximum JPEG quality',
    apply: async (buffer) => {
      return sharp(buffer)
        .grayscale()
        .resize({ width: 1600, height: 7000, fit: 'inside' })
        .normalize()
        .sharpen({ sigma: 1.0 })
        .jpeg({ quality: 100 }) // Maximum quality
        .toBuffer();
    },
  },
];

interface PreprocessResult {
  name: string;
  description: string;
  accuracy: number;
  wordF1: number;
  italicPercent: number;
  processingTime: number;
  fileSize: number;
}

async function runPreprocessExperiment(imagePath: string) {
  console.log('🖼️  Image Preprocessing Experiment\n');
  console.log(`Image: ${imagePath}\n`);

  const dir = path.dirname(imagePath);
  const basename = path.basename(imagePath, path.extname(imagePath));
  const expectedPath = path.join(dir, `${basename} expected.txt`);

  const testCase: TestCase = {
    name: basename,
    imagePath,
    expectedPath,
  };

  const imageBuffer = await fs.readFile(imagePath);
  const results: PreprocessResult[] = [];

  // Load provider config
  const refConfig = await loadHandwritingReference();
  const providerConfig = await loadAIProviderConfig(refConfig);
  const provider = createAIProvider(providerConfig);

  const glossary = getDomainGlossary(refConfig);
  const glossaryContext = formatGlossaryContext(glossary);

  const prompt = `
You are a handwriting transcription expert. Transcribe handwritten notes exactly as they appear.

Key principles:
- Transcribe every word precisely
- Preserve layout: indentation, bullets, line breaks
- Only use *italics* for truly illegible words
- Keep acronyms in ALL-CAPS
- Use '-' for bullets, '→' for arrows

${glossaryContext}

Transcribe the handwritten notes in this image. Output only the transcribed text.
`;

  console.log(`Testing ${PREPROCESSING_STRATEGIES.length} preprocessing strategies...\n`);

  for (const strategy of PREPROCESSING_STRATEGIES) {
    console.log(`Strategy: ${strategy.name}`);
    console.log(`  ${strategy.description}`);

    try {
      const startTime = Date.now();

      // Apply preprocessing
      const preprocessed = await strategy.apply(imageBuffer);
      const fileSize = preprocessed.length;

      const base64Image = preprocessed.toString('base64');

      // Run OCR
      const response = await provider.generateVisionCompletion(
        prompt,
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

      results.push({
        name: strategy.name,
        description: strategy.description,
        accuracy: testResult.metrics.characterAccuracy,
        wordF1: testResult.metrics.wordF1,
        italicPercent: testResult.metrics.italicPercentage,
        processingTime,
        fileSize,
      });

      console.log(
        `  Accuracy: ${testResult.metrics.characterAccuracy.toFixed(2)}%, ` +
        `F1: ${testResult.metrics.wordF1.toFixed(3)}, ` +
        `Size: ${(fileSize / 1024).toFixed(0)}KB, ` +
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
  console.log('Preprocessing Experiment Results\n');

  console.log('| Strategy | Accuracy | Word F1 | Italics | Size | Time |');
  console.log('|----------|----------|---------|---------|------|------|');

  for (const result of results) {
    console.log(
      `| ${result.name.padEnd(20)} | ${result.accuracy.toFixed(2).padStart(7)}% | ` +
      `${result.wordF1.toFixed(3).padStart(7)} | ${result.italicPercent.toFixed(1).padStart(6)}% | ` +
      `${(result.fileSize / 1024).toFixed(0).padStart(4)}KB | ${(result.processingTime / 1000).toFixed(1)}s |`
    );
  }

  console.log('\n' + '='.repeat(100));

  // Find optimal strategy
  const sortedByAccuracy = [...results].sort((a, b) => b.accuracy - a.accuracy);
  const bestResult = sortedByAccuracy[0];
  const baselineResult = results.find(r => r.name === 'baseline');

  console.log(`\n🏆 Best Strategy: ${bestResult.name}`);
  console.log(`   ${bestResult.description}`);
  console.log(`   Accuracy: ${bestResult.accuracy.toFixed(2)}%`);
  console.log(`   Word F1: ${bestResult.wordF1.toFixed(3)}`);

  if (baselineResult && bestResult.name !== 'baseline') {
    const improvement = bestResult.accuracy - baselineResult.accuracy;
    console.log(`   Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(2)}% vs baseline`);
  }

  console.log('\n💡 Insights:');

  // Compare top 3
  console.log('\nTop 3 strategies:');
  for (let i = 0; i < Math.min(3, sortedByAccuracy.length); i++) {
    const result = sortedByAccuracy[i];
    console.log(`  ${i + 1}. ${result.name}: ${result.accuracy.toFixed(2)}%`);
  }

  // Analyze if preprocessing matters
  const accuracies = results.map(r => r.accuracy);
  const minAccuracy = Math.min(...accuracies);
  const maxAccuracy = Math.max(...accuracies);
  const range = maxAccuracy - minAccuracy;

  if (range < 2) {
    console.log('\n  → Preprocessing has MINIMAL impact (< 2% difference)');
    console.log('  → Focus efforts elsewhere (prompts, multi-pass)');
  } else if (range > 5) {
    console.log('\n  → Preprocessing has SIGNIFICANT impact (> 5% difference)');
    console.log(`  → Using optimal strategy could improve by ${range.toFixed(2)}%`);
  } else {
    console.log('\n  → Preprocessing has MODERATE impact');
    console.log('  → Worth optimizing if easy to implement');
  }

  // Save results
  const resultsPath = path.join('test-results', 'preprocessing-experiment.json');
  await fs.writeFile(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    imagePath,
    results,
    bestStrategy: bestResult.name,
    bestAccuracy: bestResult.accuracy,
    accuracyRange: range,
  }, null, 2));

  console.log(`\n💾 Results saved to: ${resultsPath}`);
}

// Run experiment
const imagePath = process.argv[2] || 'test-images/Dynatrace Q2 04-09.jpeg';

runPreprocessExperiment(imagePath)
  .then(() => {
    console.log('\n✓ Experiment complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Experiment failed:', error);
    process.exit(1);
  });
