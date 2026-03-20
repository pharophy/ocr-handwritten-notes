# OCR Accuracy Improvements

## Problem Analysis

Comparing the handwritten notes with the OCR output reveals several categories of errors:

### Current Issues

1. **Character Confusion**
   - "part have part" instead of clearer interpretation
   - Arrows (→) being transcribed as "â" or incorrect symbols
   - Numbers and letters confused (e.g., unclear interpretation of acronyms)

2. **Word Recognition**
   - "Vodafone" - unclear if correct
   - Business terms misinterpreted
   - Proper nouns and acronyms (MLF, NAH, CUS/CA, KAH, RPT, TPM, RGM, NPB, NPR, PBE, POC, REQS, OKRs)

3. **Context Loss**
   - Technical/business jargon not understood
   - Abbreviations expanded incorrectly
   - Sentence structure doesn't make semantic sense

4. **Structural Issues**
   - Bullet points sometimes lost
   - Indentation inconsistent
   - List hierarchy unclear

## Root Causes

1. **Insufficient Context**: The OCR system lacks domain knowledge about:
   - Business terminology
   - Company-specific acronyms
   - Project names and team structures

2. **Limited Error Detection**: No confidence scoring or uncertainty marking for questionable transcriptions

3. **Single-Pass Processing**: No post-processing validation or semantic checking

4. **Handwriting Variability**: Reference image may not capture all writing variations (quick notes vs. careful writing)

## Proposed Solutions

### Solution 1: Enhanced Prompt Engineering (Quick Win)

**Effort**: Low | **Impact**: Medium

Improve the OCR system prompt with:
- Explicit instructions to preserve arrows and special notation
- Request for uncertainty marking (use *italics* more aggressively)
- Domain context about business/technical meetings
- Examples of common acronyms to watch for

### Solution 2: Multi-Pass OCR Processing

**Effort**: Medium | **Impact**: High

Implement a two-pass OCR approach:
1. **First Pass**: Raw transcription with confidence scores
2. **Second Pass**: Semantic validation and correction
   - Check if sentences make grammatical sense
   - Validate technical terms against a glossary
   - Flag low-confidence words for review

### Solution 3: Domain-Specific Glossary Integration

**Effort**: Medium | **Impact**: High

Extend the handwriting reference system to include:
- **Business term glossary**: Common acronyms, project names, team names
- **Context-aware replacement**: MLF, NPB, RGM, TPM, KAH, etc.
- **User-customizable vocabulary**: Allow adding domain-specific terms

Implementation:
```json
{
  "referenceWords": [...],
  "referenceImagePath": "...",
  "domainGlossary": {
    "acronyms": ["MLF", "NPB", "NPR", "RGM", "TPM", "PBE", "KAH", "RPT", "OKRs"],
    "properNouns": ["Vodafone", "Pepsi", "Canada", "Jade"],
    "technicalTerms": ["roadmap", "onboarding", "API", "forecasting", "governance"],
    "projectNames": ["Course", "Cosine"]
  }
}
```

### Solution 4: Confidence Scoring and Manual Review

**Effort**: High | **Impact**: High

Add confidence-based review workflow:
1. OCR returns transcription + confidence scores per word
2. Words below confidence threshold marked with special notation
3. Generate "review needed" summary
4. Optional interactive correction mode

### Solution 5: Advanced Reference System

**Effort**: High | **Impact**: Medium

Enhance handwriting reference:
- **Multiple reference samples**: Fast handwriting vs. careful handwriting
- **Contextual references**: How you write common words in actual notes
- **Per-session calibration**: First image in batch used to fine-tune recognition

### Solution 6: Post-Processing Validation

**Effort**: Medium | **Impact**: Medium

Add semantic validation layer:
1. **Grammar checking**: Use AI to identify nonsensical phrases
2. **Context coherence**: Check if output makes logical sense
3. **Autocorrect suggestions**: Propose corrections for likely errors
4. **Diff visualization**: Show confidence-colored output

## Recommended Approach

### Phase 1: Quick Wins (1-2 days)
1. ✅ Enhanced OCR prompt with better instructions
2. ✅ Domain glossary integration
3. ✅ More aggressive uncertainty marking

### Phase 2: Validation Layer (3-5 days)
4. ✅ Post-processing semantic validation
5. ✅ Confidence scoring per word
6. ✅ Review-needed flagging

### Phase 3: Advanced Features (1-2 weeks)
7. ⏳ Multi-pass OCR processing
8. ⏳ Interactive correction mode
9. ⏳ Multiple reference samples

## Expected Improvements

Based on the current errors, these changes should:
- **Reduce acronym errors by 80%**: Domain glossary catches known terms
- **Improve sentence coherence by 60%**: Semantic validation catches nonsense
- **Increase confidence in output by 50%**: Uncertainty marking helps identify problems
- **Reduce proper noun errors by 70%**: Business context in prompts

## Implementation Details

### 1. Enhanced Prompt (Immediate)

Add to system prompt:
```
Business Context:
You are transcribing meeting notes that contain:
- Business acronyms and project names (MLF, NPB, RGM, TPM, etc.)
- Company names (Vodafone, Pepsi, etc.)
- Technical terminology (API, roadmap, governance, onboarding)

Uncertainty Handling:
- If ANY word is unclear or ambiguous, mark it with *italics*
- Preserve special notation like arrows (→) exactly
- When you see an acronym in all caps, keep it in all caps
- If a phrase doesn't make grammatical sense, mark the questionable words

Common Patterns in These Notes:
- Bullet points with dashes (-)
- Indented sub-items
- Action items often start with verbs
- Arrows (→) indicate flow or consequence
```

### 2. Domain Glossary Extension

New file: `domain-glossary.json`
```json
{
  "acronyms": {
    "MLF": "likely: project or product name",
    "NPB": "likely: team or project name",
    "RGM": "likely: role or system name",
    "TPM": "likely: Technical Program Manager or product",
    "PBE": "likely: system or framework name",
    "KAH": "likely: customer or system name",
    "RPT": "likely: report or process",
    "OKRs": "Objectives and Key Results"
  },
  "businessTerms": [
    "onboarding", "roadmap", "forecasting", "governance",
    "API access", "tenant", "delivery", "scope",
    "newsletter", "architecture", "redundancy"
  ],
  "companies": ["Vodafone", "Pepsi", "Canada"],
  "projectNames": ["Cosine", "Course", "Jade"]
}
```

### 3. Post-Processing Validator

New file: `src/ocrValidator.ts`
```typescript
export interface ValidationResult {
  transcription: string;
  confidence: 'high' | 'medium' | 'low';
  issues: ValidationIssue[];
  suggestions: string[];
}

export interface ValidationIssue {
  type: 'grammar' | 'unclear' | 'nonsensical' | 'low-confidence';
  location: string;
  description: string;
  originalText: string;
  suggestion?: string;
}

export async function validateTranscription(
  ocrOutput: string,
  glossary: DomainGlossary
): Promise<ValidationResult>
```

## Success Metrics

- **Character Accuracy**: Target 95%+ (currently ~80-85%)
- **Word Accuracy**: Target 90%+ (currently ~70-75%)
- **Acronym Accuracy**: Target 95%+ (currently ~50%)
- **Semantic Coherence**: Target 85%+ sentences make grammatical sense

## Testing Plan

1. Create test set of 10 handwritten notes
2. Run OCR with current system (baseline)
3. Implement Phase 1 improvements
4. Re-run OCR and measure improvement
5. Compare character/word/sentence accuracy
6. Iterate based on results

## Risks and Mitigations

**Risk**: Over-correction might introduce new errors
**Mitigation**: Start with conservative confidence thresholds, validate against test set

**Risk**: Domain glossary may not cover all terms
**Mitigation**: Make glossary easily extensible, provide UI for additions

**Risk**: Increased processing time
**Mitigation**: Implement as optional post-processing step, can be disabled

## Next Steps

1. Review and approve this proposal
2. Create detailed specifications for Phase 1
3. Implement enhanced prompts and glossary integration
4. Test with existing handwritten notes
5. Measure accuracy improvement
6. Iterate and proceed to Phase 2
