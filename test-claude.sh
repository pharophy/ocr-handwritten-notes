#!/bin/bash

# Claude via HAI Proxy Model Comparison Test
# Uses .env.claudeproxy configuration

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║    Claude via HAI Proxy Model Accuracy Test               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if .env.claudeproxy exists
if [ ! -f .env.claudeproxy ]; then
    echo "❌ .env.claudeproxy not found!"
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
RESULTS_FILE="$RESULTS_DIR/claude-comparison-$TIMESTAMP.txt"

echo "Using configuration: .env.claudeproxy"
echo "Results: $RESULTS_FILE"
echo ""

# Ensure HAI proxy is started
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

# Claude models to test
declare -a models=(
  "anthropic--claude-4.5-sonnet:Claude 3.5 Sonnet (best for handwriting)"
  "anthropic--claude-4.5-haiku:Claude 3.5 Haiku (fast, cost-effective)"
  "anthropic--claude-opus-4:Claude 3 Opus (highest quality)"
)

test_count=0
for config in "${models[@]}"; do
  IFS=':' read -r model description <<< "$config"
  test_count=$((test_count + 1))

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Test $test_count/${#models[@]}: $description"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Copy .env.claudeproxy and set specific model
  cp .env.claudeproxy .env

  # Update model in .env
  if grep -q "^AI_MODEL_OCR=" .env; then
    sed -i.bak "s|^AI_MODEL_OCR=.*|AI_MODEL_OCR=$model|" .env
    rm .env.bak
  else
    echo "AI_MODEL_OCR=$model" >> .env
  fi

  # Load variables from .env
  export $(grep -v '^#' .env | xargs)

  echo "Configuration loaded from .env.claudeproxy"
  echo "Testing model: $model"
  echo "Provider: $AI_PROVIDER"
  echo ""

  # Log to results file
  {
    echo "═══════════════════════════════════════════════════════════"
    echo "Test: $description"
    echo "Model: $model"
    echo "Configuration: .env.claudeproxy"
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
  cp .env.claudeproxy .env
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  Results Summary                           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

grep -A 2 "📊 Accuracy:" "$RESULTS_FILE" || echo "No results found"

echo ""
echo "✅ Claude tests complete!"
echo "📊 Full results: $RESULTS_FILE"
