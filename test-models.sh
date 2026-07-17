#!/bin/bash

# Wrapper script to run model tests from root directory
# This is a convenience script that calls the actual test scripts in tests/

cd "$(dirname "$0")"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           Model Testing Suite Launcher                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Choose which tests to run:"
echo ""
echo "  1) Test Claude models only (6 models, ~5-7 minutes)"
echo "  2) Test OpenAI models only (4 models, ~3-5 minutes)"
echo "  3) Test all models (10 models, ~10-15 minutes)"
echo "  4) Exit"
echo ""
echo "Note: Gemini models are not currently available through HAI proxy"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
  1)
    echo ""
    ./tests/test-claude.sh
    ;;
  2)
    echo ""
    ./tests/test-openai.sh
    ;;
  3)
    echo ""
    ./tests/test-all-models.sh
    ;;
  4)
    echo "Exiting..."
    exit 0
    ;;
  *)
    echo "Invalid choice. Exiting..."
    exit 1
    ;;
esac
