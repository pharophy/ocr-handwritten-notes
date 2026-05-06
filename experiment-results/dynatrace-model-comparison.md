# OCR Experiment Report: Dynatrace Q2 04-09

**Type:** model
**Date:** 2026-05-06T23:13:51.023Z
**Configurations Tested:** 4

## Comparison Table

| Configuration | Accuracy | Word F1 | Cost | Latency | Italics | Score |
|--------------|----------|---------|------|---------|---------|-------|
| ⭐ GPT-4.1 | 90.8% | 0.565 | $0.1029 | 21.3s | 0.0% | 67.9 |
| Claude 4.6 Sonnet | 92.2% | 0.579 | $0.1235 | 23.3s | 0.0% | 67.8 |
| Claude 4.5 Sonnet | 91.8% | 0.567 | $0.1235 | 30.8s | 0.0% | 64.2 |
| GPT-5 | 90.8% | 0.574 | $0.1029 | 53.9s | 0.0% | 63.5 |

## Recommendation

**GPT-4.1**

Selected "GPT-4.1" with composite score 67.91/100.

Comparison:
  vs "Claude 4.6 Sonnet": -1.4% accuracy, $0.021 cheaper, 2.1s faster
  vs "Claude 4.5 Sonnet": $0.021 cheaper, 9.6s faster
  vs "GPT-5": 32.7s faster

Key metrics:
  - Accuracy: 90.76%
  - Word F1: 0.565
  - Cost: $0.1029
  - Latency: 21.26s
  - Italics: 0.00%
