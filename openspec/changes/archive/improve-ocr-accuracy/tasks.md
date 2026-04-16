## 1. Testing Infrastructure

- [x] 1.1 Create src/ocrTester.ts with test harness structure and test case discovery logic
- [x] 1.2 Implement character-level comparison using Levenshtein distance algorithm
- [x] 1.3 Implement word-level comparison with precision, recall, and F1 score calculations
- [x] 1.4 Implement line-level diff comparison with unified diff formatting
- [x] 1.5 Add test execution function that processes image and compares against expected output
- [x] 1.6 Formalize test-images/ directory structure with README documenting test case format

## 2. Quality Assessment Enhancement

- [x] 2.1 Update assessOCRQuality() to detect italic markers with pattern `/\*([^[\]]+?)\*/g`
- [x] 2.2 Count both *[illegible]* markers and *word* italics as uncertainties
- [x] 2.3 Update quality metrics to report illegible count and italic count separately
- [x] 2.4 Tune fallback threshold based on italic detection (test with current output ~40% italics)
- [x] 2.5 Add environment variable OCR_LEGACY_QUALITY_CHECK to revert to old behavior if needed

## 3. Baseline Measurement and Tracking

- [x] 3.1 Run OCR on Dynatrace Q2 04-09 with current model (Claude 4.6 Sonnet) and capture output
- [x] 3.2 Run ocrTester to establish baseline metrics (character accuracy, word F1, italic percentage, processing time)
- [x] 3.3 Create test-results/ directory structure for storing baseline and historical test results
- [x] 3.4 Store baseline in test-results/baseline.json with: model name, timestamp, accuracy metrics, cost estimate, latency
- [x] 3.5 Implement comparison logic to show deltas against baseline (e.g., "+5% accuracy, +$0.02 cost, +2s latency")
- [x] 3.6 Verify fallback triggers correctly with new italic detection on poor quality output
- [x] 3.7 Add mechanism to update baseline when better configuration is validated and adopted

**Note:** Baseline established with Claude Sonnet (90.47% accuracy). Experiments 001-003 completed showing GPT-5 Mini as winner (91.2% accuracy, +0.9% improvement, -83% cost reduction).

## 4. Unified Experimentation Framework

- [x] 4.1 Create src/ocrExperiment.ts with unified experiment runner structure supporting model, prompt, preprocessing, and combined experiments
- [x] 4.2 Implement experiment type selection (--type=model, --type=prompt, --type=preprocessing, --type=combined)
- [x] 4.3 Implement multi-configuration test execution (run same image through multiple configurations)
- [x] 4.4 Add support for model variations (Claude Opus, GPT-4o, GPT-4 Vision) via AI provider abstraction
- [x] 4.5 Add support for prompt variations (baseline, verbose, concise, with/without glossary, etc.)
- [x] 4.6 Add support for preprocessing variations (sharpening levels, contrast, denoising)
- [x] 4.7 Implement tabular comparison report with columns: Configuration, Accuracy %, Word F1, Cost, Latency, Italic Count, Score
- [x] 4.8 Implement scoring algorithm with configurable weights (default: accuracy 70%, cost 15%, latency 15%)
- [x] 4.9 Implement recommendation logic that selects highest scoring configuration with rationale explanation
- [x] 4.10 Add environment variable overrides (OCR_EXPERIMENT_TYPE, OCR_EXPERIMENT_CONFIGS, OCR_SCORE_WEIGHTS)
- [x] 4.11 Support matrix experiments testing all combinations (e.g., 3 models × 2 prompts = 6 runs)

## 5. Systematic Model Testing

- [x] 5.1 Run Dynatrace test through Claude 4.6 Sonnet (baseline - experiment 003)
- [x] 5.2 Run Dynatrace test through Claude 4.6 Opus (experiment 003: 90.2% accuracy)
- [x] 5.3 Run Dynatrace test through GPT-5 and GPT-5 Mini (experiment 003: GPT-5 Mini won with 91.2%)
- [x] 5.4 Run Dynatrace test through GPT-4.1 and GPT-4.1 Mini (experiment 003)
- [x] 5.5 Compare results and identify best performing model for this handwriting style (GPT-5 Mini: 91.2%, $0.02, score 75.7)
- [x] 5.6 Document findings and update default/fallback model configuration (see experiments/003-hai-proxy-compatible/findings.md)

**Note:** Experiments 001-003 completed. GPT-5 Mini identified as winner (91.2% accuracy, $0.02/image, 83% cost savings vs Claude Sonnet). Configuration updated to use GPT-5 Mini with GPT-4.1 Mini fallback.

## 6. Analysis and Strategy Review

- [x] 6.1 Analyze experiment results from all tested models (completed in experiments/003-hai-proxy-compatible/findings.md)
- [x] 6.2 Identify patterns in failures: formatting preservation is main issue (indentation collapse)
- [x] 6.3 Review specific error examples: character accuracy high (91%), word F1 low (0.58) due to structure not content
- [x] 6.4 Document findings: GPT-5 Mini best, mini models outperform full models, formatting vs content accuracy gap
- [x] 6.5 Propose additional improvement strategies: prompt engineering for formatting, preprocessing, multi-pass OCR, ensemble methods (see EXPERIMENTS.md future work)
- [x] 6.6 Prioritize proposed improvements: prompt engineering highest priority (low effort, high impact)
- [x] 6.7 Create follow-on tasks: experiments/README.md documents future experiment ideas (004-prompt-formatting, 005-preprocessing, etc.)

**Note:** Analysis complete. Key findings: (1) Mini models outperform full models, (2) Formatting vs content accuracy gap, (3) GPT-5 Mini 91.2% with 83% cost reduction. Future experiments documented in experiments/README.md and EXPERIMENTS.md.

## 7. Test Reporting

- [x] 7.1 Implement console test output formatter with pass/fail indicators and metrics
- [x] 7.2 Implement detailed unified diff output for failed test cases
- [x] 7.3 Add Markdown report generation for batch test results
- [x] 7.4 Add accuracy threshold checking with configurable thresholds via env vars
- [x] 7.5 Implement batch test execution for running all test cases in test-images/

## 8. CLI Integration

- [x] 8.1 Add npm script for running single test case (npm run test-ocr <image-path>)
- [x] 8.2 Add npm script for running full test suite (npm run test-ocr-suite)
- [x] 8.3 Add npm script for running model experiments (npm run experiment-ocr <image-path>)
- [x] 8.4 Add command-line options for output format (console, markdown, json)
- [x] 8.5 Add command-line option for specifying models to test in experiments

## 9. Domain Glossary Population

- [x] 9.1 Add Dynatrace/infrastructure acronyms to handwriting-reference.json (BTP, DT, SPN, K8s, ArgoCD, CAM, CIC, RGM, EDE, PoC, Kyma, e2e)
- [x] 9.2 Add infrastructure proper nouns (Dynatrace, Vault, Azure, JIRA, Pruthvi)
- [x] 9.3 Add infrastructure business terms (service binding, multi-values file, orphan instance)
- [x] 9.4 Re-run test with updated glossary to measure marginal improvement (completed in experiments)
- [x] 9.5 Document glossary curation process for adding domain-specific terms

**Note:** Glossary populated and tested through experiments. See docs/guides/glossary-curation.md

## 10. Experiment Result Persistence

- [x] 10.1 Implement experiment result storage in JSON format
- [x] 10.2 Store model name, accuracy metrics, timestamp, and configuration for each experiment
- [x] 10.3 Add experiment history viewer to show trends over time
- [x] 10.4 Implement cost estimation based on model pricing and token usage
- [x] 10.5 Add cost-accuracy tradeoff metrics to experiment reports

## 11. Documentation

- [x] 11.1 Update README with testing framework usage instructions
- [x] 11.2 Document how to add new test cases with expected outputs
- [x] 11.3 Document model experimentation workflow and interpretation of results
- [x] 11.4 Create troubleshooting guide for low OCR accuracy with model recommendations
- [x] 11.5 Document all OCR-related environment variables including experiment controls
