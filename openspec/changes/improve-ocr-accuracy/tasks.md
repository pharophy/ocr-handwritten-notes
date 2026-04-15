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

**Note:** Baseline established but shows format mismatch issue (12.5% character accuracy). Expected output verification needed before proceeding with model comparisons.

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

- [ ] 5.1 Run Dynatrace test through Claude 4.6 Sonnet (baseline - already done)
- [ ] 5.2 Run Dynatrace test through Claude 4.6 Opus
- [ ] 5.3 Run Dynatrace test through GPT-4o
- [ ] 5.4 Run Dynatrace test through GPT-4 Vision
- [ ] 5.5 Compare results and identify best performing model for this handwriting style
- [ ] 5.6 Document findings and update default/fallback model configuration if better option found

## 6. Analysis and Strategy Review

- [ ] 6.1 Analyze experiment results from all tested models (Claude Opus, GPT-4o, GPT-4 Vision, baseline)
- [ ] 6.2 Identify patterns in failures: which types of handwriting are problematic across all models?
- [ ] 6.3 Review specific error examples to understand root causes (illegible writing vs model limitations vs preprocessing issues)
- [ ] 6.4 Document findings: best performing model, accuracy gaps, common failure patterns
- [ ] 6.5 Propose additional improvement strategies based on findings (preprocessing optimization, prompt engineering, hybrid approaches, multi-pass OCR, ensemble methods, etc.)
- [ ] 6.6 Prioritize proposed improvements by expected impact and implementation effort
- [ ] 6.7 Create follow-on tasks or new OpenSpec change for pursuing high-impact improvements toward 90-100% accuracy goal

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
- [ ] 8.4 Add command-line options for output format (console, markdown, json)
- [ ] 8.5 Add command-line option for specifying models to test in experiments

## 9. Domain Glossary Population

- [x] 9.1 Add Dynatrace/infrastructure acronyms to handwriting-reference.json (BTP, DT, SPN, K8s, ArgoCD, CAM, CIC, RGM, EDE, PoC, Kyma, e2e)
- [x] 9.2 Add infrastructure proper nouns (Dynatrace, Vault, Azure, JIRA, Pruthvi)
- [x] 9.3 Add infrastructure business terms (service binding, multi-values file, orphan instance)
- [ ] 9.4 Re-run test with updated glossary to measure marginal improvement
- [x] 9.5 Document glossary curation process for adding domain-specific terms

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
