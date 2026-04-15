#!/usr/bin/env node
/**
 * Monitor ongoing experiments and display progress
 */

import fs from 'fs';
import path from 'path';

function getRunningExperiments() {
  const tasksDir = '/private/tmp/claude-501/-Users-I566809-Documents-Repositories-note-gen/308e8193-14ad-46a2-9ae3-9afd890fe2c9/tasks';

  try {
    const files = fs.readdirSync(tasksDir);
    const outputFiles = files.filter(f => f.endsWith('.output'));

    console.log('📊 Active Experiments:\n');

    for (const file of outputFiles) {
      const filePath = path.join(tasksDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Extract experiment type and progress
      const firstLine = lines[0] || '';
      const lastLines = lines.slice(-10).join('\n');

      if (firstLine.includes('Prompt Engineering')) {
        const testingMatch = lastLines.match(/Testing: (\w+)/);
        if (testingMatch) {
          console.log(`🧪 Prompt Engineering: Testing "${testingMatch[1]}"`);
        }
      } else if (firstLine.includes('Preprocessing')) {
        const strategyMatch = lastLines.match(/Strategy: (\w+)/);
        if (strategyMatch) {
          console.log(`🖼️  Preprocessing: Testing "${strategyMatch[1]}"`);
        }
      } else if (firstLine.includes('Multi-Pass')) {
        const passMatch = lastLines.match(/Pass (\d+)\/(\d+)/);
        if (passMatch) {
          console.log(`🔄 Multi-Pass: ${passMatch[1]}/${passMatch[2]} complete`);
        }
      }
    }
  } catch (error) {
    console.log('No active experiments found');
  }
}

// Check completed experiments
function checkResults() {
  const resultsDir = 'test-results';

  console.log('\n✅ Completed Experiments:\n');

  const experiments = [
    { file: 'multi-pass-experiment.json', name: 'Multi-Pass Analysis' },
    { file: 'prompt-experiment.json', name: 'Prompt Engineering' },
    { file: 'preprocessing-experiment.json', name: 'Preprocessing' },
    { file: 'temperature-experiment.json', name: 'Temperature Tuning' },
  ];

  for (const exp of experiments) {
    const filePath = path.join(resultsDir, exp.file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      console.log(`✓ ${exp.name}`);
      if (data.bestAccuracy) {
        console.log(`  Best: ${data.bestAccuracy.toFixed(2)}%`);
      }
    } catch {
      console.log(`⏳ ${exp.name}: Not started`);
    }
  }
}

getRunningExperiments();
checkResults();
