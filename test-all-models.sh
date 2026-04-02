#!/bin/bash

# Complete Model Comparison Test Suite
# Tests both OpenAI and Claude models

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║       Complete OCR Model Comparison Test Suite            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "This will test all available models:"
echo "  • OpenAI GPT-4o, GPT-4 Turbo (.env.openai)"
echo "  • Claude 3.5 Sonnet, Haiku, Opus (.env.claudeproxy)"
echo ""
echo "Estimated time: 3-5 minutes"
echo ""

read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# Results
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_DIR="test-results"
mkdir -p "$RESULTS_DIR"
COMBINED_RESULTS="$RESULTS_DIR/complete-comparison-$TIMESTAMP.txt"

{
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║       Complete OCR Model Comparison Results               ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Test Date: $(date)"
  echo "Test Image: test-images/Cosine 02-26.jpeg"
  echo ""
} > "$COMBINED_RESULTS"

# Run OpenAI tests
echo "════════════════════════════════════════════════════════════"
echo "PHASE 1: Testing OpenAI Models"
echo "════════════════════════════════════════════════════════════"
echo ""

./test-openai.sh

{
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "OpenAI Test Results:"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  tail -50 test-results/openai-comparison-*.txt | grep -A 3 "📊 Accuracy:" | head -20
  echo ""
} >> "$COMBINED_RESULTS"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "PHASE 2: Testing Claude Models via HAI Proxy"
echo "════════════════════════════════════════════════════════════"
echo ""

sleep 3

./test-claude.sh

{
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "Claude via HAI Proxy Test Results:"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  tail -50 test-results/claude-comparison-*.txt | grep -A 3 "📊 Accuracy:" | head -20
  echo ""
} >> "$COMBINED_RESULTS"

# Generate final summary
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║               Final Results Summary                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

cat "$COMBINED_RESULTS"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All tests complete!"
echo ""
echo "📊 Results saved to:"
echo "   - Combined: $COMBINED_RESULTS"
echo "   - OpenAI:   test-results/openai-comparison-*.txt"
echo "   - Claude:   test-results/claude-comparison-*.txt"
echo ""
echo "💡 Default configuration restored to Claude (fastest winner)"
