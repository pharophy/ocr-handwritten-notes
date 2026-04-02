#!/bin/bash

# OpenAI Model Comparison Test
# Tests OCR accuracy with OpenAI models only

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         OpenAI Model Accuracy Test                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Ensure HAI proxy is stopped
echo "Stopping HAI proxy..."
pkill -9 -f "hai proxy" 2>/dev/null || true
sleep 3

# Verify it's stopped
if lsof -i :6655 >/dev/null 2>&1; then
    echo "❌ HAI proxy is still running. Please stop it manually."
    exit 1
fi

echo "✓ HAI proxy stopped"
echo ""

# Backup .env
cp .env .env.backup 2>/dev/null || true

# Results
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_DIR="test-results"
mkdir -p "$RESULTS_DIR"
RESULTS_FILE="$RESULTS_DIR/openai-comparison-$TIMESTAMP.txt"

echo "Results: $RESULTS_FILE"
echo ""

# OpenAI models to test
declare -a models=(
  "gpt-4o:OpenAI GPT-4o (latest)"
  "gpt-4-turbo:OpenAI GPT-4 Turbo"
)

test_count=0
for config in "${models[@]}"; do
  IFS=':' read -r model description <<< "$config"
  test_count=$((test_count + 1))

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Test $test_count/${#models[@]}: $description"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Load API key from .env.backup (original .env)
  if [ ! -f .env.backup ]; then
    echo "❌ .env.backup not found. Cannot load OpenAI API key."
    exit 1
  fi

  OPENAI_KEY=$(grep "^OPENAI_API_KEY=" .env.backup | cut -d '=' -f2)

  if [ -z "$OPENAI_KEY" ]; then
    echo "❌ OPENAI_API_KEY not found in .env.backup"
    exit 1
  fi

  # Create .env with OpenAI configuration - explicitly disable HAI
  cat > .env << EOF
AI_PROVIDER=openai
OPENAI_API_KEY=$OPENAI_KEY
HAI_AUTO_START=false
HANDWRITING_REFERENCE_ENABLED=true
HANDWRITING_REFERENCE_FILE=./handwriting-reference.json
AI_MODEL_OCR=$model
EOF

  # Export variables for vitest - explicitly set OpenAI
  export AI_PROVIDER=openai
  export AI_MODEL_OCR=$model
  export OPENAI_API_KEY=$OPENAI_KEY
  export HAI_AUTO_START=false
  export HANDWRITING_REFERENCE_ENABLED=true
  export HANDWRITING_REFERENCE_FILE=./handwriting-reference.json

  echo "Testing with: $model"
  echo "Provider: openai"
  echo ""

  # Log to results file
  {
    echo "═══════════════════════════════════════════════════════════"
    echo "Test: $description"
    echo "Model: $model"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
  } >> "$RESULTS_FILE"

  # Run test
  npx vitest run tests/model-comparison.test.ts --reporter=verbose 2>&1 | tee -a "$RESULTS_FILE"

  echo "" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"

  sleep 3
done

# Restore .env
if [ -f .env.backup ]; then
  mv .env.backup .env
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
