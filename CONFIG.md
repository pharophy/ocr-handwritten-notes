# Configuration Guide

Complete guide to configuring AI models, providers, and OCR settings based on comprehensive testing and experimentation.

---

## 📊 Quick Model Selection (Based on Experiments)

**Recommended for most users:**
```env
AI_MODEL_OCR=gpt-5-mini                          # Winner: 91.2% accuracy, $0.02/image
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini              # Fallback: 85.6% accuracy, $0.02/image
AI_MODEL_SUMMARIZATION=anthropic--claude-4.5-haiku
AI_MODEL_VALIDATION=anthropic--claude-4.5-haiku
```

**Why GPT-5 Mini?** See [experiments/003-hai-proxy-compatible/findings.md](experiments/003-hai-proxy-compatible/findings.md)
- 91.2% accuracy (best of all tested models)
- $0.02/image (83% cheaper than Claude Sonnet)
- 0% uncertainty markers (confident output)
- Available via HAI proxy (zero cost for SAP employees)

---

## 📁 Available Configuration Files

Pre-configured `.env.*` templates for quick setup:

| File | Provider | Primary Model | Best For | Accuracy | Cost |
|------|----------|---------------|----------|----------|------|
| `.env` | HAI Proxy | **GPT-5 Mini** ⭐ | Current production config | 91.2% | $0.02 |
| `.env.proxy.openai` | HAI Proxy | GPT-5 | Latest GPT models | 82.3% | $0.10 |
| `.env.proxy.claude` | HAI Proxy | Claude 4.6 Sonnet | High accuracy, more expensive | 90.3% | $0.12 |
| `.env.direct.openai` | OpenAI Direct | GPT-5 | Non-SAP users (requires API key) | 82.3% | $0.10 |

---

## 🚀 Quick Start

### 1. Using Current Production Config (Recommended)

Already configured for best results:
```bash
# Your .env is already set to GPT-5 Mini
npm start
```

### 2. Test a Different Configuration

```bash
# Try Claude models (more expensive but good)
cp .env.proxy.claude .env
npm start

# Try OpenAI GPT-5 (larger model, more cost)
cp .env.proxy.openai .env
npm start

# Restore production config
git checkout .env
```

### 3. Create Custom Configuration

```bash
# Copy a template
cp .env.proxy.openai .env.custom

# Edit .env.custom with your preferred models
# Then use it:
cp .env.custom .env
npm start
```

---

## 🔍 Model Selection Guide

### HAI Proxy Available Models (Verified 2026-04-16)

Based on experiments testing actual HAI proxy availability:

#### OpenAI Models (via HAI Proxy)

| Model | Accuracy | Cost/Image | Speed | Use Case | Experiment |
|-------|----------|------------|-------|----------|------------|
| **gpt-5-mini** ⭐ | 91.2% | $0.02 | 51.6s | **Production OCR** | [003](experiments/003-hai-proxy-compatible/) |
| gpt-4.1-mini | 85.6% | $0.02 | 39.7s | Fast fallback | [003](experiments/003-hai-proxy-compatible/) |
| gpt-5 | 82.3% | $0.10 | 55.4s | Testing only | [003](experiments/003-hai-proxy-compatible/) |
| gpt-4.1 | - | - | - | Vision not supported | [003](experiments/003-hai-proxy-compatible/) |

**⚠️ NOT Available in HAI Proxy:**
- `gpt-4o` - Does not exist (discovered in [Experiment 001](experiments/001-initial-model-comparison/))
- `gpt-4-vision-preview` - Not supported (tested in [Experiment 002](experiments/002-full-model-suite/))

#### Claude Models (via HAI Proxy)

| Model | Accuracy | Cost/Image | Speed | Use Case | Experiment |
|-------|----------|------------|-------|----------|------------|
| anthropic--claude-4.6-sonnet | 90.3% | $0.12 | 52.6s | High accuracy | [003](experiments/003-hai-proxy-compatible/) |
| anthropic--claude-4.6-opus | 90.2% | $0.62 | 30.5s | Not worth cost | [003](experiments/003-hai-proxy-compatible/) |
| anthropic--claude-4.5-sonnet | - | - | - | Not tested | - |
| anthropic--claude-4.5-haiku | - | - | - | Summarization | Production |

### Model Comparison Summary

From [EXPERIMENTS.md](EXPERIMENTS.md):

```
| Model             | Accuracy | Word F1 | Cost   | Latency | Italics | Score |
|-------------------|----------|---------|--------|---------|---------|-------|
| GPT-5 Mini ⭐     | 91.2%    | 0.588   | $0.021 | 51.6s   | 0.0%    | 75.7  |
| GPT-4.1 Mini      | 85.6%    | 0.598   | $0.021 | 39.7s   | 0.5%    | 71.8  |
| Claude Sonnet     | 90.3%    | 0.604   | $0.123 | 52.6s   | 0.0%    | 63.2  |
| Claude Opus       | 90.2%    | 0.592   | $0.617 | 30.5s   | 0.0%    | 63.1  |
| GPT-5             | 82.3%    | 0.590   | $0.103 | 55.4s   | 0.0%    | 57.6  |
```

**Composite Score:** `accuracy × 0.7 + cost × 0.15 + latency × 0.15`

---

## 🎯 Configuration Scenarios

### Scenario 1: Maximum Accuracy (Cost No Object)

```env
AI_MODEL_OCR=gpt-5-mini                      # 91.2% accuracy
AI_MODEL_OCR_FALLBACK=anthropic--claude-4.6-sonnet  # 90.3% fallback
```
- **Accuracy**: 91.2% primary, 90.3% fallback
- **Cost**: $0.02 primary, $0.12 fallback
- **Use Case**: When accuracy is critical

### Scenario 2: Best Value (Current Production) ⭐

```env
AI_MODEL_OCR=gpt-5-mini                      # 91.2% accuracy
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini          # 85.6% fallback
```
- **Accuracy**: 91.2% primary, 85.6% fallback
- **Cost**: $0.02 both (lowest possible)
- **Use Case**: Production default

### Scenario 3: Fastest Processing

```env
AI_MODEL_OCR=gpt-4.1-mini                    # 39.7s latency
AI_MODEL_OCR_FALLBACK=gpt-5-mini            # Upgrade on failure
```
- **Speed**: 39.7s (fastest tested)
- **Accuracy**: 85.6% (acceptable)
- **Use Case**: High-volume batch processing

### Scenario 4: Cross-Provider Redundancy

```env
AI_MODEL_OCR=gpt-5-mini                      # OpenAI primary
AI_MODEL_OCR_FALLBACK=anthropic--claude-4.6-sonnet  # Claude fallback
```
- **Resilience**: Different providers handle different handwriting styles
- **Cost**: $0.02 primary, $0.12 fallback
- **Use Case**: Maximum reliability

### Scenario 5: Claude-First (Higher Cost)

```env
AI_MODEL_OCR=anthropic--claude-4.6-sonnet    # 90.3% accuracy
AI_MODEL_OCR_FALLBACK=gpt-5-mini            # Cheaper fallback
```
- **Accuracy**: 90.3% primary (0.9% lower than GPT-5 Mini)
- **Cost**: $0.12 primary, $0.02 fallback (5x more expensive)
- **Use Case**: Claude preference, willing to pay more

---

## ⚙️ Configuration Options

### Core AI Settings

```env
# AI Provider Selection
AI_PROVIDER=hai                              # Options: hai, anthropic, openai

# Vision Models (OCR)
AI_MODEL_OCR=gpt-5-mini                      # Primary OCR model
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini          # Automatic fallback on poor quality

# Text Models (Summarization)
AI_MODEL_SUMMARIZATION=anthropic--claude-4.5-haiku
AI_MODEL_VALIDATION=anthropic--claude-4.5-haiku
```

### HAI Proxy Settings

```env
# HAI Proxy Configuration
HAI_AUTO_START=true                          # Auto-start proxy if not running
HAI_PROXY_PORT=6655                          # Default HAI proxy port
# HAI_API_KEY=xxx                            # Only needed for HAI Desktop App
```

### OCR Quality Thresholds

Based on [experiments/003-hai-proxy-compatible/findings.md](experiments/003-hai-proxy-compatible/findings.md):

```env
# Quality Assessment (Enhanced Detection)
OCR_UNCERTAIN_THRESHOLD=30                   # Trigger fallback at >30% uncertainty
OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD=5       # Trigger on 5+ consecutive illegibles
OCR_LEGACY_QUALITY_CHECK=false               # Use combined illegible + italic detection
```

**How it works:**
- `uncertainPercent = illegiblePercent + italicPercent`
- Fallback triggers when `uncertainPercent > 30%`
- Italic markers (`*word*`) indicate model uncertainty
- See [openspec/changes/improve-ocr-accuracy/specs/ocr-processing/spec.md](openspec/changes/improve-ocr-accuracy/specs/ocr-processing/spec.md)

### Image Compression

```env
# Image Compression (for large images)
IMAGE_COMPRESSION_ENABLED=true
IMAGE_COMPRESSION_MAX_SIZE_MB=20            # GPT supports 20MB (Claude: 5MB)
IMAGE_COMPRESSION_MIN_QUALITY=70            # Minimum JPEG quality
```

**Provider Limits:**
- Claude models: 5MB max
- GPT models: 20MB max
- Recommendation: Set `MAX_SIZE_MB=20` with GPT-5 Mini

### Handwriting Reference

```env
# Handwriting Reference (optional)
HANDWRITING_REFERENCE_ENABLED=true
HANDWRITING_REFERENCE_FILE=./handwriting-reference.json
```

See [docs/guides/glossary-curation.md](docs/guides/glossary-curation.md) for domain-specific term configuration.

---

## 🧪 Testing Configurations

### Test Scripts

Pre-configured test scripts in `tests/`:

```bash
# Test all models (comprehensive)
./tests/test-all-models.sh

# Test specific provider
./tests/test-claude.sh          # 6 Claude models
./tests/test-openai.sh          # 4 OpenAI models
```

Scripts automatically:
1. Backup your current `.env`
2. Test each model configuration
3. Generate results in `test-results/`
4. Restore your original `.env`

### Experimentation Framework

Use the structured experimentation workflow:

```bash
# Ideate new experiments
/experiment-ocr

# Run model comparison
npm run experiment-ocr "test-images/sample.jpeg" -- --type=model

# Test specific models
npm run experiment-ocr "test-images/sample.jpeg" -- --models=gpt-5-mini,claude-sonnet

# Run test suite
npm run test-ocr-suite
```

See [experiments/README.md](experiments/README.md) for experiment structure and templates.

---

## 💰 Cost Analysis

From [OCR_MODEL_SELECTION.md](OCR_MODEL_SELECTION.md):

### Cost Per Image

| Model | Cost | vs GPT-5 Mini |
|-------|------|---------------|
| **GPT-5 Mini** ⭐ | $0.02 | Baseline |
| GPT-4.1 Mini | $0.02 | Same |
| GPT-5 | $0.10 | +400% |
| Claude Sonnet | $0.12 | +500% |
| Claude Opus | $0.62 | +3000% |

### Annual Savings (Production Config)

```
Volume: 10,000 images/year

Before (Claude Sonnet):  $1,200/year
After (GPT-5 Mini):      $200/year
Annual Savings:          $1,000/year (83% reduction)
```

---

## 🔧 Troubleshooting

### Model Not Found

```bash
# List available models via HAI proxy
curl -H "Authorization: Bearer $HAI_API_KEY" \
  http://localhost:6655/openai/v1/models | jq '.data[].id'
```

**Common Issues:**
- Using `gpt-4o` (doesn't exist) → Use `gpt-5` or `gpt-5-mini`
- Using `gpt-4-vision-preview` (not supported) → Use `gpt-4.1-mini`
- Wrong format: `anthropic-claude` → Use `anthropic--claude` (double dash)

### HAI Proxy Not Starting

```bash
# Check if running
lsof -i :6655

# Manually start (HAI CLI)
hai proxy start

# Check status
hai proxy status

# Desktop App: Start from app, then set HAI_AUTO_START=false
```

### Low Accuracy

From [experiments/003-hai-proxy-compatible/findings.md](experiments/003-hai-proxy-compatible/findings.md):

1. ✓ Using `gpt-5-mini` (best accuracy: 91.2%)?
2. ✓ Image quality good (clear, high contrast)?
3. ✓ Handwriting reference configured?
4. ✓ Check uncertainty markers (should be 0-2%)

```bash
# Run test to see actual accuracy
npm run test-ocr "test-images/your-image.jpeg" -- --show-diff
```

### Configuration Changes Not Applied

**Root Cause:** CLI tools need explicit dotenv loading

**Solution:** Restart the process after `.env` changes:
```bash
# Kill and restart
pkill -f "tsx src/main.ts"
npm start
```

See [experiments/003-hai-proxy-compatible/findings.md](experiments/003-hai-proxy-compatible/findings.md) - Discovery #4

### Image Too Large

```env
# For GPT models (support 20MB)
IMAGE_COMPRESSION_MAX_SIZE_MB=20

# For Claude models (5MB limit)
IMAGE_COMPRESSION_MAX_SIZE_MB=5

# More aggressive compression
IMAGE_COMPRESSION_MIN_QUALITY=60    # Risk: may affect text readability
```

---

## 📚 Related Documentation

- **[EXPERIMENTS.md](EXPERIMENTS.md)** - Experiment history and key findings
- **[OCR_MODEL_SELECTION.md](OCR_MODEL_SELECTION.md)** - Detailed test results and recommendations
- **[experiments/README.md](experiments/README.md)** - Experiment structure and templates
- **[README.md](README.md)** - Main project documentation
- **[docs/guides/glossary-curation.md](docs/guides/glossary-curation.md)** - Domain-specific term configuration

---

## 🔄 Configuration History

| Date | Change | Reason | Experiment |
|------|--------|--------|------------|
| 2026-04-16 | Switch to GPT-5 Mini | 91.2% accuracy, 83% cost reduction | [003](experiments/003-hai-proxy-compatible/) |
| 2026-04-15 | Add GPT-4.1 Mini fallback | Cross-provider redundancy | [003](experiments/003-hai-proxy-compatible/) |
| 2026-04-15 | Remove gpt-4o from configs | Model doesn't exist in HAI proxy | [001](experiments/001-initial-model-comparison/) |
| 2026-04-10 | Claude 4.6 Sonnet primary | Initial stable configuration | - |

---

**Last Updated:** 2026-04-16  
**Current Production:** GPT-5 Mini (gpt-5-mini) with GPT-4.1 Mini fallback
