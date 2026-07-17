#!/bin/bash

set -e

echo "OpenAI Direct Model Accuracy Test"
echo ""

if [ ! -f .env.direct.openai ]; then
  echo ".env.direct.openai not found"
  exit 1
fi

if [ -f .env ]; then
  cp .env .env.backup
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_DIR="test-results"
mkdir -p "$RESULTS_DIR"
RESULTS_FILE="$RESULTS_DIR/openai-comparison-$TIMESTAMP.txt"

declare -a models=(
  "gpt-5:OpenAI GPT-5"
  "gpt-5-mini:OpenAI GPT-5 Mini"
  "gpt-4.1:OpenAI GPT-4.1"
  "gpt-4.1-mini:OpenAI GPT-4.1 Mini"
)

test_count=0
for config in "${models[@]}"; do
  IFS=':' read -r model description <<< "$config"
  test_count=$((test_count + 1))

  echo "Test $test_count/${#models[@]}: $description"

  cp .env.direct.openai .env

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
    echo "Configuration: .env.direct.openai"
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

echo "OpenAI tests complete"
echo "Results: $RESULTS_FILE"
