## MODIFIED Requirements

### Requirement: Summary structure
The system SHALL produce summaries following a consistent five-section format. The summary SHALL be generated only from the transcription text, never from an appended OCR validation report, and SHALL ignore struck-out text.

#### Scenario: Summary section
- **WHEN** generating a summary
- **THEN** the Summary section SHALL contain a 3-5 sentence paragraph describing key themes from the meeting

#### Scenario: Action items section
- **WHEN** generating a summary
- **THEN** the Action Items section SHALL list actionable tasks as bullet points prefixed with "AI:"

#### Scenario: Struck-out action items excluded
- **WHEN** an `AI:` line in the transcription is wrapped in `~~` strikethrough markers
- **THEN** it SHALL NOT appear in the Action Items section

#### Scenario: Key learnings section
- **WHEN** generating a summary
- **THEN** the Key Learnings section SHALL extract insights, takeaways, or important information learned during the meeting

#### Scenario: Key decisions section
- **WHEN** generating a summary
- **THEN** the Key Decisions section SHALL list only decisions the notes explicitly record as decided, and SHALL NOT restate discussion points, proposals, or open questions as decisions

#### Scenario: No explicit decisions
- **WHEN** the notes record no explicit decision
- **THEN** the Key Decisions section SHALL contain exactly "No explicit decisions recorded."

#### Scenario: Tags section
- **WHEN** generating a summary
- **THEN** the Tags section SHALL provide contextual hashtags (e.g., #Growth, #Planning, #Technical) relevant to the content

#### Scenario: Validation report excluded from summary input
- **WHEN** the OCR output file includes an appended "OCR Validation Report" or correction log
- **THEN** the text passed to the summarizer SHALL contain only the transcription, without the navigation link line, the report, or the correction log
