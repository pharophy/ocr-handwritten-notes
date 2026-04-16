## Purpose

Updates to OCR Processing capability to improve quality assessment and fallback triggering by recognizing italicized uncertainties as accuracy failures.

## MODIFIED Requirements

### Requirement: OCR quality assessment
The system SHALL assess OCR transcription quality by detecting both explicit illegible markers and italicized uncertainties to determine if fallback processing is needed.

#### Scenario: Illegible marker detection
- **WHEN** OCR output contains *[illegible]* markers
- **THEN** the system SHALL count these as quality issues for fallback determination

#### Scenario: Italic uncertainty detection
- **WHEN** OCR output contains words marked with single asterisks indicating uncertainty (e.g., *word*)
- **THEN** the system SHALL count these as quality issues equivalent to illegible markers
- **AND** the system SHALL use the pattern `/\*([^[\]]+?)\*/g` to detect italic markers
- **AND** the system SHALL exclude *[illegible]* markers from the italic count to avoid double-counting

#### Scenario: Combined uncertainty threshold
- **WHEN** assessing OCR quality
- **THEN** the system SHALL calculate total uncertainty as: `uncertainPercent = illegiblePercent + italicPercent`
- **AND** the system SHALL trigger fallback when `uncertainPercent > 30%` (configurable via OCR_UNCERTAIN_THRESHOLD)

#### Scenario: Fallback triggering
- **WHEN** the percentage of uncertain words (illegible + italic) exceeds the configured threshold (default: 30%)
- **THEN** the system SHALL trigger fallback OCR processing with an alternative AI model
- **OR** when 5+ consecutive illegible markers are detected (configurable via OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD)
- **OR** when output length is very short (<50 chars) for large images (>100KB)

#### Scenario: Quality metrics reporting
- **WHEN** assessing OCR quality
- **THEN** the system SHALL report:
  - `illegiblePercent` - percentage of *[illegible]* markers
  - `italicPercent` - percentage of *word* italic uncertainties
  - `uncertainPercent` - combined illegible + italic percentage
  - `consecutiveIllegibles` - count of consecutive illegible marker sequences
  - `outputLength` - total character count
  - `isPoorQuality` - boolean indicating if fallback should trigger
  - `reason` - human-readable explanation of why quality is poor (if applicable)

#### Scenario: Legacy quality check toggle
- **WHEN** OCR_LEGACY_QUALITY_CHECK environment variable is set to "true"
- **THEN** the system SHALL disable italic detection and use only illegible markers with the original 15% threshold
- **PURPOSE** to allow reverting to previous behavior if italic detection causes issues
