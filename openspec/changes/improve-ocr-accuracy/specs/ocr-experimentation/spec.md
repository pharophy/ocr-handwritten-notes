## Purpose

The OCR Experimentation capability provides utilities for systematically testing different AI vision models, preprocessing parameters, and prompt strategies to identify optimal configurations for handwriting transcription accuracy.

## ADDED Requirements

### Requirement: Model comparison framework
The system SHALL support running the same OCR test against multiple AI vision models to compare accuracy.

#### Scenario: Multi-model test execution
- **WHEN** running an experiment with multiple models specified
- **THEN** the system SHALL process the same test image through each model and collect results

#### Scenario: Model selection
- **WHEN** configuring an experiment
- **THEN** the system SHALL support testing Claude models (Opus 4.6, Sonnet 4.6) and OpenAI models (GPT-5, GPT-5 Mini, GPT-4.1, GPT-4.1 Mini) via HAI proxy
- **NOTE** HAI proxy supported models as of 2026-04-16:
  - Claude: anthropic--claude-4.6-sonnet, anthropic--claude-4.6-opus
  - OpenAI: gpt-5, gpt-5-mini, gpt-4.1, gpt-4.1-mini
- **NOTE** Models NOT available through HAI proxy: gpt-4o, gpt-4-vision-preview

#### Scenario: Tabular comparison report
- **WHEN** a multi-model experiment completes
- **THEN** the system SHALL generate a comparison table showing each model with: accuracy metrics (character %, word F1), cost per image, latency, italic count, and an overall score

#### Scenario: Model scoring and ranking
- **WHEN** displaying experiment results
- **THEN** the system SHALL compute an overall score for each model based on weighted factors (accuracy: 70%, cost: 15%, latency: 15%) and rank models from best to worst

#### Scenario: Model recommendation
- **WHEN** experiment results are displayed
- **THEN** the system SHALL provide a clear recommendation for which model to use with rationale (e.g., "Best: GPT-5 Mini - highest accuracy (91.2%) with best cost/latency tradeoff")
- **AND** SHALL show comparison vs other tested models with delta metrics
- **AND** SHALL include key metrics: accuracy, word F1, cost, latency, italics percentage

### Requirement: Baseline measurement
The system SHALL establish baseline accuracy measurements for the current OCR configuration before experimentation.

#### Scenario: Baseline capture
- **WHEN** running an experiment for the first time on a test case
- **THEN** the system SHALL capture and store baseline accuracy metrics with the current model configuration

#### Scenario: Improvement tracking
- **WHEN** comparing experiment results to baseline
- **THEN** the system SHALL show percentage improvement or regression for each metric

### Requirement: Experiment configuration
The system SHALL support configurable experiment parameters via environment variables and command-line options.

#### Scenario: Experiment type selection
- **WHEN** running experiments
- **THEN** the system SHALL support experiment types: `model`, `prompt`, `preprocessing`, `combined`
- **AND** SHALL allow type selection via `--type=<type>` command-line option

#### Scenario: Model override
- **WHEN** an experiment specifies model names via configuration
- **THEN** the system SHALL use those models instead of the default OCR model
- **AND** SHALL support model selection via `--models=<model1>,<model2>` command-line option

#### Scenario: Batch experiment execution
- **WHEN** running experiments across multiple test cases
- **THEN** the system SHALL process all test cases with all specified models and aggregate results

#### Scenario: Scoring weight configuration
- **WHEN** users have different priorities (cost-sensitive vs accuracy-focused)
- **THEN** the system SHALL support customizing scoring weights via:
  - Environment variable: `OCR_SCORE_WEIGHTS=0.7,0.15,0.15` (accuracy, cost, latency)
  - Command-line option: `--weights=0.8,0.1,0.1`
- **DEFAULT** weights: accuracy=0.7, cost=0.15, latency=0.15

#### Scenario: CLI implementation
- **WHEN** running experiments
- **THEN** the system SHALL:
  - Load environment variables via dotenv for configuration
  - Use npm script: `npm run experiment-ocr <image-path> -- [options]`
  - Support output format selection: `--format=console|json|markdown`
  - Support result storage: `--output=<file>`

### Requirement: Preprocessing experimentation
The system SHALL support testing different image preprocessing parameters using the same experimentation framework with tabular comparison and scoring.

#### Scenario: Preprocessing parameter variations
- **WHEN** an experiment specifies preprocessing variations (sharpening levels, contrast adjustments, grayscale conversion methods, denoising)
- **THEN** the system SHALL apply each variation, run OCR, and compare results using the same tabular report and scoring as model experiments

#### Scenario: Preprocessing comparison
- **WHEN** comparing preprocessing variations
- **THEN** the system SHALL identify which preprocessing configuration yields best score combining accuracy, cost, and latency

#### Scenario: Multi-dimensional experiments
- **WHEN** users want to test combinations of models, prompts, and preprocessing
- **THEN** the system SHALL support running comprehensive experiments across all dimensions and presenting results in comparative tables

### Requirement: Prompt strategy testing
The system SHALL support testing different prompt engineering approaches using the same experimentation framework as model comparison.

#### Scenario: Prompt variation experiments
- **WHEN** an experiment specifies multiple prompt strategies
- **THEN** the system SHALL run OCR with each prompt variant using the same model and compare accuracy with the same tabular report, scoring, and recommendation format

#### Scenario: Prompt template management
- **WHEN** defining prompt variations
- **THEN** the system SHALL support template-based prompts with variable substitution for experimentation (e.g., with/without glossary, different confusion pattern hints, varying instruction specificity)

#### Scenario: Combined model and prompt experiments
- **WHEN** testing both model variations and prompt variations
- **THEN** the system SHALL support matrix experiments testing all combinations (e.g., 3 models × 2 prompt styles = 6 test runs) with comparative scoring across all dimensions

### Requirement: Experiment result persistence
The system SHALL save experiment results for later analysis and comparison.

#### Scenario: Result storage format
- **WHEN** an experiment completes
- **THEN** the system SHALL save results to `test-results/experiments/` directory
- **AND** SHALL use filename format: `<test-name>-<experiment-type>-<timestamp>.json`
- **AND** SHALL include: model name, accuracy metrics, timestamp, configuration, cost estimate, processing time

#### Scenario: Result storage
- **WHEN** an experiment completes
- **THEN** the system SHALL save results including model name, accuracy metrics, timestamp, and configuration to a structured JSON format

#### Scenario: Historical comparison
- **WHEN** viewing experiment history
- **THEN** the system SHALL display trends showing how accuracy has changed across different configurations over time
- **AND** SHALL persist experiment results for future reference

### Requirement: Cost tracking
The system SHALL estimate API costs for different model combinations to inform model selection decisions.

#### Scenario: Cost estimation
- **WHEN** running experiments with different models
- **THEN** the system SHALL estimate approximate API costs based on model pricing and token usage

#### Scenario: Cost-accuracy tradeoff
- **WHEN** comparing experiment results
- **THEN** the system SHALL show cost-per-accurate-word metrics to help identify cost-effective configurations
