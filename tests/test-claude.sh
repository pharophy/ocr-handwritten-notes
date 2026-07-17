#!/bin/bash

set -e

echo "Anthropic Direct Model Accuracy Test"
echo ""

if [ ! -f .env.direct.anthropic ]; then
  echo ".env.direct.anthropic not found"
  exit 1
fi

if [ -f .env ]; then
  cp .env .env.backup
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_DIR="test-results"
mkdir -p "$RESULTS_DIR"
RESULTS_FILE="$RESULTS_DIR/claude-comparison-$TIMESTAMP.txt"

declare -a models=(
  "claude-sonnet-4-20250514:Claude Sonnet 4"
  "claude-opus-4-20250514:Claude Opus 4"
  "claude-3-5-haiku-20241022:Claude 3.5 Haiku"
)

test_count=0
for config in "${models[@]}"; do
  IFS=':' read -r model description <<< "$config"
  test_count=$((test_count + 1))

  echo "Test $test_count/${#models[@]}: $description"

  cp .env.direct.anthropic .env

  if grep -q "^AI_MODEL_OCR=" .env; then
    sed -i.bak "s|^AI_MODEL_OCR=.*|AI_MODEL_OCR=$model|" .env
    rm .env.bak
  else
    echo "AI_MODEL_OCR=$model" >> .env
  fi

  set -a
  . ./.env
  set +a

  {
    echo "Test: $description"
    echo "Model: $model"
    echo "Configuration: .env.direct.anthropic"
    echo ""
  } >> "$RESULTS_FILE"

  npx vitest run tests/ocr-accuracy.test.ts --reporter=verbose 2>&1 | tee -a "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
done

if [ -f .env.backup ]; then
  mv .env.backup .env
else
  rm -f .env
fi

echo "Anthropic tests complete"
echo "Results: $RESULTS_FILE"
