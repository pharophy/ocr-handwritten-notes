# OCR Experiments

This directory contains organized experiments for improving OCR accuracy. Each experiment is self-contained with its hypothesis, methodology, results, and findings.

## Directory Structure

```text
experiments/
  README.md
  001-initial-model-comparison/
    hypothesis.md
    findings.md
  002-full-model-suite/
    hypothesis.md
    findings.md
  003-provider-compatibility/
    findings.md
```

Some historical folder names may reflect older provider experiments. Current runtime configuration uses direct OpenAI or direct Anthropic only.

## Experiment Naming Convention

Experiments are numbered sequentially with descriptive names:

- `001-initial-model-comparison`
- `002-prompt-engineering-variations`
- `003-preprocessing-optimization`

## Creating a New Experiment

Use the `/experiment-ocr` workflow to:

1. Ideate new experiment ideas based on current findings
2. Generate hypothesis and methodology
3. Run the experiment
4. Analyze results and document findings
5. Update experiment summary

Or manually create a new experiment folder with the required structure.

## Templates

### hypothesis.md

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

### findings.md

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

## Active Experiments

None currently running.

## Completed Experiments

See individual experiment folders for details.
