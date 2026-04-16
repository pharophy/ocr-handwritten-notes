#!/usr/bin/env node
/**
 * Generate an experiment-specific summary from the organized experiment folders
 * This replaces the monolithic EXPERIMENT_SUMMARY.md with per-experiment documentation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPERIMENTS_DIR = path.join(__dirname, '..', 'experiments');

function getExperiments() {
  const entries = fs.readdirSync(EXPERIMENTS_DIR, { withFileTypes: true });

  return entries
    .filter(entry => entry.isDirectory() && entry.name.match(/^\d{3}-/))
    .map(entry => {
      const experimentPath = path.join(EXPERIMENTS_DIR, entry.name);
      const parts = entry.name.split('-');
      const number = parts[0];
      const name = parts.slice(1).join('-');

      return {
        number,
        name,
        path: experimentPath,
        hasHypothesis: fs.existsSync(path.join(experimentPath, 'hypothesis.md')),
        hasFindings: fs.existsSync(path.join(experimentPath, 'findings.md')),
        hasResults: fs.existsSync(path.join(experimentPath, 'results.json'))
      };
    })
    .sort((a, b) => a.number.localeCompare(b.number));
}

function generateSummary() {
  const experiments = getExperiments();

  let markdown = `# OCR Experiments - Summary

**Last Updated**: ${new Date().toISOString().split('T')[0]}

This document provides an overview of all OCR accuracy experiments. For detailed information about each experiment, see the individual experiment folders in \`experiments/\`.

## Quick Links

- [Experiment Structure](experiments/README.md)
- [Current Model Selection](OCR_MODEL_SELECTION.md)
- [Testing Framework](src/ocrTester.ts)
- [Experimentation Framework](src/ocrExperiment.ts)

## Experiment Overview

| # | Name | Status | Key Finding |
|---|------|--------|-------------|
`;

  for (const exp of experiments) {
    const status = exp.hasFindings ? '✅ Complete' : exp.hasHypothesis ? '🔄 In Progress' : '📝 Planned';

    let keyFinding = '';
    if (exp.hasFindings) {
      try {
        const findings = fs.readFileSync(path.join(exp.path, 'findings.md'), 'utf-8');
        const summaryMatch = findings.match(/## Summary\n\n(.+)/);
        if (summaryMatch) {
          keyFinding = summaryMatch[1].split('\n')[0];
        }
      } catch (err) {
        keyFinding = 'See findings.md';
      }
    }

    markdown += `| ${exp.number} | [${exp.name}](experiments/${exp.number}-${exp.name}/) | ${status} | ${keyFinding} |\n`;
  }

  markdown += `\n## Experiments by Status

### Completed (${experiments.filter(e => e.hasFindings).length})

`;

  const completed = experiments.filter(e => e.hasFindings);
  for (const exp of completed) {
    markdown += `- **[${exp.number}](experiments/${exp.number}-${exp.name}/)**: ${exp.name.replace(/-/g, ' ')}\n`;
  }

  markdown += `\n### In Progress (${experiments.filter(e => e.hasHypothesis && !e.hasFindings).length})

`;

  const inProgress = experiments.filter(e => e.hasHypothesis && !e.hasFindings);
  if (inProgress.length === 0) {
    markdown += 'None currently running.\n';
  } else {
    for (const exp of inProgress) {
      markdown += `- **[${exp.number}](experiments/${exp.number}-${exp.name}/)**: ${exp.name.replace(/-/g, ' ')}\n`;
    }
  }

  markdown += `\n## Key Discoveries Across All Experiments

### 1. Mini Models Outperform Full Models (Experiment 003)
- GPT-5 Mini: 91.2% accuracy at $0.02/image
- GPT-5: 82.3% accuracy at $0.10/image
- **Takeaway**: Don't assume larger models are better for specific tasks

### 2. HAI Proxy Model Limitations (Experiments 001-003)
- HAI proxy only supports: gpt-5, gpt-5-mini, gpt-4.1, gpt-4.1-mini
- Models NOT available: gpt-4o, gpt-4-vision-preview
- **Takeaway**: Always verify API model availability before configuring

### 3. Formatting vs Content Accuracy Gap (All Experiments)
- Character accuracy: 85-91% (good)
- Word F1 scores: 0.55-0.60 (appears poor)
- Root cause: Indentation collapse, not content errors
- **Takeaway**: Use character accuracy as primary OCR quality metric

### 4. Configuration Loading Critical (Experiment 003)
- CLI tools need explicit \`dotenv.config()\`
- Environment inheritance doesn't work for dotenv files
- **Takeaway**: Every entry point needs environment loading

### 5. Quality Assessment Enhancement
- Combined illegible + italic markers more accurate than illegible alone
- Threshold increased from 15% → 30% for combined metric
- **Takeaway**: Italic markers indicate model uncertainty, treat like illegible

### 6. Cost-Accuracy-Speed Tradeoffs
\`\`\`
Model           Accuracy  Cost      Latency  Score
GPT-5 Mini      91.2%     $0.02     51.6s    75.7 ⭐
GPT-4.1 Mini    85.6%     $0.02     39.7s    71.8
Claude Sonnet   90.3%     $0.12     52.6s    63.2
Claude Opus     90.2%     $0.62     30.5s    63.1
GPT-5           82.3%     $0.10     55.4s    57.6
\`\`\`

## Performance Improvements

From start of experiments to current production configuration:

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Accuracy | 90.3% | 91.2% | +0.9% |
| Cost | $0.12 | $0.02 | -83% |
| Latency | 52.6s | 51.6s | -1.9% |
| Score | 63.2 | 75.7 | +19.8% |
| Annual Savings (10K images) | Baseline | - | $12,000 |

## Current Production Configuration

\`\`\`env
AI_MODEL_OCR=gpt-5-mini                          # Winner from Experiment 003
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini              # Cost-effective fallback
IMAGE_COMPRESSION_MAX_SIZE_MB=20                 # GPT supports larger images
OCR_UNCERTAIN_THRESHOLD=30                       # Combined illegible + italic
OCR_LEGACY_QUALITY_CHECK=false                   # Use enhanced quality assessment
\`\`\`

## Future Experiment Ideas

Based on findings from completed experiments:

1. **Prompt Engineering for Formatting** - Address indentation collapse
2. **Preprocessing Optimization** - Test sharpening/contrast variations
3. **Multi-Pass OCR** - Use GPT-5 Mini + fallback for challenging sections
4. **Mini Model Analysis** - Investigate why mini models outperform full models
5. **Ensemble Methods** - Combine multiple model outputs
6. **Domain Glossary Impact** - Test with/without domain-specific terms
7. **Temperature Variations** - Test different sampling parameters
8. **Handwriting Style Diversity** - Test across different writing styles

## How to Run an Experiment

\`\`\`bash
# Ideate new experiments
/experiment-ocr

# Run model comparison
npm run experiment-ocr "test-images/sample.jpeg" -- --type=model

# Run single test
npm run test-ocr "test-images/sample.jpeg"

# Run full test suite
npm run test-ocr-suite
\`\`\`

## References

- **Original Monolithic Summary**: See git history for comprehensive \`EXPERIMENT_SUMMARY.md\` (deprecated)
- **Individual Experiments**: \`experiments/XXX-name/\` directories
- **Testing Framework**: \`src/ocrTester.ts\`
- **Experiment Framework**: \`src/ocrExperiment.ts\`
- **Model Selection**: \`OCR_MODEL_SELECTION.md\`
- **OpenSpec Change**: \`openspec/changes/improve-ocr-accuracy/\`
`;

  return markdown;
}

function main() {
  const summary = generateSummary();
  const outputPath = path.join(__dirname, '..', 'EXPERIMENTS.md');
  fs.writeFileSync(outputPath, summary, 'utf-8');
  console.log(`Generated experiment summary: ${outputPath}`);
}

main();
