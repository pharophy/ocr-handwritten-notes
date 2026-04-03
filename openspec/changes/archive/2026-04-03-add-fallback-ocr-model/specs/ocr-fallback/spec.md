## ADDED Requirements

### Requirement: Fallback model configuration
The system SHALL support configuration of a fallback OCR model that is used when the primary model produces low-quality results.

#### Scenario: Fallback model from environment variable
- **WHEN** `AI_MODEL_OCR_FALLBACK` environment variable is set
- **THEN** the system SHALL use this model as the fallback when primary OCR quality is poor

#### Scenario: Default fallback model
- **WHEN** no fallback model is explicitly configured
- **THEN** the system SHALL use `gpt-4.1-mini` as the default fallback model

#### Scenario: Fallback disabled
- **WHEN** `AI_MODEL_OCR_FALLBACK` is set to empty string or "none"
- **THEN** the system SHALL not attempt fallback and return primary results regardless of quality

### Requirement: OCR quality detection
The system SHALL detect when primary OCR results are of poor quality and require fallback processing.

#### Scenario: High illegible marker count
- **WHEN** primary OCR transcription contains more than 30% illegible markers (`*[illegible]*`)
- **THEN** the system SHALL classify the result as poor quality and trigger fallback

#### Scenario: Excessive consecutive illegibles
- **WHEN** primary OCR transcription contains 5 or more consecutive illegible markers
- **THEN** the system SHALL classify the result as poor quality and trigger fallback

#### Scenario: Extremely short output
- **WHEN** primary OCR transcription is less than 50 characters for an image larger than 100KB
- **THEN** the system SHALL classify the result as poor quality and trigger fallback

#### Scenario: Good quality result
- **WHEN** primary OCR transcription has less than 30% illegible markers and reasonable length
- **THEN** the system SHALL accept the result without triggering fallback

### Requirement: Automatic fallback execution
The system SHALL automatically retry OCR with the fallback model when primary results are poor quality.

#### Scenario: Fallback after poor primary result
- **WHEN** primary OCR result is classified as poor quality and fallback model is configured
- **THEN** the system SHALL automatically call the fallback model with the same image and prompt

#### Scenario: Fallback result returned
- **WHEN** fallback OCR processing completes successfully
- **THEN** the system SHALL return the fallback result instead of the poor primary result

#### Scenario: Both models fail quality check
- **WHEN** both primary and fallback models produce poor quality results
- **THEN** the system SHALL return the fallback result (better than nothing) with a warning logged

#### Scenario: Fallback API error
- **WHEN** fallback model API call fails with an error
- **THEN** the system SHALL log the fallback error and return the original primary result

### Requirement: Model usage tracking
The system SHALL track and log which model (primary or fallback) was used for each transcription.

#### Scenario: Log primary model success
- **WHEN** primary OCR completes with good quality
- **THEN** the system SHALL log that primary model was used successfully

#### Scenario: Log fallback trigger reason
- **WHEN** fallback is triggered due to poor primary quality
- **THEN** the system SHALL log the specific quality issue (illegible %, consecutive illegibles, or short output)

#### Scenario: Log fallback model used
- **WHEN** fallback OCR is executed
- **THEN** the system SHALL log which fallback model was used and its quality assessment

### Requirement: Performance considerations
The system SHALL minimize unnecessary fallback calls to reduce API costs and processing time.

#### Scenario: Skip fallback when quality acceptable
- **WHEN** primary OCR result meets minimum quality thresholds
- **THEN** the system SHALL NOT call the fallback model

#### Scenario: Cache quality thresholds
- **WHEN** system initializes
- **THEN** quality threshold values SHALL be read from configuration once and cached

### Requirement: Configurable quality thresholds
The system SHALL allow customization of quality detection thresholds through environment variables.

#### Scenario: Custom illegible threshold
- **WHEN** `OCR_ILLEGIBLE_THRESHOLD` environment variable is set (e.g., "0.4" for 40%)
- **THEN** the system SHALL use this threshold instead of the default 30%

#### Scenario: Custom consecutive illegible threshold
- **WHEN** `OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD` environment variable is set (e.g., "3")
- **THEN** the system SHALL use this threshold instead of the default 5

#### Scenario: Custom minimum length threshold
- **WHEN** `OCR_MIN_LENGTH_THRESHOLD` environment variable is set (e.g., "100")
- **THEN** the system SHALL use this threshold instead of the default 50 characters
