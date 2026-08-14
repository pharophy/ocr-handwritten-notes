## Purpose

The OCR Processing capability converts handwritten note images into accurate, structured markdown text while preserving layout, formatting, and visual elements.
## Requirements
### Requirement: Image preprocessing
The system SHALL preprocess handwritten images to enhance text clarity and readability before OCR processing, including automatic compression for oversized images.

#### Scenario: Standard image preprocessing
- **WHEN** a handwritten image is submitted for OCR processing
- **THEN** the image SHALL be converted to grayscale, resized to 1600px width, normalized for contrast and brightness, and sharpened

#### Scenario: Preprocessing with compression for large images
- **WHEN** a handwritten image is submitted for OCR processing and the preprocessed buffer exceeds 5MB
- **THEN** the image SHALL be automatically compressed using progressive quality reduction to meet the 5MB limit before being sent to the AI provider

### Requirement: Handwriting transcription accuracy
The system SHALL transcribe handwritten text with character-level fidelity, preserving all content without summarization or omission. The system SHALL support latest OpenAI models (GPT-5, GPT-4.1) and Claude models as options for handwriting recognition.

#### Scenario: Complete transcription
- **WHEN** a handwritten image is processed
- **THEN** every word, symbol, and punctuation mark SHALL be transcribed exactly as written

#### Scenario: Ambiguous characters
- **WHEN** a character or word is unclear or ambiguous in the handwriting
- **THEN** the system SHALL make a best-effort interpretation and mark it with *italics* for user review

#### Scenario: No content skipping
- **WHEN** processing any handwritten content
- **THEN** the system SHALL NOT skip, abbreviate, or summarize any portion of the handwritten text

#### Scenario: Latest model usage
- **WHEN** GPT-5, GPT-4.1, or other latest models are configured as the OCR model
- **THEN** the system SHALL use the specified model's vision capabilities for handwriting transcription with the same accuracy requirements

### Requirement: Layout detection and preservation
The system SHALL automatically detect the layout type of handwritten notes and preserve the original structure in the output.

#### Scenario: Table layout detection
- **WHEN** the image contains a visible grid with columns, rows, and headings
- **THEN** the system SHALL output valid Markdown table syntax with proper column separators and header rows

#### Scenario: Freeform notes layout
- **WHEN** the image contains unstructured notes with bullets, indentation, or arrows
- **THEN** the system SHALL preserve all indentation levels, bullet points, and visual hierarchy using Markdown formatting

#### Scenario: Mixed content layout
- **WHEN** the image contains both tables and freeform text
- **THEN** the system SHALL detect and format each section appropriately

### Requirement: Visual element notation
The system SHALL convert handwritten visual elements into appropriate text representations.

#### Scenario: Arrow notation
- **WHEN** handwritten notes contain arrows or directional indicators
- **THEN** the system SHALL represent them using the '→' character or descriptive text

#### Scenario: Circled or boxed items
- **WHEN** text is circled, boxed, or otherwise emphasized visually
- **THEN** the system SHALL mark these with appropriate indicators like '(circled)' or '[boxed]'

### Requirement: Capitalization preservation
The system SHALL preserve the original capitalization of handwritten text, especially for acronyms and proper nouns.

#### Scenario: All-caps text
- **WHEN** text is written in all capital letters
- **THEN** the system SHALL output it in all capitals, as these are often acronyms or emphasis

### Requirement: Output format compatibility
The system SHALL produce OCR output in valid Markdown format compatible with common markdown editors.

#### Scenario: Markdown compatibility
- **WHEN** OCR processing is complete
- **THEN** the output SHALL be valid GitHub-flavored Markdown without code blocks (no triple backticks) and compatible with editors like Obsidian

### Requirement: Image format support
The system SHALL process common image formats containing handwritten content.

#### Scenario: JPEG images
- **WHEN** a JPEG image (.jpg or .jpeg extension) is provided
- **THEN** the system SHALL process it for OCR

#### Scenario: PNG images
- **WHEN** a PNG image (.png extension) is provided
- **THEN** the system SHALL process it for OCR

### Requirement: Error handling
The system SHALL handle OCR processing errors gracefully without crashing.

#### Scenario: OCR API failure
- **WHEN** the OpenAI API call fails during OCR processing
- **THEN** the system SHALL log a clear error message and return null rather than crashing

#### Scenario: Invalid image data
- **WHEN** an image file cannot be read or processed
- **THEN** the system SHALL log an error and continue processing remaining images

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

