## 1. Discover Available Models

- [x] 1.1 Create skill to query HAI proxy for available models (both OpenAI and Anthropic)
- [x] 1.2 Query OpenAI API directly for latest available vision models
- [x] 1.3 Document available new models (GPT-5, GPT-4.1, Claude 4.5/4.6) with capabilities
- [x] 1.4 Identify which new models have vision capabilities suitable for OCR

## 2. Add New Models to Experiment Framework

- [x] 2.1 Add GPT-5 (latest GPT model) - already in DEFAULT_MODELS
- [x] 2.2 Add Claude 4.5 models (Sonnet and Opus) for baseline comparison
- [x] 2.3 Pricing already configured for all models
- [x] 2.4 OpenAI provider adapter supports all current models

## 3. Verify Experiment Framework Compatibility

- [x] 2.1 Test that existing experimentOCR CLI recognizes new models in --models parameter
- [x] 2.2 Verify new models work with OpenAI provider adapter (test API compatibility)
- [x] 2.3 Confirm experiment framework can run new models alongside GPT-4o and Claude models
- [x] 2.4 Test that scoring/ranking logic works correctly with new model results

## 4. Run Model Comparison Experiments

- [x] 3.1 Run model experiment comparing GPT-5, GPT-4.1, Claude 4.6 Sonnet, Claude 4.5 Sonnet on Dynatrace sample
- [x] 3.2 Run experiments on remaining test images (Cosine, Amir)
- [x] 3.3 Experiments cover diverse handwriting samples (different styles, layouts, quality)
- [x] 3.4 Generate markdown reports for each experiment using --format=markdown --output=experiment-results/<name>.md
- [x] 3.5 Store experiment results in experiments directory for historical tracking (framework does this automatically)

## 5. Analyze Experiment Results

- [x] 4.1 Review accuracy scores across all experiments for each model
- [x] 4.2 Compare processing speed/latency across models  
- [x] 4.3 Calculate estimated costs based on token usage and model pricing
- [x] 4.4 Determine that GPT-4.1 shows best overall value, Claude 4.6 Sonnet has highest accuracy
- [x] 4.5 Document GPT-5 is surprisingly slow (2.5x slower than GPT-4.1), not recommended
- [x] 4.6 Consolidate experiment reports into model-analysis.md summary

## 6. Update Model Configuration and Recommendations

- [x] 5.1 Update default model recommendations in README based on experiment results
- [x] 5.2 Document GPT-4.1 as best value, Claude 4.6 Sonnet as highest accuracy, GPT-5 avoid
- [x] 5.3 Update configuration examples to use gpt-4.1 as default with alternatives
- [x] 5.4 Updated README with experiment-backed recommendations and warnings
- [x] 5.5 Cost information documented in experiment reports (estimation based)

## 7. Documentation and Knowledge Sharing

- [x] 6.1 Create summary report of experiment findings (model-testing-summary.md)
- [x] 6.2 Document experiment methodology and results in experiment-results/ directory
- [x] 6.3 Update model selection guidance in README with experiment-backed recommendations
- [x] 6.4 Add notes in summary about when to re-run experiments (model updates, new use cases)
