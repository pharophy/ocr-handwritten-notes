/**
 * Multi-pass OCR experiment
 * Run OCR multiple times and analyze variance
 */

import fs from 'fs/promises';
import path from 'path';
import { processHandwrittenImage } from '../ocr';
import { runOCRTest, type TestCase } from '../ocrTester';

async function runMultiPassExperiment(imagePath: string, passes: number = 3) {
  console.log(`🔄 Multi-Pass OCR Experiment (${passes} passes)\n`);
  console.log(`Image: ${imagePath}\n`);

  // Load expected output
  const dir = path.dirname(imagePath);
  const basename = path.basename(imagePath, path.extname(imagePath));
  const expectedPath = path.join(dir, `${basename} expected.txt`);

  const testCase: TestCase = {
    name: basename,
    imagePath,
    expectedPath,
  };

  const imageBuffer = await fs.readFile(imagePath);
  const passResults: Array<{
    passNumber: number;
    text: string;
    modelUsed: string;
    processingTime: number;
    accuracy: number;
    wordF1: number;
    italicPercent: number;
  }> = [];

  // Run multiple passes
  console.log(`Running ${passes} passes...\n`);
  for (let i = 0; i < passes; i++) {
    console.log(`Pass ${i + 1}/${passes}...`);
    const startTime = Date.now();

    try {
      const ocrResult = await processHandwrittenImage(imageBuffer, path.basename(imagePath));

      if (!ocrResult) {
        console.log(`❌ Pass ${i + 1} failed - no result`);
        continue;
      }

      const processingTime = Date.now() - startTime;

      // Test this pass
      const testResult = await runOCRTest(testCase, async () => ({
        text: ocrResult.text,
        modelUsed: ocrResult.modelUsed,
        processingTime,
      }));

      passResults.push({
        passNumber: i + 1,
        text: ocrResult.text,
        modelUsed: ocrResult.modelUsed,
        processingTime,
        accuracy: testResult.metrics.characterAccuracy,
        wordF1: testResult.metrics.wordF1,
        italicPercent: testResult.metrics.italicPercentage,
      });

      console.log(
        `✓ Pass ${i + 1}: ${testResult.metrics.characterAccuracy.toFixed(2)}% accuracy, ` +
        `F1: ${testResult.metrics.wordF1.toFixed(3)}, ` +
        `${testResult.metrics.italicPercentage.toFixed(1)}% italics, ` +
        `${(processingTime / 1000).toFixed(1)}s\n`
      );
    } catch (error: any) {
      console.log(`❌ Pass ${i + 1} error: ${error.message}\n`);
    }
  }

  if (passResults.length === 0) {
    console.log('No successful passes to analyze');
    return;
  }

  // Analysis
  console.log('='.repeat(80));
  console.log('Multi-Pass Analysis\n');

  // Calculate statistics
  const accuracies = passResults.map(r => r.accuracy);
  const f1Scores = passResults.map(r => r.wordF1);
  const italicPercentages = passResults.map(r => r.italicPercent);
  const times = passResults.map(r => r.processingTime);

  const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  const minAccuracy = Math.min(...accuracies);
  const maxAccuracy = Math.max(...accuracies);
  const stdDevAccuracy = Math.sqrt(
    accuracies.reduce((sum, val) => sum + Math.pow(val - avgAccuracy, 2), 0) / accuracies.length
  );

  const avgF1 = f1Scores.reduce((a, b) => a + b, 0) / f1Scores.length;
  const minF1 = Math.min(...f1Scores);
  const maxF1 = Math.max(...f1Scores);

  const avgItalics = italicPercentages.reduce((a, b) => a + b, 0) / italicPercentages.length;
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

  console.log('📊 Accuracy Statistics:');
  console.log(`  Average: ${avgAccuracy.toFixed(2)}%`);
  console.log(`  Range: ${minAccuracy.toFixed(2)}% - ${maxAccuracy.toFixed(2)}%`);
  console.log(`  Std Dev: ${stdDevAccuracy.toFixed(2)}%`);
  console.log(`  Variance: ${(maxAccuracy - minAccuracy).toFixed(2)} percentage points\n`);

  console.log('📊 Word F1 Statistics:');
  console.log(`  Average: ${avgF1.toFixed(3)}`);
  console.log(`  Range: ${minF1.toFixed(3)} - ${maxF1.toFixed(3)}\n`);

  console.log('📊 Other Metrics:');
  console.log(`  Average Italics: ${avgItalics.toFixed(1)}%`);
  console.log(`  Average Time: ${(avgTime / 1000).toFixed(1)}s`);
  console.log(`  Total Time: ${(times.reduce((a, b) => a + b, 0) / 1000).toFixed(1)}s\n`);

  console.log('='.repeat(80));

  // Determine best pass
  const bestPass = passResults.reduce((best, current) =>
    current.accuracy > best.accuracy ? current : best
  );

  const worstPass = passResults.reduce((worst, current) =>
    current.accuracy < worst.accuracy ? current : worst
  );

  console.log(`\n🏆 Best Pass: #${bestPass.passNumber} (${bestPass.accuracy.toFixed(2)}% accuracy)`);
  console.log(`❌ Worst Pass: #${worstPass.passNumber} (${worstPass.accuracy.toFixed(2)}% accuracy)`);
  console.log(`📈 Improvement Potential: ${(bestPass.accuracy - avgAccuracy).toFixed(2)}% above average`);

  // Consistency analysis
  const isConsistent = stdDevAccuracy < 5; // Less than 5% std dev is consistent
  const isHighlyVariable = stdDevAccuracy > 15; // More than 15% std dev is highly variable

  console.log('\n💡 Insights:');
  if (isConsistent) {
    console.log('  ✓ Results are CONSISTENT across passes');
    console.log('  → Multi-pass averaging unlikely to help much');
    console.log('  → Focus on prompt engineering and post-processing');
  } else if (isHighlyVariable) {
    console.log('  ⚠️  Results are HIGHLY VARIABLE across passes');
    console.log('  → Multi-pass reconciliation could significantly improve accuracy');
    console.log('  → Averaging or voting on words recommended');
  } else {
    console.log('  ⚡ Results show MODERATE variability');
    console.log('  → Multi-pass may provide modest improvements');
    console.log('  → Consider 2-pass approach for important documents');
  }

  // Save results
  const resultsPath = path.join('test-results', 'multi-pass-experiment.json');
  await fs.writeFile(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    imagePath,
    passes: passResults.length,
    statistics: {
      accuracy: { avg: avgAccuracy, min: minAccuracy, max: maxAccuracy, stdDev: stdDevAccuracy },
      wordF1: { avg: avgF1, min: minF1, max: maxF1 },
      italics: { avg: avgItalics },
      time: { avg: avgTime, total: times.reduce((a, b) => a + b, 0) },
    },
    passes: passResults,
  }, null, 2));

  console.log(`\n💾 Results saved to: ${resultsPath}`);
}

// Run experiment
const imagePath = process.argv[2] || 'test-images/Dynatrace Q2 04-09.jpeg';
const passes = parseInt(process.argv[3] || '3');

runMultiPassExperiment(imagePath, passes)
  .then(() => {
    console.log('\n✓ Experiment complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Experiment failed:', error);
    process.exit(1);
  });
