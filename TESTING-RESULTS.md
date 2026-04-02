# HAI Proxy Testing Results

Date: April 2, 2026

## Summary

Successfully tested and verified **10 AI models** through HAI proxy for handwritten OCR:
- ✅ **6 Claude models** - All working
- ✅ **4 OpenAI models** - All working (after fixes)
- ❌ **3 Gemini models** - Not available

## Test Results

### Claude Models via HAI Proxy (6/6 Working)

| Model | Technical Name | Accuracy | Status | Notes |
|-------|---------------|----------|--------|-------|
| Claude 4.6 Sonnet | `anthropic--claude-4.6-sonnet` | 100% | ✅ Pass | Best performer, recommended |
| Claude 4.6 Opus | `anthropic--claude-4.6-opus` | 100% | ✅ Pass | Highest accuracy tier |
| Claude 4.5 Opus | `anthropic--claude-4.5-opus` | 90% | ✅ Pass | High performance |
| Claude 4.5 Sonnet | `anthropic--claude-4.5-sonnet` | 60% | ✅ Pass | Good for handwriting |
| Claude 4.5 Haiku | `anthropic--claude-4.5-haiku` | 60% | ✅ Pass | Fast, cost-effective |
| Claude 4 Sonnet | `anthropic--claude-4-sonnet` | 50% | ✅ Pass | Previous generation |

**Configuration**: `.env.proxy.claude`  
**Endpoint**: `http://localhost:6655/anthropic/`  
**Auth**: `ANTHROPIC_AUTH_TOKEN` or `HAI_API_KEY`

### OpenAI Models via HAI Proxy (4/4 Working)

| Model | Technical Name | Accuracy | Status | Notes |
|-------|---------------|----------|--------|-------|
| GPT-5 Mini | `gpt-5-mini` | 90% | ✅ Pass | Fast, cost-effective |
| GPT-4.1 Mini | `gpt-4.1-mini` | 90% | ✅ Pass | Balanced option |
| GPT-5 | `gpt-5` | 80% | ✅ Pass | Latest, high capability |
| GPT-4.1 | `gpt-4.1` | 70% | ✅ Pass | High capability |

**Configuration**: `.env.proxy.openai`  
**Endpoint**: `http://localhost:6655/openai/v1`  
**Auth**: `ANTHROPIC_AUTH_TOKEN` or `HAI_API_KEY` (same as Claude!)

### Gemini Models (0/3 Available)

| Model | Technical Name | Status | Reason |
|-------|---------------|--------|--------|
| Gemini 2.5 Pro | `gemini-2.5-pro` | ❌ Not Available | 404 - Model not found |
| Gemini 2.5 Flash | `gemini-2.5-flash` | ❌ Not Available | 404 - Model not found |
| Gemini 2.5 Flash Lite | `gemini-2.5-flash-lite` | ❌ Not Available | 404 - Model not found |

**Issue**: Gemini models appear in SAP AI LLM Proxy documentation but are not actually accessible through any endpoint.

## Issues Found and Fixed

### Issue 1: OpenAI Authentication (401 Error)

**Problem**: Code was looking for `OPENAI_API_KEY` environment variable for `hai-openai` provider.

**Root Cause**: HAI proxy uses the same authentication token for both OpenAI and Claude endpoints, but our code was configured differently.

**Solution**: Updated `src/handwritingReference.ts:424-434` to use `ANTHROPIC_AUTH_TOKEN`/`HAI_API_KEY` for `hai-openai` provider.

```typescript
// Before
if (providerType === 'openai' || providerType === 'hai-openai') {
  return process.env.OPENAI_API_KEY;
}

// After
if (providerType === 'openai') {
  return process.env.OPENAI_API_KEY;
}

if (providerType === 'hai-openai') {
  // HAI proxy uses the same auth token for both endpoints
  return process.env.ANTHROPIC_AUTH_TOKEN || process.env.HAI_API_KEY;
}
```

### Issue 2: OpenAI API Parameter (400 Error)

**Problem**: GPT-5 and GPT-4.1 models returned `400 - unsupported_parameter: 'max_tokens' is not supported`.

**Root Cause**: Newer OpenAI models (GPT-5, GPT-4.1) require `max_completion_tokens` instead of `max_tokens`.

**Solution**: Updated `src/aiProvider.ts` to detect new models and use the correct parameter:

```typescript
// Detect new model naming
const isNewModel = model.startsWith('gpt-5') || model.startsWith('gpt-4.1');
const tokenParams: any = isNewModel
  ? { max_completion_tokens: 5000 }
  : { max_tokens: 5000 };

// Use spread operator to include correct param
const response = await this.client.chat.completions.create({
  model,
  temperature: 0.0,
  messages: [...],
  ...tokenParams,
});
```

Applied to both:
- `generateVisionCompletion()` method (for OCR)
- `generateTextCompletion()` method (for summarization/validation)

### Issue 3: Gemini Models Not Available

**Problem**: All Gemini models returned `404 - The model 'invoke' does not exist`.

**Investigation**:
- Tested through Anthropic endpoint: ❌ Not found
- Checked for separate Gemini endpoint: ❌ Doesn't exist
- Verified with curl: ❌ Models not available

**Conclusion**: Gemini models are listed in SAP AI LLM Proxy documentation but are not actually deployed or accessible. This may be a future feature or requires special permissions.

**Action Taken**:
- Removed Gemini configuration and test files
- Updated documentation to note Gemini models are not available
- Removed Gemini from test launcher menu

## Configuration Files

### Working Configurations

**`.env.proxy.claude`** - Claude models (RECOMMENDED)
```env
AI_PROVIDER=hai-claude
AI_MODEL_OCR=anthropic--claude-4.6-sonnet
AI_MODEL_SUMMARIZATION=anthropic--claude-4.5-haiku
AI_MODEL_VALIDATION=anthropic--claude-4.5-haiku

HAI_AUTO_START=true
HAI_PROXY_PORT=6655
ANTHROPIC_BASE_URL=http://localhost:6655/anthropic/
```

**`.env.proxy.openai`** - OpenAI models
```env
AI_PROVIDER=hai-openai
AI_MODEL_OCR=gpt-5
AI_MODEL_SUMMARIZATION=gpt-5-mini
AI_MODEL_VALIDATION=gpt-5-mini

HAI_AUTO_START=true
HAI_PROXY_PORT=6655
OPENAI_BASE_URL=http://localhost:6655/openai/v1
```

### How HAI Proxy Authentication Works

Both Claude and OpenAI endpoints use the **same authentication token**:
- Token is stored in: `ANTHROPIC_AUTH_TOKEN` or `HAI_API_KEY`
- Token format: UUID (e.g., `46c9d100-1...`)
- Auto-configured by: `hai auth login`
- Used for: Both `/anthropic/` and `/openai/v1` endpoints

## Test Scripts

All test scripts located in `tests/` directory:

- `./tests/test-claude.sh` - Test 6 Claude models (~5-7 min)
- `./tests/test-openai.sh` - Test 4 OpenAI models (~3-5 min)
- `./tests/test-all-models.sh` - Test all 10 models (~10-15 min)
- `./test-models.sh` - Interactive test launcher (root directory)

## Recommendations

1. **Use Claude 4.6 Sonnet for OCR** - Best accuracy (100%) at reasonable speed
2. **Use Claude 4.5 Haiku for summarization** - Fast and cost-effective
3. **HAI proxy is free for SAP employees** - No API costs!
4. **OpenAI models work but** - Lower accuracy than Claude for handwriting
5. **Avoid older models (Claude 4)** - Significantly lower accuracy

## Known Limitations

1. **Gemini models not available** - Despite being in documentation
2. **Model accuracy varies** - Same image tested across all models shows 50-100% range
3. **Processing time varies** - Some models take 30+ seconds per image
4. **HAI proxy required** - Must have HAI CLI installed and authenticated

## Files Modified

### Core Code Changes
- `src/aiProvider.ts` - Added GPT-5/4.1 parameter support, updated validation
- `src/handwritingReference.ts` - Fixed HAI OpenAI authentication

### Configuration Files
- `.env.proxy.claude` - Claude configuration (working)
- `.env.proxy.openai` - OpenAI configuration (working)
- `.env.direct.openai` - Direct OpenAI configuration (working)

### Test Scripts
- `tests/test-claude.sh` - Updated model list
- `tests/test-openai.sh` - Updated model list, fixed auth
- `tests/test-all-models.sh` - Tests all 10 working models
- `test-models.sh` - Updated menu

### Documentation
- `README.md` - Updated model lists
- `CONFIG.md` - Added configuration guide
- `TESTING.md` - Testing guide
- `tests/MODELS.md` - Model reference
- `TESTING-RESULTS.md` - This file

## Next Steps

1. ✅ All working models verified and tested
2. ✅ Documentation updated
3. ✅ Configuration files ready
4. ⏭️ Consider updating default models in README
5. ⏭️ Monitor HAI proxy for Gemini model availability
6. ⏭️ Add more test images to verify consistency

## Support

If you encounter issues:
1. Check HAI proxy is running: `lsof -i :6655`
2. Verify authentication: `hai auth login`
3. Check logs: `hai proxy start --verbose`
4. Review this document for known issues
