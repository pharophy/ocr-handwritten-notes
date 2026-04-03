## Purpose

The OCR Quality Assessment capability evaluates the quality of OCR transcription output using multiple metrics to determine if the result is acceptable or requires fallback to an alternative model.

## ADDED Requirements

### Requirement: Illegible marker detection
The system SHALL count illegible markers (*[illegible]*) in OCR output and calculate the percentage relative to total words transcribed.

#### Scenario: Counting illegible markers
- **WHEN** OCR output contains *[illegible]* markers
- **THEN** the system SHALL count each marker as a single unit and calculate illegible percentage as (illegible_count / total_words) * 100

#### Scenario: Total word calculation
- **WHEN** calculating total words for quality assessment
- **THEN** the system SHALL count illegible markers plus normal words (after removing markers and splitting on whitespace and punctuation)

### Requirement: Consecutive illegible detection
The system SHALL detect sequences of consecutive illegible markers indicating systematic transcription failure.

#### Scenario: Detecting consecutive failures
- **WHEN** OCR output contains 5 or more consecutive *[illegible]* markers (with only whitespace between them)
- **THEN** the system SHALL count this as one consecutive illegible occurrence

#### Scenario: Multiple consecutive sequences
- **WHEN** OCR output contains multiple sequences of 5+ consecutive illegible markers
- **THEN** the system SHALL count each sequence separately

### Requirement: Output length assessment
The system SHALL evaluate whether OCR output length is appropriate for the input image size.

#### Scenario: Short output for large image
- **WHEN** OCR output is less than 50 characters AND the input image is larger than 100KB
- **THEN** the quality assessment SHALL flag this as potentially poor quality

#### Scenario: Appropriate output length
- **WHEN** OCR output length is proportional to image size
- **THEN** the quality assessment SHALL not flag length as an issue

### Requirement: Configurable quality thresholds
The system SHALL support configurable thresholds for all quality metrics via environment variables.

#### Scenario: Illegible percentage threshold
- **WHEN** OCR_ILLEGIBLE_THRESHOLD environment variable is set
- **THEN** the system SHALL use that value as the threshold percentage (default: 15)

#### Scenario: Consecutive illegible threshold
- **WHEN** OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD environment variable is set
- **THEN** the system SHALL use that value as the minimum number of consecutive sequences to trigger poor quality (default: 1)

#### Scenario: Minimum length threshold
- **WHEN** OCR_MIN_LENGTH_THRESHOLD environment variable is set
- **THEN** the system SHALL use that value as the minimum acceptable output length (default: 50)

#### Scenario: Minimum image size threshold
- **WHEN** OCR_MIN_IMAGE_SIZE environment variable is set
- **THEN** the system SHALL use that value as the image size above which length matters (default: 100000 bytes)

### Requirement: Quality decision output
The system SHALL return a structured quality assessment with metrics and clear decision on whether quality is poor.

#### Scenario: Quality assessment output
- **WHEN** quality assessment completes
- **THEN** the system SHALL return isPoorQuality boolean, illegiblePercent, consecutiveIllegibles count, outputLength, and optional reason string

#### Scenario: Poor quality with reason
- **WHEN** quality is determined to be poor based on any threshold
- **THEN** the system SHALL include a human-readable reason explaining which threshold was exceeded and by how much

### Requirement: Multi-criteria quality evaluation
The system SHALL consider all quality metrics and fail on the first criterion that exceeds its threshold.

#### Scenario: High illegible percentage
- **WHEN** illegible percentage exceeds the threshold (default 15%)
- **THEN** the system SHALL mark quality as poor with reason indicating the percentage and threshold

#### Scenario: Consecutive illegible markers
- **WHEN** consecutive illegible occurrences meet or exceed threshold (default 1)
- **THEN** the system SHALL mark quality as poor with reason indicating the count and threshold

#### Scenario: Insufficient output length
- **WHEN** output length is below minimum AND image size is above minimum
- **THEN** the system SHALL mark quality as poor with reason indicating output length, image size, and threshold

#### Scenario: Passing all quality checks
- **WHEN** all quality metrics are within acceptable ranges
- **THEN** the system SHALL mark isPoorQuality as false with no reason
