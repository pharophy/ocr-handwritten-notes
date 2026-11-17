## MODIFIED Requirements

### Requirement: Output file metadata
The system SHALL include navigation links in generated output files, using the same wikilink format for batch runs and single-file conversion.

#### Scenario: OCR file links
- **WHEN** creating an OCR output file
- **THEN** the first line SHALL contain markdown links to the summary file and original image file

#### Scenario: Summary file links
- **WHEN** creating a summary output file
- **THEN** the first line SHALL contain markdown links to the OCR transcription file and original image file

#### Scenario: Consistent link format
- **WHEN** either `npm run start` or `npm run convert` writes an output file for `[filename].[ext]`
- **THEN** links to markdown files SHALL omit the `.md` extension (`[[filename - Summary and Actions]]`, `[[filename]]`), links to the image SHALL keep its extension (`[[filename.ext]]`), and both entry points SHALL produce identical first lines
