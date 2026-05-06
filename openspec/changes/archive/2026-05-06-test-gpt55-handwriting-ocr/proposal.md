## Why

OpenAI has released GPT-5.5 with improved vision capabilities. We need to evaluate whether GPT-5.5 provides better handwriting OCR accuracy than our current models (GPT-4o, Claude 4.5 Sonnet) using our existing experiment framework and update our model selection guidance.

## What Changes

- Query HAI proxy and OpenAI API to discover available new models (GPT-5.5, others)
- Add newly available models to the existing experiment framework's model configurations
- Run OCR experiments using existing CLI tools to evaluate new models against current models
- Update model recommendations and documentation based on experiment results
- Update default model configuration if new models prove superior
- Create skill to list available models through HAI proxy for future use

## Capabilities

### New Capabilities
None - using existing experiment infrastructure in src/ocrExperiment.ts

### Modified Capabilities
- `ai-provider-configuration`: Add GPT-5.5 as a supported model option with appropriate configuration parameters
- `ocr-processing`: Update default model selection based on GPT-5.5 experiment results if it demonstrates superior handwriting recognition

## Impact

- **Code**: Model configurations in ocrExperiment.ts, potentially OpenAI provider adapter
- **Configuration**: Model selection defaults in DEFAULT_MODELS
- **Testing**: Use existing experiment CLI (experimentOCR.ts) for model comparison
- **Documentation**: Updated model recommendations and performance guidance
- **Dependencies**: No new external dependencies (uses existing OpenAI SDK)
- **Performance**: Potential improvement in OCR accuracy if GPT-5.5 outperforms current models
