# OCR Testing Strategy

## Objective

Systematically test OCR accuracy on handwritten notes to:
1. Establish baseline performance metrics
2. Compare different AI models (Claude Opus, GPT-4o, GPT-4 Vision)
3. Identify best configuration for handwriting style
4. Measure impact of domain glossary
5. Propose improvements toward 90-100% accuracy goal

## Test Case

**Primary Test:** `test-images/Dynatrace Q2 04-09.jpeg`
- Technical infrastructure meeting notes
- Contains acronyms: BTP, DT, SPN, K8s, ArgoCD, CAM, CIC, EDE
- Contains proper nouns: Dynatrace, Vault, Azure, JIRA, Pruthvi
- Business terms: service binding, multi-values file, orphan instance
- Gold standard: `Dynatrace Q2 04-09 expected.txt`

## Testing Phases

### Phase 1: Baseline Establishment
**Goal:** Measure current performance with Claude 4.6 Sonnet

**Steps:**
1. Run OCR test with current configuration
2. Record metrics: character accuracy, word F1, italic %, processing time
3. Store as baseline in `test-results/baseline.json`
4. Review output quality and identify error patterns

**Success Criteria:**
- Baseline metrics established
- Error patterns documented
- Baseline stored for future comparisons

### Phase 2: Model Comparison
**Goal:** Test all available models to find best performer

**Models to Test:**
1. Claude 4.6 Sonnet (baseline)
2. Claude 4.6 Opus (higher accuracy)
3. GPT-4o (OpenAI's best vision model)
4. GPT-4 Vision (alternative OpenAI model)

**Metrics to Compare:**
- Character accuracy (%)
- Word F1 score
- Italic percentage (uncertainty)
- Processing time (seconds)
- Cost estimate ($)
- Composite score (weighted: 70% accuracy, 15% cost, 15% latency)

**Success Criteria:**
- All 4 models tested successfully
- Clear winner identified based on scoring
- Cost-accuracy tradeoffs documented

### Phase 3: Glossary Impact Assessment
**Goal:** Measure impact of domain glossary on accuracy

**Steps:**
1. Temporarily disable glossary
2. Run baseline model without glossary
3. Re-enable glossary
4. Run baseline model with glossary
5. Compare delta in accuracy metrics

**Success Criteria:**
- Quantified glossary improvement (expected: 1-5%)
- Specific term corrections identified

### Phase 4: Fallback Verification
**Goal:** Verify automatic fallback triggers correctly

**Steps:**
1. Review baseline OCR quality assessment
2. Check if uncertainty threshold was exceeded
3. Verify fallback model was triggered (if applicable)
4. Compare primary vs fallback output quality

**Success Criteria:**
- Fallback triggering logic validated
- Quality improvement from fallback documented (if triggered)

### Phase 5: Analysis & Recommendations
**Goal:** Comprehensive analysis and improvement proposals

**Analysis Points:**
1. **Best Model Identification:**
   - Which model achieved highest accuracy?
   - What are cost/latency tradeoffs?
   - Should we change default model?

2. **Error Pattern Analysis:**
   - Common misread characters
   - Problematic acronyms/terms
   - Handwriting style challenges

3. **Improvement Opportunities:**
   - Preprocessing optimization
   - Prompt engineering
   - Additional glossary terms
   - Multi-pass OCR strategies
   - Ensemble methods

4. **Configuration Recommendations:**
   - Recommended primary model
   - Recommended fallback model
   - Suggested glossary additions
   - Threshold adjustments

**Success Criteria:**
- Clear recommendation for production configuration
- Documented path to 90-100% accuracy
- Prioritized improvement proposals

## Execution Plan

### Sequence
1. ✅ Phase 1: Baseline (Task 3.1, 3.2)
2. ✅ Phase 2: Model Comparison (Tasks 5.1-5.5)
3. ✅ Phase 3: Glossary Assessment (Task 9.4)
4. ✅ Phase 4: Fallback Verification (Task 3.6)
5. ✅ Phase 5: Analysis (Tasks 6.1-6.7)

### Commands

**Phase 1:**
```bash
npm run test-ocr "test-images/Dynatrace Q2 04-09.jpeg"
```

**Phase 2:**
```bash
npm run experiment-ocr "test-images/Dynatrace Q2 04-09.jpeg" -- --type=model
```

**Phase 3:**
```bash
# Disable glossary temporarily, run test, re-enable, compare
```

**Phase 4:**
```bash
# Review baseline logs for fallback triggers
```

**Phase 5:**
```bash
# Generate comprehensive analysis report
```

## Expected Outcomes

### Best Case
- Identify model with 90%+ accuracy
- Clear cost-effective winner
- Minimal additional improvements needed

### Realistic Case
- Identify best model with 75-85% accuracy
- Clear improvement path to 90%+
- Actionable improvement proposals

### Worst Case
- All models perform similarly at 60-70%
- Significant preprocessing or prompt engineering needed
- Multi-pass or ensemble approaches required

## Risk Mitigation

**Risk:** Model experiments fail due to API issues
- Mitigation: Test HAI proxy connection first
- Fallback: Run models sequentially if parallel fails

**Risk:** Expected output may not be perfectly accurate
- Mitigation: Manual review of gold standard
- Fallback: Iterate on expected output if needed

**Risk:** Cost of running multiple models
- Mitigation: Using HAI proxy (free for SAP employees)
- Fallback: Run subset of models if cost is concern

## Success Metrics

### Quantitative
- Baseline accuracy: [to be measured]
- Best model accuracy: [to be measured]
- Improvement from glossary: [to be measured]
- Composite score: [to be measured]

### Qualitative
- Clear production recommendation
- Documented error patterns
- Actionable improvement roadmap
- Path to 90-100% accuracy defined

## Deliverables

1. **Baseline Report:** Current performance metrics
2. **Model Comparison Report:** All models tested with recommendations
3. **Glossary Impact Report:** Quantified improvement
4. **Fallback Validation:** Verification of quality checks
5. **Analysis & Recommendations:** Comprehensive findings and next steps
6. **Updated Baseline:** Best configuration stored for tracking
