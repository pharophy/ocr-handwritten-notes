## ADDED Requirements

### Requirement: Local glossary overlay
The system SHALL support an optional, git-ignored local glossary file that adds personal names, domain terms, and personal abbreviations to the committed handwriting reference without committing them.

#### Scenario: Overlay merged into glossary
- **WHEN** `handwriting-reference.local.json` exists next to the configured handwriting reference file and contains a `domainGlossary`
- **THEN** its `properNouns` and `businessTerms` SHALL be appended (deduplicated) to the committed glossary's, and its `acronyms` and `abbreviations` entries SHALL be added, with the local entry winning on a key conflict

#### Scenario: Overlay absent
- **WHEN** no local overlay file exists
- **THEN** the system SHALL use the committed glossary unchanged and SHALL NOT log an error

#### Scenario: Malformed overlay
- **WHEN** the local overlay file exists but is not valid JSON
- **THEN** the system SHALL log a warning naming the file and continue with the committed glossary

#### Scenario: Overlay never committed
- **WHEN** the repository's `.gitignore` is checked
- **THEN** `handwriting-reference.local.json` SHALL be ignored

#### Scenario: Personal abbreviations reach the prompt
- **WHEN** the merged glossary contains `abbreviations` (for example `es.` → `e.g.`)
- **THEN** the OCR prompt SHALL list them so the model transcribes the writer's shorthand as written and recognizes it consistently
