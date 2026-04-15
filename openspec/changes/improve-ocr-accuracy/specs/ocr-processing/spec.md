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

#### Scenario: Fallback triggering
- **WHEN** the percentage of uncertain words (illegible + italic) exceeds the configured threshold
- **THEN** the system SHALL trigger fallback OCR processing with an alternative AI model

#### Scenario: Quality metrics reporting
- **WHEN** assessing OCR quality
- **THEN** the system SHALL report both illegible marker count and italic uncertainty count separately for diagnostic purposes
