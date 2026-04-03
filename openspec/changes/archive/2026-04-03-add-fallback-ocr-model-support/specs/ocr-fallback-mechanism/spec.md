## Purpose

The OCR Fallback Mechanism capability provides automatic retry logic that switches to an alternative AI model when primary OCR output quality is determined to be poor, maximizing transcription success rates across different handwriting styles and complexities.

## ADDED Requirements

### Requirement: Automatic fallback trigger
The system SHALL automatically trigger fallback to a secondary model when primary OCR quality assessment indicates poor results.

#### Scenario: Poor quality triggers fallback
- **WHEN** primary OCR quality assessment returns isPoorQuality=true AND fallback model is configured
- **THEN** the system SHALL automatically retry OCR using the configured fallback model

#### Scenario: Good quality skips fallback
- **WHEN** primary OCR quality assessment returns isPoorQuality=false
- **THEN** the system SHALL return the primary result without attempting fallback

#### Scenario: No fallback configured
- **WHEN** primary OCR quality is poor BUT no fallback model is configured (empty or 'none')
- **THEN** the system SHALL return the primary result without attempting fallback

### Requirement: Fallback model configuration
The system SHALL support configuration of a fallback model via AI_MODEL_OCR_FALLBACK environment variable.

#### Scenario: Fallback model specified
- **WHEN** AI_MODEL_OCR_FALLBACK is set to a valid model name
- **THEN** the system SHALL use that model for fallback attempts

#### Scenario: Fallback disabled with 'none'
- **WHEN** AI_MODEL_OCR_FALLBACK is set to 'none' or empty string
- **THEN** the system SHALL not attempt fallback regardless of primary quality

#### Scenario: Cross-provider fallback
- **WHEN** primary model is Claude (anthropic--*) AND fallback is OpenAI (gpt-*)
- **THEN** the system SHALL successfully switch providers and complete fallback

#### Scenario: Reverse cross-provider fallback
- **WHEN** primary model is OpenAI (gpt-*) AND fallback is Claude (anthropic--*)
- **THEN** the system SHALL successfully switch providers and complete fallback

### Requirement: Provider switching for fallback
The system SHALL automatically configure the correct provider type and endpoint for the fallback model.

#### Scenario: HAI proxy handles both providers
- **WHEN** using HAI proxy AND fallback model is different provider than primary
- **THEN** the system SHALL use the same HAI proxy with model-based endpoint routing

#### Scenario: Direct OpenAI to Claude fallback
- **WHEN** using direct OpenAI AND fallback model is Claude (anthropic--*)
- **THEN** the system SHALL switch to HAI proxy at configured port for Claude access

#### Scenario: Same provider fallback
- **WHEN** fallback model uses the same provider as primary
- **THEN** the system SHALL use the same provider configuration with different model

### Requirement: Fallback quality assessment
The system SHALL assess the quality of fallback OCR output using the same quality metrics as primary.

#### Scenario: Fallback quality evaluation
- **WHEN** fallback OCR completes
- **THEN** the system SHALL run quality assessment on fallback output and log the results

#### Scenario: Both models produce poor quality
- **WHEN** both primary and fallback outputs are assessed as poor quality
- **THEN** the system SHALL return the fallback result with a warning logged

### Requirement: Fallback result priority
The system SHALL always return the fallback result when fallback is triggered, regardless of fallback quality assessment.

#### Scenario: Fallback result returned
- **WHEN** fallback OCR completes successfully
- **THEN** the system SHALL return the fallback result regardless of its quality metrics

#### Scenario: Fallback API failure
- **WHEN** fallback model API call fails
- **THEN** the system SHALL return the primary result with error logged

### Requirement: Model tracking in results
The system SHALL track and return information about which model(s) were used for OCR.

#### Scenario: Primary model success
- **WHEN** primary OCR succeeds and fallback is not triggered
- **THEN** the system SHALL return modelUsed as the primary model name

#### Scenario: Fallback model success
- **WHEN** fallback is triggered and succeeds
- **THEN** the system SHALL return modelUsed as fallback model name with annotation indicating fallback (e.g., "gpt-4.1-mini (fallback from anthropic--claude-4.6-sonnet)")

#### Scenario: Fallback failure returns primary
- **WHEN** fallback is triggered but fails
- **THEN** the system SHALL return modelUsed as primary model name with annotation "(primary, fallback failed)"

### Requirement: Fallback monitoring and logging
The system SHALL log detailed information about fallback triggers, quality assessments, and results.

#### Scenario: Quality assessment logging
- **WHEN** primary quality assessment completes
- **THEN** the system SHALL log illegiblePercent, consecutiveIllegibles, outputLength, and isPoorQuality

#### Scenario: Fallback trigger logging
- **WHEN** fallback is triggered due to poor quality
- **THEN** the system SHALL log the reason and the fallback model being used

#### Scenario: Fallback completion logging
- **WHEN** fallback OCR completes
- **THEN** the system SHALL log the fallback model success, quality assessment results, and comparison with primary

#### Scenario: Fallback error logging
- **WHEN** fallback API call fails
- **THEN** the system SHALL log the error details and indicate primary result is being returned

### Requirement: Prompt consistency
The system SHALL use identical OCR prompts for both primary and fallback models to ensure fair comparison.

#### Scenario: Same prompt for fallback
- **WHEN** fallback OCR is triggered
- **THEN** the system SHALL use the exact same system prompt, user prompt, and preprocessed image as the primary attempt

#### Scenario: Same preprocessing for fallback
- **WHEN** fallback OCR is triggered
- **THEN** the system SHALL reuse the same preprocessed image buffer from primary attempt rather than reprocessing
