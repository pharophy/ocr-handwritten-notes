# OCR Experiments

This directory contains organized experiments for improving OCR accuracy. Each experiment is self-contained with its hypothesis, methodology, results, and findings.

## Directory Structure

```
experiments/
├── README.md (this file)
├── 001-initial-model-comparison/
│   ├── hypothesis.md          # What we're testing and why
│   ├── methodology.md          # How we'll test it
│   ├── results.json            # Raw experimental data
│   ├── findings.md             # Analysis and conclusions
│   └── artifacts/              # Any supporting files (images, configs, etc.)
├── 002-full-model-suite/
│   └── ...
└── 003-hai-proxy-compatible/
    └── ...
```

## Experiment Naming Convention

Experiments are numbered sequentially with descriptive names:
- `001-initial-model-comparison`
- `002-prompt-engineering-variations`
- `003-preprocessing-optimization`
- etc.

## Creating a New Experiment

Use the `/experiment-ocr` skill to:
1. Ideate new experiment ideas based on current findings
2. Generate hypothesis and methodology
3. Run the experiment
4. Analyze results and document findings
5. Update experiment summary

Or manually create a new experiment folder with the required structure.

## Experiment Templates

### hypothesis.md Template
```markdown
# Hypothesis

## Question
What are we trying to answer?

## Hypothesis
What do we expect to find?

## Rationale
Why do we think this will work?

## Success Criteria
How will we measure success?

## Risks
What could go wrong?
```

### findings.md Template
```markdown
# Findings

## Summary
One-sentence summary of what we learned.

## Results
Key metrics and observations.

## Analysis
What do the results mean?

## Recommendations
What should we do based on these findings?

## Next Steps
What experiments should follow from this?
```

## Historical Experiments (Pre-Organization)

Previous experiments (before this organizational structure) are documented in:
- `EXPERIMENT_SUMMARY.md` - Comprehensive summary of experiments 001-003
- `test-results/experiments/` - Raw JSON results from previous runs

These experiments include:
1. Initial Model Comparison (2026-04-15 14:42)
2. Full Model Suite Test (2026-04-15 15:19)
3. HAI Proxy Compatible Models (2026-04-15 23:48)

## Active Experiments

None currently running.

## Completed Experiments

See individual experiment folders for details.
