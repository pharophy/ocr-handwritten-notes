#!/bin/bash

set -e

cd "$(dirname "$0")"

echo "Model Testing Suite"
echo ""
echo "Choose which tests to run:"
echo ""
echo "  1) Test Anthropic models only"
echo "  2) Test OpenAI models only"
echo "  3) Test all models"
echo "  4) Exit"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
  1)
    ./tests/test-claude.sh
    ;;
  2)
    ./tests/test-openai.sh
    ;;
  3)
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
