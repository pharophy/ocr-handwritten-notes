## Context

The current OCR system uses Claude 4.6 Sonnet for handwriting transcription with fallback to GPT-4.1-mini on poor quality. Testing reveals the Dynatrace Q2 04-09 image produces ~40% incorrect words (marked with *italics*), but the system doesn't trigger fallback because it only counts *[illegible]* markers, not italicized uncertainties.

**Key findings from current test:**
- Many words incorrectly transcribed and marked with *italics* (e.g., "*shop* no *to* vault" vs "direct from BTP, no vault")
- Domain glossary infrastructure exists but isn't preventing misreads
- Fallback system exists but doesn't trigger (illegiblePercent: 0.0%)
- Quality assessment doesn't recognize italic markers as failures

Current capabilities:
- `src/ocr.ts`: Image preprocessing, AI provider integration, fallback logic
- `src/handwritingReference.ts`: Domain glossary support (already implemented with acronyms, properNouns, businessTerms)
- `src/ocrValidator.ts`: Post-processing validation and correction
- Existing fallback: Claude 4.6 Sonnet → GPT-4.1-mini

**Root cause analysis:**
- Not a missing feature problem - glossary infrastructure exists
- Not a missing terms problem - adding terms won't fix illegible handwriting
- **Actual problem**: Lack of systematic testing/experimentation to find optimal model+preprocessing combination

Constraints:
- Must maintain backward compatibility
- Image size limited to 5MB for AI APIs
- Must work with existing AI provider abstraction

## Goals / Non-Goals

**Goals:**
- Establish automated testing framework to quantify OCR accuracy and detect regressions
- Enable systematic experimentation with different AI models (Claude Opus, GPT-4 Vision, Gemini)
- Improve quality assessment to recognize italicized uncertainties as failures
- Fix fallback triggering to actually use GPT-4 when Claude produces poor results
- Create reproducible benchmarking for model/preprocessing combinations

**Non-Goals:**
- Training custom OCR models (rely on existing vision models)
- Overhauling domain glossary infrastructure (it already exists and works)
- Real-time OCR or streaming transcription
- Handwriting style classification or writer identification
- Achieving 100% accuracy on difficult handwriting (unrealistic)

## Decisions

### Decision 1: Fix Quality Assessment to Recognize Italic Markers

**Choice**: Update `assessOCRQuality()` to count words surrounded by single asterisks (*word*) as uncertainties, similar to *[illegible]* markers.

**Rationale**: 
- Current system only counts explicit *[illegible]* markers (pattern: `\*\[illegible\]\*`)
- Models often mark uncertain words with *italics* (pattern: `\*word\*`) which are missed
- Test output shows ~40% italic words but illegiblePercent: 0.0%
- This prevents fallback from triggering when it should

**Alternatives Considered**:
- Keep only *[illegible]* detection: Rejected because it misses real quality issues
- Manual threshold tuning: Rejected because it doesn't address root cause

**Implementation**:
- Add italic word detection pattern: `/\*([^[\]]+?)\*/g`
- Count both *[illegible]* and *word* patterns in quality metrics
- Update fallback trigger threshold accordingly

### Decision 2: Automated Testing Framework with String Metrics and Baseline Tracking

**Choice**: Build test harness using character edit distance (Levenshtein) and word-level precision/recall/F1 scores, with persistent baseline storage for ongoing comparison.

**Rationale**:
- Provides quantifiable accuracy measurements for experimentation
- Simple string comparison is maintainable and interpretable
- Enables A/B testing of models, preprocessing, prompts
- Baseline tracking ensures we can measure improvement/regression over time
- Track not just accuracy but also cost, performance (latency), and model used

**Alternatives Considered**:
- Semantic similarity (embeddings): Rejected as overkill for character-level accuracy
- Manual validation only: Rejected as not scalable or reproducible

**Implementation**:
- Create `src/ocrTester.ts` with comparison utilities
- Support test discovery: pair `<name>.jpeg` with `<name> expected.txt`
- Compute metrics: character accuracy, word-level F1, line-by-line diff
- Store baseline results in `test-results/baseline.json` with:
  - Model name, timestamp, accuracy metrics, cost estimate, processing time
- Each test run compares against baseline and shows delta (improvement/regression)
- Track multiple metrics: accuracy %, cost per image, latency, italic count

### Decision 3: Unified Experimentation Framework with Scoring and Recommendations

**Choice**: Create a single experimentation framework that works for testing models, prompts, preprocessing, and combinations thereof - all using consistent tabular comparison, scoring, and recommendation output.

**Rationale**:
- Different models have different handwriting recognition strengths
- Prompt engineering can significantly impact results
- Preprocessing parameters affect accuracy
- Need unified way to compare across all dimensions
- Tabular report makes it easy to compare across multiple metrics
- Scoring provides objective ranking based on user priorities
- Automated recommendation reduces decision paralysis
- Reusable framework reduces code duplication

**Alternatives Considered**:
- Separate tools for model/prompt/preprocessing testing: Rejected due to code duplication and inconsistent UX
- Manual comparison: Rejected because it's not reproducible or systematic
- Simple list output: Rejected because hard to compare multiple metrics

**Implementation**:
- Create `src/ocrExperiment.ts` for unified experimentation
- Support experiment types: `model`, `prompt`, `preprocessing`, `combined`
- CLI command: `npm run experiment-ocr -- --type=model --models=opus,gpt4o,gpt4v`
- CLI command: `npm run experiment-ocr -- --type=prompt --prompts=baseline,verbose,concise`
- CLI command: `npm run experiment-ocr -- --type=combined --models=opus,gpt4o --prompts=baseline,verbose`
- Output comparison table with columns: Configuration | Accuracy % | Word F1 | Cost | Latency | Italics | Score
- Scoring algorithm: weighted composite score = (accuracy * 0.7) + ((1 - normalized_cost) * 0.15) + ((1 - normalized_latency) * 0.15)
- Recommendation logic: highest scoring configuration with explanation
- Example output:
  ```
  Experiment: Model Comparison for Dynatrace Q2 04-09
  
  | Model              | Accuracy | Word F1 | Cost   | Latency | Italics | Score |
  |--------------------|----------|---------|--------|---------|---------|-------|
  | gpt-4o             | 85%      | 0.83    | $0.05  | 4.1s    | 12%     | 8.7   |
  | claude-4.6-opus    | 82%      | 0.80    | $0.08  | 5.2s    | 15%     | 8.1   |
  | gpt-4-vision       | 80%      | 0.77    | $0.04  | 3.8s    | 18%     | 7.9   |
  | claude-4.6-sonnet  | 78%      | 0.75    | $0.03  | 3.2s    | 22%     | 7.6   |
  
  Recommendation: GPT-4o (score: 8.7)
  Rationale: Highest accuracy (85%) with acceptable cost/latency tradeoff.
           +7% accuracy vs baseline, +$0.02/image cost.
  ```
- Customizable scoring: `OCR_SCORE_WEIGHTS=accuracy:0.8,cost:0.1,latency:0.1`
- Matrix experiments: test all combinations of variables

### Decision 4: Test Case Directory Structure

**Choice**: Use `test-images/` directory with paired files: `<name>.jpeg` + `<name> expected.txt`.

**Rationale**:
- Simple file-based convention, easy to understand
- Follows common test pattern (input + expected output)
- Allows incremental test case addition
- Start with Dynatrace Q2 04-09 as baseline

**Implementation**:
- Formalize test-images/ structure with README
- Auto-discover test pairs
- No complex test infrastructure needed

### Decision 5: Add Dynatrace Terms to Existing Glossary

**Choice**: Populate handwriting-reference.json with infrastructure terms (BTP, Dynatrace, Vault, Kyma, ArgoCD, etc.) to give models better context.

**Rationale**:
- Infrastructure already exists for glossary
- Won't fix illegibility but provides domain context for borderline cases
- Low effort, might provide marginal gains
- Should be done regardless for completeness

**Alternatives Considered**:
- Skip glossary updates: Rejected because it's easy and might help at margins

**Implementation**:
- Add acronyms: BTP, DT, SPN, K8s, ArgoCD, CAM, CIC, RGM, EDE, PoC, Kyma, e2e
- Add properNouns: Dynatrace, Vault, Azure, JIRA, Pruthvi (person name)
- Add businessTerms: service binding, multi-values file, orphan instance

## Risks / Trade-offs

**Risk**: Different models may have different strengths/weaknesses on different handwriting styles
→ **Mitigation**: Build multiple test cases covering various handwriting styles; accept some variance

**Risk**: Even with best model, difficult handwriting may still produce poor results
→ **Mitigation**: Set realistic accuracy targets (e.g., 80-90%, not 100%); focus on improvement over baseline

**Risk**: Experimentation framework adds maintenance burden
→ **Mitigation**: Keep it simple - just test harness + model switcher, no complex infrastructure

**Trade-off**: More models tested = higher API costs
→ **Accepted**: Testing is one-time cost; once optimal model found, use it consistently

**Trade-off**: Italic detection may increase false positive fallback triggers
→ **Mitigation**: Tune thresholds based on test results; add env var to adjust sensitivity

## Migration Plan

1. **Phase 1 - Testing Infrastructure** (non-breaking):
   - Add `src/ocrTester.ts` with string comparison metrics
   - Formalize test-images/ structure with README
   - Establish baseline accuracy on Dynatrace Q2 04-09 with current model
   - No user-facing changes

2. **Phase 2 - Quality Assessment Fix** (backward compatible):
   - Update `assessOCRQuality()` to detect italic markers (*word*)
   - Tune fallback thresholds based on test results
   - Validate fallback triggers correctly on poor quality
   - May cause more fallback invocations (intentional)

3. **Phase 3 - Model Experimentation** (exploratory):
   - Add `src/ocrExperiment.ts` for batch model testing
   - Run Dynatrace test against: Claude Opus, GPT-4o, GPT-4 Vision, current baseline
   - Analyze results and identify best performing model
   - Update default/fallback model configuration if better option found

4. **Phase 4 - Glossary Population** (backward compatible):
   - Add Dynatrace/infrastructure terms to handwriting-reference.json
   - Re-test to measure marginal improvement
   - Document glossary curation process

**Rollback Strategy**:
- Phase 1: No rollback needed (testing only)
- Phase 2: Provide `OCR_LEGACY_QUALITY_CHECK=true` to revert to old assessment
- Phase 3: Experimentation doesn't change defaults, no rollback needed
- Phase 4: Can remove glossary entries if they cause issues

**Validation**:
- Establish baseline: Current model accuracy on Dynatrace test
- Target: Find model combination that achieves >80% word-level accuracy
- Success criteria: Measurable improvement with automated tests confirming gains

## Open Questions

1. **Which vision model will perform best on this handwriting style?**
   - Candidates: Claude 4.6 Opus, GPT-4o, GPT-4 Vision, Gemini Pro Vision
   - Need empirical testing to determine - no way to predict
   - Decision: Build experimentation framework and test systematically

2. **What accuracy threshold should trigger fallback?**
   - Current: 15% illegible markers (but doesn't count italics)
   - With italic detection: 20%? 30%? 40%?
   - Decision: Tune based on test results after italic detection implemented

3. **Is preprocessing optimization worth exploring?**
   - Current: grayscale, resize, normalize, sharpen
   - Could try: different sharpening, denoising, contrast adjustment
   - Decision: Defer until after model experimentation - model choice likely has bigger impact
