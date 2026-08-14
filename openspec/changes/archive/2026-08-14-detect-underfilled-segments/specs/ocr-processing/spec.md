## ADDED Requirements

### Requirement: Segment-level completeness detection
When a tall image is transcribed as multiple overlapping vertical segments, the system SHALL detect not only fully empty interior segments but also non-final segments that return substantially less text than their image area implies (a silent partial-transcription drop), and SHALL treat such a result as an incomplete transcription that triggers the configured OCR fallback model.

#### Scenario: Interior segment returns disproportionately little text
- **WHEN** a tall image is split into multiple vertical segments and a non-final segment returns a transcription whose text density (characters per pixel of that segment's height) is far below the median density of the other non-empty segments
- **THEN** the system SHALL mark the overall transcription as incomplete and trigger the configured OCR fallback model to re-transcribe the page

#### Scenario: Proportionally filled segments are not flagged
- **WHEN** every segment returns text roughly proportional to its image area
- **THEN** the system SHALL NOT mark the transcription incomplete on density grounds and SHALL NOT trigger the fallback for that reason

#### Scenario: Short trailing segment is not a false positive
- **WHEN** the final segment covers only a small sliver of trailing page space and therefore contains little text
- **THEN** the system SHALL NOT flag it as under-filled solely because it contains little text

#### Scenario: Insufficient segments to compare
- **WHEN** fewer than two segments contain any text
- **THEN** the system SHALL NOT flag any segment as under-filled and SHALL defer to the existing empty-content handling
