---
name: list-available-models
description: Query HAI proxy and AI providers to list available models with their capabilities, focusing on vision-capable models suitable for OCR tasks
license: MIT
compatibility: Requires HAI proxy running and configured
metadata:
  author: note-gen
  version: "1.0"
---

Query available AI models from HAI proxy and providers. Focus on vision-capable models suitable for handwriting OCR.

## Steps

1. **Check HAI proxy status**
   ```bash
   # Verify HAI proxy is running
   curl -s http://localhost:6655/health 2>&1 || echo "HAI proxy not accessible"
   ```

2. **Get HAI proxy API key from config**
   ```bash
   # Read API key from AI provider config
   node -e "const config = require('./handwriting-reference.json'); console.log(config.aiProvider?.haiApiKey || 'Not configured')" 2>&1 || echo "Config not found"
   ```

3. **Query OpenAI models through HAI proxy**
   ```bash
   # List OpenAI models via HAI proxy
   curl -s -H "Authorization: Bearer <API_KEY>" http://localhost:6655/openai/v1/models | jq -r '.data[] | select(.id | contains("gpt") or contains("o1") or contains("o3")) | {id: .id, created: .created}' 2>&1
   ```

4. **Query Anthropic models through HAI proxy**
   ```bash
   # List Claude models via HAI proxy
   curl -s -H "Authorization: Bearer <API_KEY>" -H "anthropic-version: 2023-06-01" http://localhost:6655/anthropic/v1/models | jq -r '.data[]? | {id: .id, display_name: .display_name}' 2>&1
   ```

5. **Query OpenAI API directly (if OPENAI_API_KEY available)**
   ```bash
   # List models directly from OpenAI
   if [ -n "$OPENAI_API_KEY" ]; then
     curl -s -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models | jq -r '.data[] | select(.id | contains("gpt") or contains("o1") or contains("o3")) | {id: .id, created: .created}' 2>&1
   fi
   ```

6. **Identify vision-capable models**
   
   From the results, filter for models with vision capabilities:
   - **OpenAI**: gpt-4o, gpt-4-turbo, gpt-4-vision-preview, gpt-5*, o1*, o3* (if available)
   - **Anthropic**: claude-*-opus-*, claude-*-sonnet-* (all recent Claude models have vision)

7. **Compare with current DEFAULT_MODELS**
   
   Read `src/ocrExperiment.ts` to see which models are already configured:
   ```bash
   grep -A 20 "export const DEFAULT_MODELS" src/ocrExperiment.ts
   ```

8. **Generate report**
   
   Create a markdown table showing:
   - Model ID
   - Provider (OpenAI/Anthropic)
   - Vision capable? (Yes/No)
   - Currently in DEFAULT_MODELS? (Yes/No)
   - Recommended for testing? (Yes/No)
   - Notes (e.g., "Newer than current default", "Higher cost tier")

## Output Format

```markdown
# Available AI Models for OCR Testing

**Date**: <timestamp>
**HAI Proxy**: <running/not-running>

## Vision-Capable Models Available

| Model ID | Provider | In Config? | Recommended? | Notes |
|----------|----------|------------|--------------|-------|
| gpt-5.5 | OpenAI | No | Yes | Newer vision model |
| gpt-4o | OpenAI | Yes | - | Current default |
| claude-sonnet-4.6 | Anthropic | Yes | - | Current default |
...

## Recommendations

Based on the available models:
1. **Add to testing**: <list of new models to add>
2. **Already tested**: <list of current models>
3. **Not suitable**: <list of models without vision or not for OCR>

## Next Steps

To add new models to the experiment framework:
1. Add model config to `src/ocrExperiment.ts` DEFAULT_MODELS
2. Run experiments: `npm run experiment-ocr <image> -- --type=model --models=<new-model>,gpt-4o,claude-sonnet-4.6`
```

## Error Handling

- If HAI proxy is not running: Provide instructions to start it with `hai proxy start`
- If API keys are missing: Show which environment variables need to be set
- If model list queries fail: Show the error and suggest checking authentication

## Notes

- This skill does NOT modify any files, only queries and reports
- Focus on vision-capable models since OCR requires image input
- HAI proxy may have different model naming conventions (e.g., `anthropic--claude-4.5-sonnet`)
