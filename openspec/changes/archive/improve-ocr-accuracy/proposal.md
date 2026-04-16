## Why

The current OCR system is producing poor quality transcriptions with many incorrect words marked as uncertain (italics), as demonstrated by test-images/Dynatrace Q2 04-09.jpeg. Testing reveals ~40% of words are misread despite having domain glossary infrastructure already in place. The root issue is not missing features but lack of systematic testing and experimentation to optimize model selection, preprocessing, and prompt strategies.

## What Changes

- Add automated testing framework to quantify OCR accuracy and track improvements
- Create systematic experimentation capability for testing different AI models, preprocessing parameters, and prompt strategies
- Enhance quality assessment to detect italicized uncertainties (not just *[illegible]* markers) as OCR failures
- Add model comparison utilities to benchmark Claude vs GPT-4 vs other vision models
- Populate domain glossary with Dynatrace/infrastructure-specific terms for current test case

## Capabilities

### New Capabilities
- `ocr-testing`: Automated testing framework for validating OCR accuracy against gold standard expected outputs, including string comparison metrics (edit distance, precision/recall, F1)
- `ocr-experimentation`: Model and parameter experimentation framework for benchmarking different vision models, preprocessing settings, and prompt strategies

### Modified Capabilities
- `ocr-processing`: Enhanced quality assessment that recognizes italicized words as accuracy failures, improved fallback triggering based on italic density

## Impact

- **Files Modified**:
  - `src/ocr.ts`: Enhanced quality assessment to detect italic density, improved fallback triggering
  - `src/handwritingReference.ts`: No changes needed (glossary infrastructure exists)
  - `handwriting-reference.json`: Add Dynatrace/infrastructure terms to existing glossary
  
- **New Files**:
  - `src/ocrTester.ts`: Test harness for validating OCR against expected outputs with string comparison metrics
  - `src/ocrExperiment.ts`: Utilities for benchmarking different models, preprocessing, and prompts
  - `test-images/README.md`: Documentation of test case format and usage
  
- **Configuration**:
  - New env vars for experimentation (model overrides, preprocessing toggles)
  
- **Testing**: Automated test suite with baseline measurement and regression detection
