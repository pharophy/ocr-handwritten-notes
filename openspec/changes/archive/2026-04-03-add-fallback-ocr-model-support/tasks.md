## 1. Quality Assessment Implementation

- [x] 1.1 Create assessOCRQuality() function in src/ocr.ts with illegible marker counting
- [x] 1.2 Add consecutive illegible pattern detection (5+ markers in sequence)
- [x] 1.3 Implement output length vs image size validation
- [x] 1.4 Add configurable thresholds via environment variables (OCR_ILLEGIBLE_THRESHOLD, OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD, OCR_MIN_LENGTH_THRESHOLD, OCR_MIN_IMAGE_SIZE)
- [x] 1.5 Return structured quality assessment object with isPoorQuality, metrics, and reason

## 2. Provider Type Simplification

- [x] 2.1 Update ProviderType enum in src/aiProvider.ts to only OPENAI and HAI
- [x] 2.2 Create getHAIEndpointForModel() helper function for model-based routing
- [x] 2.3 Implement HAIProvider class with dynamic endpoint selection based on model name
- [x] 2.4 Update OpenAIProvider to handle both direct and HAI proxy configurations
- [x] 2.5 Update loadAIProviderConfig() in src/handwritingReference.ts to use simplified provider types

## 3. OCR Return Type Modification

- [x] 3.1 Change processHandwrittenImage() return type to { text: string; modelUsed: string } | null
- [x] 3.2 Update all return statements in src/ocr.ts to include modelUsed field
- [x] 3.3 Update src/main.ts to destructure OCR result and extract text and modelUsed
- [x] 3.4 Update src/convert-single.ts to destructure OCR result
- [x] 3.5 Add model tracking to validation reports in both main.ts and convert-single.ts

## 4. Fallback Mechanism Implementation

- [x] 4.1 Add quality assessment call after primary OCR completion
- [x] 4.2 Check for AI_MODEL_OCR_FALLBACK configuration and validate it's not 'none' or empty
- [x] 4.3 Implement provider type detection for fallback model based on model name prefix
- [x] 4.4 Create fallback provider configuration by copying primary config and modifying type/baseURL/model
- [x] 4.5 Execute fallback OCR with same prompt and preprocessed image
- [x] 4.6 Assess fallback output quality and log comparison
- [x] 4.7 Return fallback result with annotated modelUsed string (e.g., "model (fallback from primary)")
- [x] 4.8 Handle fallback API errors gracefully and return primary result with annotation

## 5. Configuration Updates

- [x] 5.1 Update .env to use AI_PROVIDER=hai instead of hai-claude
- [x] 5.2 Update .env.proxy.claude template with simplified provider type
- [x] 5.3 Update .env.proxy.openai template with simplified provider type
- [x] 5.4 Remove ANTHROPIC_BASE_URL and OPENAI_BASE_URL from all .env files (HAI auto-routes)
- [x] 5.5 Add AI_MODEL_OCR_FALLBACK to all .env templates with cross-provider fallback examples

## 6. Documentation

- [x] 6.1 Update README.md with fallback feature explanation and real-world example
- [x] 6.2 Add "How It Works" section documenting quality assessment and fallback logic
- [x] 6.3 Add monitoring section with example log output
- [x] 6.4 Update .env.example with comprehensive threshold documentation
- [x] 6.5 Document provider simplification and model-based routing behavior

## 7. Testing and Validation

- [x] 7.1 Test primary OCR with good quality handwriting (verify no fallback triggered)
- [x] 7.2 Test primary OCR with poor quality handwriting (verify fallback triggers)
- [x] 7.3 Verify cross-provider fallback works (Claude → OpenAI)
- [x] 7.4 Verify reverse cross-provider fallback works (OpenAI → Claude)
- [x] 7.5 Test fallback disabled with AI_MODEL_OCR_FALLBACK=none
- [x] 7.6 Verify model tracking appears correctly in validation reports
- [x] 7.7 Test threshold configuration changes affect fallback trigger behavior
