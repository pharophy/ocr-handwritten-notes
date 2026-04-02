#!/bin/bash

# OpenAI Model Comparison Test
# Uses .env.openai configuration

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║    OpenAI via HAI Proxy Model Accuracy Test               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Ensure HAI proxy is started (not stopped, since we're using it)
echo "Starting HAI proxy..."
hai proxy start --headless >/dev/null 2>&1 &
sleep 5

# Verify it's running
if ! lsof -i :6655 >/dev/null 2>&1; then
    echo "❌ HAI proxy failed to start"
    exit 1
fi

echo "✓ HAI proxy running"
echo ""

# Check if .env.proxy.openai exists
if [ ! -f .env.proxy.openai ]; then
    echo "❌ .env.proxy.openai not found!"
    echo "Expected pre-configured file for OpenAI (via HAI proxy) testing"
    exit 1
fi

# Backup current .env
if [ -f .env ]; then
    cp .env .env.backup
fi

# Results
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_DIR="test-results"
mkdir -p "$RESULTS_DIR"
RESULTS_FILE="$RESULTS_DIR/openai-comparison-$TIMESTAMP.txt"

echo "Using configuration: .env.proxy.openai"
echo "Results: $RESULTS_FILE"
echo ""

# OpenAI models to test (from SAP AI LLM Proxy)
declare -a models=(
  "gpt-5:OpenAI GPT-5 (latest, best accuracy)"
  "gpt-5-mini:OpenAI GPT-5 Mini (fast, cost-effective)"
  "gpt-4.1:OpenAI GPT-4.1"
  "gpt-4.1-mini:OpenAI GPT-4.1 Mini"
)

test_count=0
for config in "${models[@]}"; do
  IFS=':' read -r model description <<< "$config"
  test_count=$((test_count + 1))

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Test $test_count/${#models[@]}: $description"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Copy .env.proxy.openai and set specific model
  cp .env.proxy.openai .env

  # Update model in .env
  if grep -q "^AI_MODEL_OCR=" .env; then
    sed -i.bak "s|^AI_MODEL_OCR=.*|AI_MODEL_OCR=$model|" .env
    rm .env.bak
  else
    echo "AI_MODEL_OCR=$model" >> .env
  fi

  # Load variables from .env
  export $(grep -v '^#' .env | xargs)

  echo "Configuration loaded from .env.proxy.openai"
  echo "Testing model: $model"
  echo "Provider: $AI_PROVIDER"
  echo ""

  # Log to results file
  {
    echo "═══════════════════════════════════════════════════════════"
    echo "Test: $description"
    echo "Model: $model"
    echo "Configuration: .env.proxy.openai"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
  } >> "$RESULTS_FILE"

  # Run test
  npx vitest run tests/model-comparison.test.ts --reporter=verbose 2>&1 | tee -a "$RESULTS_FILE"

  echo "" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"

  sleep 3
done

# Restore original .env
if [ -f .env.backup ]; then
  mv .env.backup .env
else
  cp .env.proxy.claude .env
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  Results Summary                           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

grep -A 2 "📊 Accuracy:" "$RESULTS_FILE" || echo "No results found"

echo ""
echo "✅ OpenAI tests complete!"
echo "📊 Full results: $RESULTS_FILE"
echo ""
echo "To restore Claude configuration: cp .env.proxy.claude .env"
