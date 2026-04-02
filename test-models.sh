#!/bin/bash

# Test OCR accuracy with different AI models
# This script runs the same OCR test with different model configurations

echo "=========================================="
echo "OCR Accuracy Test - Model Comparison"
echo "=========================================="
echo ""

# Save original .env
cp .env .env.backup

# Array of model configurations to test
declare -a configs=(
  "openai:gpt-4o"
  "openai:gpt-4-turbo"
  "hai-claude:anthropic--claude-4.5-sonnet"
  "hai-claude:anthropic--claude-opus-4"
  "hai-claude:anthropic--claude-4.5-haiku"
)

# Results file
RESULTS_FILE="test-results-$(date +%Y%m%d-%H%M%S).txt"
echo "Results will be saved to: $RESULTS_FILE"
echo ""

# Run tests for each configuration
for config in "${configs[@]}"; do
  IFS=':' read -r provider model <<< "$config"

  echo "=========================================="
  echo "Testing: $provider with $model"
  echo "=========================================="

  # Update .env
  cat > .env << EOF
AI_PROVIDER=$provider
AI_MODEL_OCR=$model
HAI_AUTO_START=true
HAI_PROXY_PORT=6655
ANTHROPIC_BASE_URL=http://localhost:6655/anthropic/
HANDWRITING_REFERENCE_ENABLED=true
HANDWRITING_REFERENCE_FILE=./handwriting-reference.json
EOF

  # Run the test
  echo "Running test..." | tee -a "$RESULTS_FILE"
  echo "Provider: $provider, Model: $model" >> "$RESULTS_FILE"
  echo "---" >> "$RESULTS_FILE"

  npx vitest run tests/ocr-accuracy.test.ts --reporter=verbose 2>&1 | tee -a "$RESULTS_FILE"

  echo "" >> "$RESULTS_FILE"
  echo "========================================" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"

  # Small delay between tests
  sleep 2
done

# Restore original .env
mv .env.backup .env

echo ""
echo "=========================================="
echo "All tests complete!"
echo "Results saved to: $RESULTS_FILE"
echo "=========================================="
