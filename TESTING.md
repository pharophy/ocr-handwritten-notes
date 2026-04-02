# OCR Model Testing Suite

This directory contains scripts for testing OCR accuracy across different AI models.

## Configuration Files

- **`.env.claudeproxy`** - Configuration for Claude models via HAI proxy (free for SAP employees)
- **`.env.openai`** - Configuration for OpenAI models (requires API key, costs money)
- **`.env`** - Active configuration (defaults to Claude)

## Test Scripts

### Quick Tests

```bash
# Test OpenAI models only (GPT-4o, GPT-4 Turbo)
./test-openai.sh

# Test Claude models only (Sonnet, Haiku, Opus)
./test-claude.sh

# Test all models
./test-all-models.sh
```

### What Gets Tested

Each script tests OCR accuracy by:
1. Loading the test image (`test-images/Cosine 02-26.jpeg`)
2. Running OCR with each model
3. Checking for 10 ground-truth phrases
4. Calculating accuracy percentage
5. Generating detailed results

## Test Results

Results are saved to `test-results/` directory with timestamps:
- `openai-comparison-YYYYMMDD-HHMMSS.txt` - OpenAI test results
- `claude-comparison-YYYYMMDD-HHMMSS.txt` - Claude test results
- `complete-comparison-YYYYMMDD-HHMMSS.txt` - Combined results

## Switching Configurations

To switch between providers for regular use:

```bash
# Use Claude (recommended - free and fast)
cp .env.claudeproxy .env

# Use OpenAI (costs ~$0.03 per image)
cp .env.openai .env
```

## Latest Test Results

**Winner: Claude 3.5 Haiku** 🏆
- Accuracy: 60%
- Cost: Free (via HAI proxy)
- Speed: Fast

**Runner-up: OpenAI GPT-4o**
- Accuracy: 50%
- Cost: ~$0.03 per image
- Speed: Medium

**Other Models:**
- Claude 3.5 Sonnet: 50% (free)
- Claude 3 Opus: 50% (free, slower)
- OpenAI GPT-4 Turbo: Not supported (no vision)

## Notes

- Tests require ~3-5 minutes to complete all models
- OpenAI tests require valid API key in `.env.openai`
- Claude tests require HAI CLI installed and authenticated
- Test image is challenging (22848px tall) - real-world results typically better
