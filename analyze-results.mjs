#!/usr/bin/env node

import fs from 'fs';
import { glob } from 'glob';

// Find the most recent test results file
const files = glob.sync('test-results-*.txt').sort().reverse();

if (files.length === 0) {
  console.log('No test results found.');
  process.exit(1);
}

const resultsFile = files[0];
console.log(`Analyzing: ${resultsFile}\n`);

const content = fs.readFileSync(resultsFile, 'utf-8');

// Parse results for each model
const sections = content.split('========================================');
const modelResults = [];

for (const section of sections) {
  const providerMatch = section.match(/Provider: ([\w-]+), Model: ([\w-\.]+)/);
  const accuracyMatch = section.match(/OCR Accuracy: ([\d.]+)%.*\((\d+)\/(\d+) checks passed\)/);
  const passMatch = section.match(/✓.*should accurately transcribe/);
  const failMatch = section.match(/✗.*should accurately transcribe/);

  if (providerMatch && accuracyMatch) {
    modelResults.push({
      provider: providerMatch[1],
      model: providerMatch[2],
      accuracy: parseFloat(accuracyMatch[1]),
      passed: parseInt(accuracyMatch[2]),
      total: parseInt(accuracyMatch[3]),
      testPassed: !!passMatch
    });
  }
}

if (modelResults.length === 0) {
  console.log('Could not parse any results from the file.');
  process.exit(1);
}

// Sort by accuracy
modelResults.sort((a, b) => b.accuracy - a.accuracy);

console.log('═══════════════════════════════════════════════════════════════');
console.log('                    OCR ACCURACY COMPARISON                     ');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Rank | Provider    | Model                              | Accuracy | Pass');
console.log('-----|-------------|------------------------------------|-----------|----|');

modelResults.forEach((result, index) => {
  const rank = (index + 1).toString().padStart(4);
  const provider = result.provider.padEnd(11);
  const model = result.model.padEnd(34);
  const accuracy = `${result.accuracy.toFixed(1)}%`.padStart(7);
  const passIcon = result.testPassed ? '✓' : '✗';
  const passInfo = `(${result.passed}/${result.total})`;

  console.log(`${rank} | ${provider} | ${model} | ${accuracy} ${passInfo} | ${passIcon}`);
});

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('                         RECOMMENDATION                         ');
console.log('═══════════════════════════════════════════════════════════════\n');

const best = modelResults[0];
const bestForCost = modelResults.find(r =>
  r.model.includes('haiku') || r.model.includes('gpt-4o') && !r.model.includes('gpt-4-turbo')
);

console.log(`🏆 Highest Accuracy: ${best.provider} / ${best.model}`);
console.log(`   Accuracy: ${best.accuracy.toFixed(1)}% (${best.passed}/${best.total} checks passed)`);
console.log('');

if (bestForCost && bestForCost !== best) {
  console.log(`💰 Best Value: ${bestForCost.provider} / ${bestForCost.model}`);
  console.log(`   Accuracy: ${bestForCost.accuracy.toFixed(1)}% (${bestForCost.passed}/${bestForCost.total} checks passed)`);
  console.log(`   Cost difference: Much lower than ${best.model}`);
  console.log('');
}

console.log('📋 Notes:');
console.log('   - Models with 75%+ accuracy pass the quality threshold');
console.log('   - Claude Sonnet typically excels at handwriting recognition');
console.log('   - Haiku models offer good balance of speed and accuracy');
console.log('   - Consider cost vs accuracy trade-offs for your use case');
console.log('');
