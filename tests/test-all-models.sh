#!/bin/bash

set -e

echo "Complete OCR Model Comparison Test Suite"
echo ""
echo "This will test direct OpenAI and direct Anthropic model configurations."
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_DIR="test-results"
mkdir -p "$RESULTS_DIR"
COMBINED_RESULTS="$RESULTS_DIR/complete-comparison-$TIMESTAMP.txt"

{
  echo "Complete OCR Model Comparison Results"
  echo "Test Date: $(date)"
  echo ""
} > "$COMBINED_RESULTS"

echo "Phase 1: OpenAI"
./tests/test-openai.sh

echo "Phase 2: Anthropic"
./tests/test-claude.sh

{
  echo ""
  echo "OpenAI results:"
  ls -1t test-results/openai-comparison-*.txt | head -1
  echo ""
  echo "Anthropic results:"
  ls -1t test-results/claude-comparison-*.txt | head -1
} >> "$COMBINED_RESULTS"

echo "All tests complete"
echo "Combined results: $COMBINED_RESULTS"
