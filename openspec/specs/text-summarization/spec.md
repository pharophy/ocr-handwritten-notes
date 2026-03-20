## Purpose

The Text Summarization capability generates structured, actionable summaries from OCR-transcribed meeting notes, extracting action items, decisions, learnings, and contextual tags.

## Requirements

### Requirement: Meeting notes summarization
The system SHALL generate structured summaries from OCR-transcribed meeting notes using AI.

#### Scenario: Standard summary generation
- **WHEN** an OCR transcription is complete and the filename does not contain '_nosum'
- **THEN** the system SHALL generate a structured summary with five sections: Summary, Action Items, Key Learnings, Key Decisions, and Tags

### Requirement: Summary structure
The system SHALL produce summaries following a consistent five-section format.

#### Scenario: Summary section
- **WHEN** generating a summary
- **THEN** the Summary section SHALL contain a 3-5 sentence paragraph describing key themes from the meeting

#### Scenario: Action items section
- **WHEN** generating a summary
- **THEN** the Action Items section SHALL list actionable tasks as bullet points prefixed with "AI:"

#### Scenario: Key learnings section
- **WHEN** generating a summary
- **THEN** the Key Learnings section SHALL extract insights, takeaways, or important information learned during the meeting

#### Scenario: Key decisions section
- **WHEN** generating a summary
- **THEN** the Key Decisions section SHALL list final or important decisions made during the meeting

#### Scenario: Tags section
- **WHEN** generating a summary
- **THEN** the Tags section SHALL provide contextual hashtags (e.g., #Growth, #Planning, #Technical) relevant to the content

### Requirement: Summarization opt-out
The system SHALL allow users to skip summarization for specific images.

#### Scenario: No summary flag
- **WHEN** an image filename contains '_nosum' (e.g., 'notes_nosum.jpg')
- **THEN** the system SHALL generate only the OCR transcription file and skip summary generation

### Requirement: Summary output files
The system SHALL write summaries to separate markdown files with descriptive naming.

#### Scenario: Summary file creation
- **WHEN** summarization is complete for an image named '[filename].[ext]'
- **THEN** the system SHALL create '[filename] - Summary and Actions.md' in the same directory

#### Scenario: Summary file linking
- **WHEN** creating a summary file
- **THEN** the file SHALL include markdown links to the OCR transcription file and the original image

### Requirement: AI model usage for summarization
The system SHALL use GPT-4o-mini for cost-effective summary generation.

#### Scenario: Model selection
- **WHEN** generating a summary
- **THEN** the system SHALL use the 'gpt-4o-mini' model with temperature 0.3 for consistent results

### Requirement: Summary error handling
The system SHALL handle summarization failures gracefully without blocking OCR output.

#### Scenario: Summarization API failure
- **WHEN** the summarization API call fails
- **THEN** the system SHALL log the error and write 'Error generating summary.' to the summary file

#### Scenario: Empty summary response
- **WHEN** the API returns no content
- **THEN** the system SHALL write 'no summary' to the summary file

### Requirement: Summary clarity and conciseness
The system SHALL generate clear, concise summaries suitable for quick review.

#### Scenario: Summary brevity
- **WHEN** generating summaries
- **THEN** the output SHALL be concise and well-organized, focusing on actionable information and key points
