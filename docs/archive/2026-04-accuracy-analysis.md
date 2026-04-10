# OCR Accuracy Improvement Analysis

## Current State (After Phase 1 & 2)

### Achievements
- ✅ Acronym accuracy: 95%+ (MLF, NPB, RGM, TPM, etc.)
- ✅ Arrow preservation: 100% (→)
- ✅ Glossary terms recognized when clear
- ✅ Validation identifies ~70% quality with actionable feedback

### Remaining Challenges - Ground Truth vs. Current Output

**Line 1**: "Vacation - part home, part in other city"
- Current: "Vacation part book part in other city"
- Issues: "home" → "book", missing punctuation
- Root cause: Similar letter shapes (h/b ambiguity in handwriting)

**Line 2**: "if we sign MLF, may to go Canada, then change to US high"
- Current: "If issues w/ MLF, may go to NPB"
- Issues: "sign" → "issues", "Canada, then change to US high" → "NPB"
- Root cause: Unclear handwriting, context misinterpretation

**Line 3**: "Pepsico has NA instance (US/CA), may need other location"
- Current: "Pepsi want NA instance (Cus/CA)"
- Issues: "Pepsico" → "Pepsi", "has" → "want", "US/CA" → "Cus/CA"
- Root cause: Abbreviated vs. full name, letter ambiguity

**Line 5**: "$3M upfront"
- Current: "$3M customer"
- Issues: "upfront" → "customer"
- Root cause: Letter confusion (upf → cus)

**Line 6**: "MLF + Pepsi use PwC"
- Current: "MLF + Pepsi w/ new POC"
- Issues: "use PwC" → "w/ new POC"
- Root cause: PwC vs POC confusion despite glossary

---

## Why Current Approach Has Limits

**Domain glossary helps when**:
- Text is relatively clear but needs context
- Acronyms need to be preserved in caps
- Special symbols need protection

**Domain glossary cannot fix**:
- Fundamental character misreads (h → b, s → ss)
- Context-dependent interpretations ("sign" vs "issues")
- Similar-looking words ("customer" vs "upfront")

---

## Options for Further Improvement

### Option 1: Multi-Pass OCR with Correction (Highest Impact)

**Approach**:
1. First pass: Current OCR (with glossary context)
2. Validation pass: Identify issues (already implemented)
3. **NEW** Correction pass: Re-run OCR on problematic regions with:
   - Validation findings as context
   - Specific focus on flagged phrases
   - Alternative interpretations requested

**Implementation**:
```typescript
// After validation identifies "part book part"
const correctionPrompt = `
Previous transcription: "part book part in other city"
Validation flagged: grammatically unclear

Re-examine this phrase considering:
- Could "book" be "home"?
- Does the context suggest living arrangements?
- Check letter formation carefully for h/b ambiguity
`;

// Run targeted correction OCR on specific region
```

**Pros**: Can fix identified issues systematically
**Cons**: 2x API cost for problematic images, more complex logic

### Option 2: Enhanced Preprocessing (Medium Impact)

**Approach**:
- Experiment with Sharp preprocessing parameters
- Try multiple preprocessing combinations:
  - Higher contrast for unclear letters
  - Different sharpening levels
  - Adaptive thresholding
  - Noise reduction

**Current preprocessing**:
```typescript
.grayscale()
.resize({ width: 1600 })
.normalize()
.sharpen()
```

**Enhanced options**:
```typescript
// Option A: Higher contrast
.grayscale()
.resize({ width: 2000 })
.normalize()
.linear(1.2, -(128 * 1.2) + 128)  // Increase contrast
.sharpen({ sigma: 1.5 })

// Option B: Adaptive threshold
.grayscale()
.resize({ width: 1600 })
.clahe({ width: 7, height: 7 })  // Adaptive histogram
.sharpen()

// Option C: Bilateral filter
.grayscale()
.median(3)  // Noise reduction
.resize({ width: 1600 })
.normalize()
.sharpen()
```

**Pros**: No additional API costs, one-time optimization
**Cons**: May not help with fundamental letter ambiguity, requires testing many combinations

### Option 3: Context-Aware Auto-Correction (Low Risk)

**Approach**:
Use validation suggestions to automatically fix high-confidence issues (>90% confidence):

```typescript
if (validationReport.issues.some(i => i.confidence > 0.9 && i.suggestion)) {
  // Apply high-confidence corrections
  correctedText = applyCorrections(ocrText, validationReport.issues);
}
```

**Example**:
- Validation: "use in do to" → 90% confident it should be "use to"
- Auto-correct only this phrase
- Keep lower confidence issues marked with *italics*

**Pros**: Leverages validation intelligence, low risk (only high confidence)
**Cons**: Still depends on validation accuracy, won't fix all issues

### Option 4: Provide More Handwriting Examples (User Action)

**Approach**:
Update your reference sheet image to include:
- Common confused word pairs: "home" vs "book", "sign" vs "issues"
- Full company names: "Pepsico" (not just "Pepsi")
- Currency formats: "$3M upfront" with "upfront" written clearly
- "PwC" written in your handwriting

**Pros**: Gives OCR more examples of YOUR specific letter formations
**Cons**: Requires user to create new reference samples

---

## Recommendation

**Best path forward**: **Option 1 (Multi-Pass with Correction)** + **Option 4 (Better reference examples)**

**Why**:
1. Multi-pass can systematically address validation findings
2. Better reference samples improve first-pass accuracy
3. Combined approach attacks the problem from both ends

**Quick win**: Start with **Option 4** - update your reference sheet to include the commonly confused words from the ground truth test. This requires no code changes and may significantly improve accuracy.

**Next step**: If Option 4 alone doesn't get us to target accuracy, implement **Option 1** (multi-pass correction) for remaining issues.

---

## Immediate Action

Would you like to:
1. **Update reference sheet** with more examples (Pepsico, PwC, upfront, Vacation, etc.)?
2. **Implement multi-pass OCR** to automatically correct validation findings?
3. **Experiment with preprocessing** parameters to improve image quality?
4. **Run more tests** with current configuration to establish baseline?
