# Phase 3: Multi-Pass OCR Correction

## Overview

Phase 3 adds targeted correction for critical OCR issues identified by the validation layer (Phase 2). This uses validation feedback to re-OCR specific problematic phrases with focused prompts.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Image → Pass 1 OCR → Validation → Pass 2 Correction → Output │
└─────────────────────────────────────────────────────────────┘
```

**Detailed Flow:**

1. **Pass 1 - Initial OCR** (existing)
   - Full image OCR with domain glossary context
   - Returns complete transcription

2. **Validation** (Phase 2, existing)
   - Analyzes transcription for quality issues
   - Returns structured report with issues, severity, confidence

3. **Pass 2 - Targeted Correction** (NEW)
   - Only runs if validation finds critical issues
   - Re-OCRs specific phrases with targeted hints
   - Replaces problematic phrases with corrections
   - Tags corrections with `[corrected]`

4. **Final Output**
   - Corrected transcription with tags
   - Validation report includes correction log

## How Correction Works

### Example 1: Grammar Issue

**Initial OCR:**
```
Vacation part based partly in other city
```

**Validation identifies:**
```typescript
{
  type: 'grammar',
  severity: 'critical',
  phrase: 'part based partly',
  suggestion: 'possibly "part home, part"',
  confidence: 0.9
}
```

**Correction prompt:**
```
Previous transcription: "part based partly in other city"
Validation flagged: grammatically unclear

Context clues:
- Topic: Vacation/living arrangements
- Common handwriting confusion: "home" vs "based" (h/b letter similarity)
- Expected pattern: "part X, part Y" (parallel structure)

Look at the handwriting for "based" closely.
Could the first letter be 'h' instead of 'b'?
Does "part home, part in other city" make more sense contextually?

Provide only the corrected phrase.
```

**Correction result:**
```
Vacation part home[corrected], part in other city
```

### Example 2: Word Confusion

**Initial OCR:**
```
If signed w/ MLF they go to
```

**Validation identifies:**
```typescript
{
  type: 'grammar',
  severity: 'critical',
  phrase: 'If signed w/ MLF they',
  suggestion: 'possibly "if we sign MLF, may"',
  confidence: 0.85
}
```

**Correction prompt:**
```
Previous transcription: "If signed w/ MLF they go to"
Validation flagged: grammatically incomplete

Context clues:
- Topic: Contract signing/business decision
- Common confusion: "signed" vs "sign" (different verb form)
- Pattern: missing subject pronoun ("we")

Re-examine: Should "signed" be "we sign"?
Look for a subject pronoun before the verb.

Provide only the corrected phrase.
```

**Correction result:**
```
if we sign[corrected] MLF, may go to
```

### Example 3: Company Name

**Initial OCR:**
```
Pepsi want NA instance (US/CA)
```

**Validation identifies:**
```typescript
{
  type: 'semantics',
  severity: 'warning', // Not critical
  phrase: 'Pepsi want',
  suggestion: 'possibly "Pepsico wants" or "Pepsico has"',
  confidence: 0.7
}
```

**No correction** (warning severity, not critical - only correct critical issues)

## Implementation Details

### 1. Core Correction Function

**File:** `src/ocrValidator.ts`

**New exports:**
```typescript
export interface CorrectionResult {
  correctedText: string;
  corrections: CorrectionLog[];
  correctionCount: number;
}

export interface CorrectionLog {
  originalPhrase: string;
  correctedPhrase: string;
  issueType: string;
  validationNote: string;
  confidence: number;
}

export interface CorrectionConfig {
  enabled: boolean;
  correctCriticalOnly: boolean;
  tagCorrections: boolean;
  maxCorrectionsPerImage: number;
  minIssueConfidence: number;
}

export async function correctOCRIssues(
  originalText: string,
  imageBuffer: Buffer,
  validation: ValidationReport,
  config?: Partial<CorrectionConfig>
): Promise<CorrectionResult>
```

**Implementation logic:**
```typescript
async function correctOCRIssues(
  originalText: string,
  imageBuffer: Buffer,
  validation: ValidationReport,
  config?: Partial<CorrectionConfig>
): Promise<CorrectionResult> {
  const cfg = { ...DEFAULT_CORRECTION_CONFIG, ...config };

  if (!cfg.enabled) {
    return { correctedText: originalText, corrections: [], correctionCount: 0 };
  }

  // Filter critical issues with high confidence
  const criticalIssues = validation.issues.filter(
    i => i.severity === 'critical' &&
         i.confidence >= cfg.minIssueConfidence
  ).slice(0, cfg.maxCorrectionsPerImage);

  if (criticalIssues.length === 0) {
    return { correctedText: originalText, corrections: [], correctionCount: 0 };
  }

  let correctedText = originalText;
  const corrections: CorrectionLog[] = [];

  for (const issue of criticalIssues) {
    try {
      // Extract context
      const context = extractContext(originalText, issue.phrase);

      // Build correction prompt
      const prompt = buildCorrectionPrompt(issue, context);

      // Call OCR for targeted correction
      const correctedPhrase = await requestPhraseCorrection(
        imageBuffer,
        issue.phrase,
        prompt
      );

      if (correctedPhrase && correctedPhrase !== issue.phrase) {
        // Tag if enabled
        const replacement = cfg.tagCorrections
          ? `${correctedPhrase}[corrected]`
          : correctedPhrase;

        // Replace in text
        correctedText = correctedText.replace(issue.phrase, replacement);

        // Log correction
        corrections.push({
          originalPhrase: issue.phrase,
          correctedPhrase,
          issueType: issue.type,
          validationNote: issue.suggestion || '',
          confidence: issue.confidence
        });
      }
    } catch (error) {
      console.error(`❌ Correction failed for "${issue.phrase}":`, error.message);
      // Continue with other corrections
    }
  }

  return {
    correctedText,
    corrections,
    correctionCount: corrections.length
  };
}
```

**Helper functions:**
```typescript
function extractContext(text: string, phrase: string): string {
  // Get phrase + 2 lines before/after
}

function buildCorrectionPrompt(
  issue: ValidationIssue,
  context: string
): string {
  // Build targeted prompt with validation feedback
}

async function requestPhraseCorrection(
  imageBuffer: Buffer,
  originalPhrase: string,
  prompt: string
): Promise<string> {
  // Call OpenAI with image + correction prompt
  // Return corrected phrase only
}

function getGuidanceForIssueType(
  issue: ValidationIssue,
  glossary: DomainGlossary
): string {
  // Issue-specific hints based on type
}
```

### 2. Configuration Extension

**File:** `handwriting-reference.json`

Add section:
```json
{
  "ocrValidation": { ... },
  "ocrCorrection": {
    "enabled": true,
    "correctCriticalOnly": true,
    "tagCorrections": true,
    "maxCorrectionsPerImage": 10,
    "minIssueConfidence": 0.8
  }
}
```

**File:** `src/handwritingReference.ts`

Extend interface:
```typescript
export interface HandwritingReferenceConfig {
  // ... existing fields
  ocrValidation?: { ... };
  ocrCorrection?: {
    enabled?: boolean;
    correctCriticalOnly?: boolean;
    tagCorrections?: boolean;
    maxCorrectionsPerImage?: number;
    minIssueConfidence?: number;
  };
}
```

Add getter:
```typescript
export function getCorrectionConfig(): CorrectionConfig {
  // Load from handwriting reference
}
```

### 3. Pipeline Integration

**Batch processing** (`src/main.ts`):
```typescript
// After line 50 (after validation)
if (validationReport?.hasIssues && correctionConfig.enabled) {
  const correctionResult = await correctOCRIssues(
    ocrText,
    buffer,
    validationReport,
    correctionConfig
  );

  ocrText = correctionResult.correctedText;

  if (correctionResult.correctionCount > 0) {
    console.log(`  🔧 ${path.basename(imagePath)}: Applied ${correctionResult.correctionCount} corrections`);
  }

  // Append correction log to validation report
  if (correctionResult.corrections.length > 0) {
    validationReport.correctionLog = correctionResult.corrections;
  }
}
```

**Single-file processing** (`src/convert-single.ts`):
```typescript
// Add --correct flag
const shouldCorrect = args.includes('--correct');

// After validation
if (shouldCorrect && validationReport?.hasIssues) {
  console.log('🔧 Applying corrections...');

  const correctionConfig = getCorrectionConfig();
  const correctionResult = await correctOCRIssues(
    transcription,
    imageBuffer,
    validationReport,
    correctionConfig
  );

  transcription = correctionResult.correctedText;

  console.log(`✅ Applied ${correctionResult.correctionCount} corrections`);

  if (correctionResult.correctionCount > 0) {
    console.log('Corrections:');
    correctionResult.corrections.forEach(c => {
      console.log(`  - "${c.originalPhrase}" → "${c.correctedPhrase}"`);
    });
  }
}
```

Update help text:
```
Usage: npm run convert <image-path> [--no-summary] [--validate] [--correct]

Arguments:
  --validate    Run OCR quality validation
  --correct     Apply multi-pass correction for critical issues (requires --validate)
```

### 4. Correction Report Format

Append to validation report:

```markdown
## Corrections Applied

3 phrases corrected:

1. **"part based partly"** → "part home"
   - Reason: grammatically unclear
   - Confidence: 90%

2. **"If signed w/ MLF"** → "if we sign MLF"
   - Reason: grammatically incomplete
   - Confidence: 85%

3. **"Pepsi want"** → "Pepsico has"
   - Reason: semantic inconsistency
   - Confidence: 82%
```

### 5. Test Suite

**File:** `tests/ocr-correction.test.ts` (NEW)

```typescript
describe('Multi-Pass OCR Correction', () => {
  describe('correctOCRIssues', () => {
    it('should correct critical grammar issues', async () => {
      const validation = {
        hasIssues: true,
        issues: [{
          type: 'grammar',
          severity: 'critical',
          phrase: 'part based partly',
          confidence: 0.9
        }]
      };

      const result = await correctOCRIssues(
        'Vacation part based partly in other city',
        mockImageBuffer,
        validation
      );

      expect(result.correctedText).toContain('part home');
      expect(result.correctedText).toContain('[corrected]');
      expect(result.correctionCount).toBe(1);
    });

    it('should skip warning-level issues', async () => { ... });
    it('should respect maxCorrectionsPerImage limit', async () => { ... });
    it('should handle API failures gracefully', async () => { ... });
    it('should not correct when disabled', async () => { ... });
    it('should track all corrections in log', async () => { ... });
    // ... 10+ tests
  });

  describe('Ground truth validation with correction', () => {
    it('should improve accuracy on Cosine 02-26', async () => {
      // Run OCR → validate → correct → test
      // Expect higher pass rate than without correction
    });
  });
});
```

## Critical Files

### New Files
1. **`openspec/changes/ocr-accuracy-improvements/phase3-multipass.md`** (this file)
   - Complete Phase 3 design specification

2. **`tests/ocr-correction.test.ts`**
   - Comprehensive test coverage (~15 tests)

### Modified Files
1. **`src/ocrValidator.ts`**
   - Add `correctOCRIssues()` function (+150 lines)
   - Add helper functions for context extraction, prompt building
   - Add `requestPhraseCorrection()` for targeted OCR calls

2. **`src/main.ts`**
   - Add correction pass after validation (+15 lines)
   - Import correction functions
   - Log correction results

3. **`src/convert-single.ts`**
   - Add `--correct` flag support (+30 lines)
   - Update help text
   - Log correction details to console

4. **`handwriting-reference.json`**
   - Add `ocrCorrection` config section (+8 lines)

5. **`src/handwritingReference.ts`**
   - Extend interface with ocrCorrection field (+7 lines)
   - Add `getCorrectionConfig()` helper function

## Success Metrics

### Phase 3 Targets

- **Ground truth test pass rate**: 80%+ (currently ~40%)
- **Character accuracy**: 85%+ (currently 70-75%)
- **Critical issue correction rate**: 70%+ of critical issues fixed
- **No new errors**: <10% of corrections introduce new issues
- **Performance**: <5s additional latency per problematic image

### Measured on "Cosine 02-26" Test

Target fixes:
- "part based" → "part home" ✓
- "If signed" → "if we sign" ✓
- "Pepsi" → "Pepsico" ✓
- Preserve: "MLF", "PwC", "$3M upfront", "Canada"

## Cost Analysis

### Current (Phase 2)
- 1 OCR call (gpt-4o): ~$0.015/image
- 1 validation call (gpt-4o-mini): ~$0.001/image
- **Total**: ~$0.016/image

### With Phase 3 (Multi-Pass)
- 1 OCR call (gpt-4o): ~$0.015/image
- 1 validation call (gpt-4o-mini): ~$0.001/image
- 0-5 correction calls (gpt-4o): ~$0.003 each
- **Total**: ~$0.016-$0.031/image (avg ~$0.023/image)

**Cost increase**: ~45% average, but only for problematic images

## Rollback Strategy

If Phase 3 degrades quality:
1. Set `ocrCorrection.enabled: false` in config (instant disable)
2. All Phase 1 & 2 functionality remains intact
3. Fall back to validation-only reports
4. `git revert` or restore to commit `e7cfc90`

## Edge Cases & Error Handling

1. **Correction introduces new error**: Tag makes it traceable, user sees both versions in log
2. **No correctable phrase found**: Return original phrase, log warning
3. **Circular correction**: Track corrections, skip if already tagged `[corrected]`
4. **API timeout on correction**: Return original phrase, log error, continue with other corrections
5. **All issues are warnings**: No corrections applied (only critical severity triggers correction)
6. **Image has >10 critical issues**: Correct first 10, flag remainder in validation report
7. **Empty or very short phrase**: Skip correction, too little context
8. **Phrase not found in text**: Log warning, skip (validation may have used approximate match)

## Implementation Sequence

### Step 1: Core Correction Logic
1. Add interfaces (CorrectionResult, CorrectionLog, CorrectionConfig)
2. Implement `correctOCRIssues()` main function
3. Add helper: `extractContext()` - get surrounding lines
4. Add helper: `buildCorrectionPrompt()` - construct targeted prompt
5. Add helper: `requestPhraseCorrection()` - OCR API call for single phrase
6. Add helper: `getGuidanceForIssueType()` - issue-specific hints
7. Add constants: DEFAULT_CORRECTION_CONFIG

### Step 2: Configuration Support
1. Add `ocrCorrection` section to handwriting-reference.json
2. Extend HandwritingReferenceConfig interface
3. Add `getCorrectionConfig()` helper function
4. Test configuration loading with defaults

### Step 3: Test Suite
1. Create `tests/ocr-correction.test.ts`
2. Mock OpenAI (following existing pattern)
3. Test scenarios:
   - Correction with critical issues
   - Skip warnings
   - Disabled correction
   - Max corrections limit
   - API failures
   - Correction logging
   - Tag formatting
4. Run tests: expect 106+ passing (91 existing + 15 new)

### Step 4: Batch Processing Integration
1. Import correction functions in src/main.ts
2. Add correction pass after validation
3. Pass original image buffer to correction
4. Log correction results to console
5. Append correction log to validation report
6. Test batch processing with correction enabled

### Step 5: Single-File Integration
1. Add `--correct` flag to convert-single.ts
2. Update help text
3. Add correction call when flag present
4. Log correction details to console
5. Test: `npm run convert test-images/Cosine\ 02-26.jpeg --validate --correct`

### Step 6: Ground Truth Verification
1. Run: `npm test -- tests/ocr-accuracy.test.ts`
2. Measure pass rate improvement
3. Verify no new errors introduced
4. Check tagged corrections are accurate
5. Measure latency impact

## Correction Prompt Templates

### Grammar Issue Template
```
Previous transcription: "{phrase}"
Validation: grammatically incorrect

Look for:
- Missing words (articles, pronouns, verbs)
- Wrong verb forms (tense, person, number)
- Word order violations
- Parallel structure breaks

Context: {surrounding_context}
Glossary hints: {relevant_glossary_terms}

Provide the corrected phrase only.
```

### Semantic Issue Template
```
Previous transcription: "{phrase}"
Validation: semantically unclear or nonsensical

Look for:
- Words that don't form coherent meaning together
- Business terms that might be misread
- Company/project names from glossary: {glossary_terms}

Context: {surrounding_context}

Does this make sense in a business meeting context?
Check the handwriting carefully and provide the corrected phrase.
```

### Incomplete Issue Template
```
Previous transcription: "{phrase}"
Validation: appears incomplete or truncated

Look for:
- Missing words at end of phrase
- Dangling prepositions or conjunctions
- Incomplete clauses

Context: {surrounding_context}

Are there additional words after this phrase that weren't transcribed?
Provide the complete phrase.
```

## Verification Plan

### Unit Tests
```bash
npm test -- tests/ocr-correction.test.ts
```
- Expect 15+ new tests passing
- Full coverage of correction logic
- Mock OpenAI following existing pattern

### Integration Test
```bash
npm run convert test-images/Cosine\ 02-26.jpeg --validate --correct
```
Expected:
- Corrections logged to console
- Tagged [corrected] phrases in output
- Validation report includes correction log
- Quality score improves from ~70% to ~85%

### Ground Truth Test
```bash
npm test -- tests/ocr-accuracy.test.ts
```
Expected:
- Pass rate improves from ~40% to ~80%+
- Key phrases corrected:
  - "part home" ✓
  - "if we sign" ✓
  - "Pepsico" ✓
- No regressions on already-correct phrases

### Batch Processing Test
```bash
npm start
```
Expected:
- Corrections applied to images with critical issues
- Console logs show correction counts
- Validation reports include correction logs
- Processing time acceptable (<10s per image with corrections)

## Expected Outcomes

**Phase 3 Completion:**
- 85-90% accuracy on challenging handwriting
- Critical OCR errors systematically corrected
- Transparent correction tracking with tags
- Minimal cost impact (only problematic images)
- Foundation for future interactive correction mode

**Time Estimate**: 4-6 hours
**Risk Level**: Medium (modifies transcription, but tagged and logged)
**Confidence**: High (builds on proven validation system)
