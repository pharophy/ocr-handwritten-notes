/**
 * Temperature and sampling parameter experiment
 * Test different temperature values to find optimal setting
 */

import fs from 'fs/promises';
import path from 'path';
import { createAIProvider, type AIProviderConfig, ProviderType } from '../providers/aiProvider';
import { runOCRTest, type TestCase } from '../ocrTester';
import { loadAIProviderConfig, loadHandwritingReference } from '../handwritingReference';
import { preprocessImage, condenseBulletLines } from '../ocrHelpers';

interface TempResult {
  temperature: number;
  accuracy: number;
  wordF1: number;
  italicPercent: number;
  processingTime: number;
}

async function runTemperatureExperiment(imagePath: string) {
  console.log('🌡️  Temperature Parameter Experiment\n');
  console.log(`Image: ${imagePath}\n`);

  // Temperature values to test (0.0 = deterministic, 1.0 = creative)
  const temperatures = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];

  const dir = path.dirname(imagePath);
  const basename = path.basename(imagePath, path.extname(imagePath));
  const expectedPath = path.join(dir, `${basename} expected.txt`);

  const testCase: TestCase = {
    name: basename,
    imagePath,
    expectedPath,
  };

  const imageBuffer = await fs.readFile(imagePath);
  const results: TempResult[] = [];

  // Load provider config
  const refConfig = await loadHandwritingReference();
  const providerConfig = await loadAIProviderConfig(refConfig);

  console.log(`Testing ${temperatures.length} temperature values...\n`);

  for (const temp of temperatures) {
    console.log(`Temperature: ${temp}`);

    try {
      const startTime = Date.now();

      // Create provider with temperature parameter
      // Note: Need to add temperature support to provider interface
      const provider = createAIProvider({
        ...providerConfig,
        temperature: temp as any, // Type override for experiment
      });

      // Preprocess image
      const preprocessed = await sharp(imageBuffer)
        .grayscale()
        .resize({ width: 1600, height: 7000, fit: 'inside' })
        .normalize()
        .sharpen({ sigma: 1.0 })
        .jpeg({ quality: 95 })
        .toBuffer();

      const base64Image = preprocessed.toString('base64');

      // Simple OCR prompt
      const prompt = `Transcribe the handwritten notes in this image precisely. Preserve all formatting.`;

      // Make API call with temperature
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
        temperature: temp,
        accuracy: testResult.metrics.characterAccuracy,
        wordF1: testResult.metrics.wordF1,
        italicPercent: testResult.metrics.italicPercentage,
        processingTime,
      });

      console.log(
        `  Accuracy: ${testResult.metrics.characterAccuracy.toFixed(2)}%, ` +
        `F1: ${testResult.metrics.wordF1.toFixed(3)}, ` +
        `${(processingTime / 1000).toFixed(1)}s\n`
      );
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}\n`);
      // Temperature might not be supported
      if (error.message.includes('temperature') || error.message.includes('parameter')) {
        console.log('⚠️  Temperature parameter not supported by this provider/model');
        console.log('Stopping temperature experiment\n');
        break;
      }
    }
  }

  if (results.length === 0) {
    console.log('No results - temperature parameter likely not supported');
    return;
  }

  // Analysis
  console.log('='.repeat(80));
  console.log('Temperature Experiment Results\n');

  console.log('| Temp | Accuracy | Word F1 | Italics | Time |');
  console.log('|------|----------|---------|---------|------|');

  for (const result of results) {
    console.log(
      `| ${result.temperature.toFixed(1).padStart(4)} | ` +
      `${result.accuracy.toFixed(2).padStart(7)}% | ` +
      `${result.wordF1.toFixed(3).padStart(7)} | ` +
      `${result.italicPercent.toFixed(1).padStart(6)}% | ` +
      `${(result.processingTime / 1000).toFixed(1)}s |`
    );
  }

  console.log('\n' + '='.repeat(80));

  // Find optimal temperature
  const bestResult = results.reduce((best, current) =>
    current.accuracy > best.accuracy ? current : best
  );

  console.log(`\n🏆 Best Temperature: ${bestResult.temperature}`);
  console.log(`   Accuracy: ${bestResult.accuracy.toFixed(2)}%`);
  console.log(`   Word F1: ${bestResult.wordF1.toFixed(3)}`);

  // Analyze trend
  const sortedByTemp = [...results].sort((a, b) => a.temperature - b.temperature);
  const firstAccuracy = sortedByTemp[0].accuracy;
  const lastAccuracy = sortedByTemp[sortedByTemp.length - 1].accuracy;
  const trend = lastAccuracy - firstAccuracy;

  console.log('\n💡 Insights:');
  if (Math.abs(trend) < 2) {
    console.log('  → Temperature has MINIMAL impact on accuracy');
    console.log('  → Use default (0.0-0.3) for consistency');
  } else if (trend > 0) {
    console.log('  → Higher temperature IMPROVES accuracy');
    console.log('  → Model benefits from more creative sampling');
  } else {
    console.log('  → Lower temperature IMPROVES accuracy');
    console.log('  → Deterministic sampling is better for OCR');
  }

  // Save results
  const resultsPath = path.join('test-results', 'temperature-experiment.json');
  await fs.writeFile(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    imagePath,
    results,
    bestTemperature: bestResult.temperature,
    bestAccuracy: bestResult.accuracy,
  }, null, 2));

  console.log(`\n💾 Results saved to: ${resultsPath}`);
}

// Run experiment
const imagePath = process.argv[2] || 'test-images/Dynatrace Q2 04-09.jpeg';

runTemperatureExperiment(imagePath)
  .then(() => {
    console.log('\n✓ Experiment complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Experiment failed:', error);
    process.exit(1);
  });
