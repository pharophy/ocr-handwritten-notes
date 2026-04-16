# Documentation Index

Complete guide to all documentation in the note-gen project.

---

## 🚀 Getting Started

Start here if you're new to the project:

1. **[README.md](README.md)** - Main project documentation, quick start, features
2. **[CONFIG.md](CONFIG.md)** - Complete configuration guide with all model options
3. **[OCR_QUICK_REFERENCE.md](OCR_QUICK_REFERENCE.md)** - Quick reference for common tasks

---

## 🔬 Experimentation

Learn about our structured experimentation workflow:

### Main Documents
- **[EXPERIMENTS.md](EXPERIMENTS.md)** - Auto-generated summary of all experiments
- **[OCR_MODEL_SELECTION.md](OCR_MODEL_SELECTION.md)** - Detailed test results and model recommendations

### Experiment Folders
- **[experiments/README.md](experiments/README.md)** - Experiment templates and guidelines
- **[experiments/001-initial-model-comparison/](experiments/001-initial-model-comparison/)** - Discovered model availability issues
- **[experiments/002-full-model-suite/](experiments/002-full-model-suite/)** - Comprehensive model testing
- **[experiments/003-hai-proxy-compatible/](experiments/003-hai-proxy-compatible/)** - Winner: GPT-5 Mini ⭐

### Running Experiments
```bash
# AI-guided experimentation
/experiment-ocr

# Manual model comparison
npm run experiment-ocr "test-images/sample.jpeg" -- --type=model
```

---

## ⚙️ Configuration

Configuration files and templates:

### Current Configuration
- **[.env](.env)** - Current production config (GPT-5 Mini)
- **[.env.recommended](.env.recommended)** - Recommended config based on experiments

### Templates
- **[.env.proxy.openai](.env.proxy.openai)** - GPT-5 Mini primary (recommended)
- **[.env.proxy.claude](.env.proxy.claude)** - Claude Sonnet primary (higher cost)
- **[.env.direct.openai](.env.direct.openai)** - OpenAI direct API (non-SAP users)
- **[.env.example](.env.example)** - Complete configuration reference

### Configuration Guide
- **[CONFIG.md](CONFIG.md)** - Complete guide to all configuration options
  - Model selection guide with experiment results
  - Configuration scenarios (max accuracy, best value, fastest, etc.)
  - Troubleshooting common issues
  - Cost analysis

---

## 🧪 Testing

Testing framework documentation:

### Test Guides
- **[test-images/README.md](test-images/README.md)** - Creating test cases
- **[test-results/README.md](test-results/README.md)** - Test result structure
- **[docs/guides/testing.md](docs/guides/testing.md)** - Comprehensive testing guide

### Running Tests
```bash
# Single test
npm run test-ocr "test-images/sample.jpeg"

# Full test suite
npm run test-ocr-suite

# With baseline comparison
npm run test-ocr "test-images/sample.jpeg" -- --compare-baseline
```

---

## 📚 Guides

Step-by-step guides for specific tasks:

- **[docs/guides/glossary-curation.md](docs/guides/glossary-curation.md)** - Managing domain-specific terms
- **[docs/guides/testing.md](docs/guides/testing.md)** - Complete testing guide

---

## 🏗️ Architecture

Technical architecture and design:

- **[docs/architecture/system-architecture.md](docs/architecture/system-architecture.md)** - System overview

---

## 📦 OpenSpec Changes

OpenSpec change management:

### Active Change
- **[openspec/changes/improve-ocr-accuracy/](openspec/changes/improve-ocr-accuracy/)** - Current OCR improvements
  - [proposal.md](openspec/changes/improve-ocr-accuracy/proposal.md)
  - [design.md](openspec/changes/improve-ocr-accuracy/design.md)
  - [tasks.md](openspec/changes/improve-ocr-accuracy/tasks.md) - 60/67 tasks complete (90%)
  - [IMPLEMENTATION_STATUS.md](openspec/changes/improve-ocr-accuracy/IMPLEMENTATION_STATUS.md)
  - [specs/](openspec/changes/improve-ocr-accuracy/specs/) - Detailed specifications

### Archived Changes
- **[openspec/changes/archive/](openspec/changes/archive/)** - Completed changes

---

## 📖 Reference

Additional reference materials:

- **[CHANGELOG.md](CHANGELOG.md)** - Version history
- **[tests/MODELS.md](tests/MODELS.md)** - Complete AI model reference
- **[tests/README.md](tests/README.md)** - Test script documentation
- **[handwriting-samples/README.md](handwriting-samples/README.md)** - Handwriting reference setup

---

## 🗄️ Archives

Historical documentation (superseded or outdated):

### Experiment Archives
- **[docs/archive/2026-04-16-experiment-summary-monolithic.md](docs/archive/2026-04-16-experiment-summary-monolithic.md)** - Old monolithic experiment summary (superseded by `experiments/` folders)

### Test Result Archives
- **[test-results/archive/](test-results/archive/)** - Old test result documents from April 13-14
  - BASELINE_WITH_MARKDOWN_STRIPPING.md
  - COMPLETE_RESULTS.md
  - COMPREHENSIVE_EXPERIMENT_RESULTS.md
  - FINAL_ANALYSIS_AND_RECOMMENDATIONS.md
  - FINAL_RESULTS.md
  - FINAL_SUCCESS_REPORT.md
  - FINAL_SUMMARY.md
  - PHASE1_BASELINE_REPORT.md
  - PROJECT_DOCUMENTATION.md
  - RESULTS_SUMMARY.md

### Other Archives
- **[docs/archive/](docs/archive/)** - Older documentation
  - 2026-04-02-final-test-results.md
  - 2026-04-02-solution-summary.md
  - 2026-04-02-testing-results.md
  - 2026-04-10-documentation-audit.md
  - 2026-04-accuracy-analysis.md

---

## 🎯 Quick Navigation by Task

### I want to...

**Get started with the project**
→ [README.md](README.md) → [CONFIG.md](CONFIG.md)

**Configure AI models**
→ [CONFIG.md](CONFIG.md) → [.env.recommended](.env.recommended)

**Understand why GPT-5 Mini is recommended**
→ [experiments/003-hai-proxy-compatible/findings.md](experiments/003-hai-proxy-compatible/findings.md)

**Run tests on my handwriting**
→ [test-images/README.md](test-images/README.md) → `npm run test-ocr`

**Design a new experiment**
→ `/experiment-ocr` skill → [experiments/README.md](experiments/README.md)

**See all experiment history**
→ [EXPERIMENTS.md](EXPERIMENTS.md)

**Troubleshoot configuration issues**
→ [CONFIG.md - Troubleshooting](CONFIG.md#-troubleshooting)

**Find quick commands**
→ [OCR_QUICK_REFERENCE.md](OCR_QUICK_REFERENCE.md)

**Learn about cost savings**
→ [CONFIG.md - Cost Analysis](CONFIG.md#-cost-analysis) → [OCR_MODEL_SELECTION.md](OCR_MODEL_SELECTION.md)

**Switch between model providers**
→ [CONFIG.md - Configuration Scenarios](CONFIG.md#-configuration-scenarios)

---

## 📊 Key Statistics (Current Production)

Based on [experiments/003-hai-proxy-compatible/](experiments/003-hai-proxy-compatible/):

- **Model:** GPT-5 Mini
- **Accuracy:** 91.2%
- **Cost:** $0.02/image
- **Speed:** 51.6s
- **Score:** 75.7/100
- **Annual Savings:** $1,000/year (vs Claude Sonnet, 10K images)

---

## 🔄 Document Lifecycle

### Active Documents (Regularly Updated)
- README.md
- CONFIG.md
- EXPERIMENTS.md (auto-generated)
- experiments/XXX-name/ (new experiments added)
- .env files

### Reference Documents (Updated Per Experiment)
- OCR_MODEL_SELECTION.md
- OCR_QUICK_REFERENCE.md

### Static Documents (Historical Reference)
- docs/archive/
- test-results/archive/
- openspec/changes/archive/

---

## 🤖 AI Skills

Claude Code skills available for this project:

- **/experiment-ocr** - Structured experimentation workflow
  - Ideates experiments based on current findings
  - Creates hypothesis → methodology → findings structure
  - Executes experiments with proper tooling
  - Documents results and updates summaries
  - See: [~/.claude/skills/experiment-ocr.md](~/.claude/skills/experiment-ocr.md)

---

**Last Updated:** April 16, 2026  
**Current Version:** Production-ready with GPT-5 Mini configuration
