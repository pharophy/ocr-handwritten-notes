## MODIFIED Requirements

### Requirement: Handwriting transcription accuracy
The system SHALL transcribe handwritten text with character-level fidelity, preserving all content without summarization or omission. The system SHALL support latest OpenAI models (GPT-5, GPT-4.1) and Claude models as options for handwriting recognition. The OCR prompt SHALL NOT forbid uncertainty markers, because the quality assessment depends on them.

#### Scenario: Complete transcription
- **WHEN** a handwritten image is processed
- **THEN** every word, symbol, and punctuation mark SHALL be transcribed exactly as written

#### Scenario: Ambiguous characters
- **WHEN** a character or word is unclear or ambiguous in the handwriting
- **THEN** the system SHALL make a best-effort interpretation and mark it with *italics* for user review

#### Scenario: OCR prompt requests uncertainty markers
- **WHEN** the OCR prompt is built for any image or segment and uncertainty markers are enabled (env `OCR_UNCERTAINTY_MARKERS`, default `true`)
- **THEN** it SHALL instruct the model to wrap words it cannot read confidently in `*italics*` and SHALL NOT contain an instruction to avoid italics or uncertainty markers

#### Scenario: Uncertainty markers disabled
- **WHEN** `OCR_UNCERTAINTY_MARKERS` is `false`
- **THEN** the prompt SHALL NOT request italic markers, and quality assessment SHALL rely on the completeness signals only

#### Scenario: No content skipping
- **WHEN** processing any handwritten content
- **THEN** the system SHALL NOT skip, abbreviate, or summarize any portion of the handwritten text

#### Scenario: Struck-out text
- **WHEN** handwritten text has been crossed out or struck through
- **THEN** the system SHALL transcribe it wrapped in `~~` strikethrough markers rather than as normal text, and SHALL NOT omit it

#### Scenario: Latest model usage
- **WHEN** GPT-5, GPT-4.1, or other latest models are configured as the OCR model
- **THEN** the system SHALL use the specified model's vision capabilities for handwriting transcription with the same accuracy requirements

### Requirement: Layout detection and preservation
The system SHALL automatically detect the layout type of handwritten notes and preserve the original structure in the output. Line breaks and indentation in the output SHALL consistently follow the handwritten notes, including across vertical segment boundaries.

#### Scenario: Table layout detection
- **WHEN** the image contains a visible grid with columns, rows, and headings
- **THEN** the system SHALL output valid Markdown table syntax with proper column separators and header rows

#### Scenario: Freeform notes layout
- **WHEN** the image contains unstructured notes with bullets, indentation, or arrows
- **THEN** the system SHALL preserve all indentation levels, bullet points, and visual hierarchy using Markdown formatting

#### Scenario: Each bullet on its own line
- **WHEN** the notes contain a bullet with nested sub-bullets
- **THEN** the parent and each sub-bullet SHALL each be output on their own line, and a more deeply indented bullet SHALL NOT be merged into its parent's line

#### Scenario: Wrapped bullet joined
- **WHEN** a single handwritten bullet continues onto the next physical line without a new bullet marker, and the continuation line is indented deeper than that bullet's marker
- **THEN** the continuation SHALL be joined onto that bullet's line with a single space, so no bullet is split by a mid-sentence line break

#### Scenario: Unindented label not joined
- **WHEN** a line with no bullet marker directly follows a bullet but is indented at or left of that bullet's marker (for example a label such as a year or "Notes:")
- **THEN** it SHALL stay on its own line and SHALL NOT be joined onto the bullet

#### Scenario: Consistent indentation unit
- **WHEN** the output contains nested bullets
- **THEN** each nesting level SHALL be indented by exactly one consistent unit (two spaces per level) relative to its parent, regardless of how many spaces the model returned

#### Scenario: Blank lines between blocks preserved
- **WHEN** the notes separate blocks of content with vertical space
- **THEN** the output SHALL keep a blank line between those blocks, including where the separation falls at a segment join

#### Scenario: Indentation preserved across segments
- **WHEN** a tall image is split into segments and a segment begins partway through a nested list
- **THEN** the lines from that segment SHALL keep the nesting level they have on the page rather than restarting at the top level

#### Scenario: Mixed content layout
- **WHEN** the image contains both tables and freeform text
- **THEN** the system SHALL detect and format each section appropriately

### Requirement: Output format compatibility
The system SHALL produce OCR output in valid Markdown format compatible with common markdown editors.

#### Scenario: Markdown compatibility
- **WHEN** OCR processing is complete
- **THEN** the output SHALL be valid GitHub-flavored Markdown without code blocks (no triple backticks) and compatible with editors like Obsidian

#### Scenario: Wrapping code fence stripped
- **WHEN** the model wraps its transcription (or a segment's transcription) in a code fence such as ```` ```markdown ... ``` ````
- **THEN** the system SHALL remove the fence lines and keep only the content between them

### Requirement: Segment-level completeness detection
When a tall image is transcribed as multiple overlapping vertical segments, the system SHALL detect not only fully empty interior segments but also segments that return substantially less text than the ink in that segment implies (a silent partial-transcription drop), and SHALL treat such a result as an incomplete transcription that triggers the configured OCR fallback model. Expected text for a segment SHALL be estimated from its ink coverage (the share of dark pixels after preprocessing), so blank paper is expected to produce no text. The default threshold SHALL flag a segment that returns less than half the text its ink implies, relative to the other segments. If the result returned is still incomplete or poor quality, the system SHALL make that visible in the output.

#### Scenario: Interior segment returns disproportionately little text
- **WHEN** a tall image is split into multiple vertical segments and a segment with ink returns a transcription whose characters per unit of ink are far below the median of the other inked segments
- **THEN** the system SHALL mark the overall transcription as incomplete and trigger the configured OCR fallback model to re-transcribe the page

#### Scenario: Partial drop of a segment is detected
- **WHEN** a segment with ink returns about 40% of the median characters-per-ink of the other inked segments
- **THEN** the system SHALL flag that segment as under-filled using the default threshold

#### Scenario: Blank paper is not a drop
- **WHEN** a segment, interior or final, has ink coverage below the blank-paper floor and returns little or no text
- **THEN** the system SHALL NOT flag it as empty or under-filled

#### Scenario: Trailing blank segments
- **WHEN** several segments after the last segment with text are empty (blank paper at the end of the page)
- **THEN** the system SHALL treat all of them as trailing space and SHALL NOT mark the transcription incomplete

#### Scenario: Proportionally filled segments are not flagged
- **WHEN** every segment returns text roughly proportional to its image area
- **THEN** the system SHALL NOT mark the transcription incomplete on density grounds and SHALL NOT trigger the fallback for that reason

#### Scenario: Short trailing segment is not a false positive
- **WHEN** the final segment covers only a small sliver of trailing page space and therefore contains little text
- **THEN** the system SHALL NOT flag it as under-filled solely because it contains little text

#### Scenario: Insufficient segments to compare
- **WHEN** fewer than two segments contain any text
- **THEN** the system SHALL NOT flag any segment as under-filled and SHALL defer to the existing empty-content handling

#### Scenario: Unresolved incompleteness is visible
- **WHEN** the transcription that will be written is still incomplete or poor quality after any fallback (or no fallback is configured)
- **THEN** the system SHALL prepend a `> [!warning]` callout to the transcription body stating that content may be missing or misread and should be checked against the image

## ADDED Requirements

### Requirement: Vision input resolution
The system SHALL send handwriting to the vision model at a resolution the provider will not significantly downscale.

#### Scenario: Explicit high detail
- **WHEN** an OpenAI vision request is made for OCR, fallback OCR, or phrase correction
- **THEN** each image part SHALL set `detail: "high"`

#### Scenario: Segment height bound
- **WHEN** a preprocessed image is taller than the configured maximum segment height (env `OCR_SEGMENT_MAX_HEIGHT`, default 768px, so a segment up to 2048px wide is not downscaled by the provider)
- **THEN** the image SHALL be split into vertical segments no taller than that maximum, overlapping by env `OCR_SEGMENT_OVERLAP` (default 150px)

#### Scenario: Previous-segment context
- **WHEN** a segment after the first is transcribed
- **THEN** the prompt SHALL include the last few lines already transcribed, with their indentation, as context for nesting only, and SHALL still instruct the model to transcribe every line visible in the segment

#### Scenario: Overlap removed with fuzzy matching
- **WHEN** the start of a segment's transcription repeats the end of the previous one with small differences (spacing, punctuation, one misread character)
- **THEN** the stitcher SHALL treat lines with normalized similarity of at least 0.9 as the same line and remove the repeated block once

### Requirement: Correction safety
The multi-pass correction step SHALL support three modes, selected by `ocrCorrection.mode`: `legacy` (today's behavior, the default until the evaluation decides), `narrow`, and `off`. In `narrow` mode it SHALL only fix character-level misreads and SHALL NOT change the meaning or wording of the notes.

#### Scenario: Correction off
- **WHEN** `ocrCorrection.mode` is `off` (or `ocrCorrection.enabled` is `false`)
- **THEN** no correction request SHALL be made and the transcription SHALL be written as returned by OCR

#### Scenario: Legacy mode unchanged
- **WHEN** `ocrCorrection.mode` is `legacy` or unset
- **THEN** correction SHALL behave as before this change, so the evaluation can compare it

#### Scenario: Only character-level issues are corrected
- **WHEN** `ocrCorrection.mode` is `narrow` and the validator reports issues of type `grammar`, `semantics`, or `incomplete`
- **THEN** the correction step SHALL NOT request or apply a correction for them, and SHALL only act on `encoding` (garbled character) issues

#### Scenario: Validator guess not passed to the model
- **WHEN** a correction prompt is built in `narrow` mode
- **THEN** it SHALL NOT include the validator's suggested meaning or "Validation suggests" text

#### Scenario: Correction that changes word count is rejected
- **WHEN** in `narrow` mode a proposed correction has a different number of words than the original phrase (beyond merging or splitting one token)
- **THEN** the system SHALL discard the correction and keep the original phrase

#### Scenario: Validator treats shorthand as normal
- **WHEN** the validation prompt is built
- **THEN** it SHALL state that the input is terse handwritten shorthand (abbreviations, fragments, dropped articles) and that such fragments are not grammar errors
