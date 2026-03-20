# Test Suite

Comprehensive test suite for the Handwritten OCR CLI system, covering all specifications.

## Test Structure

Tests are organized by capability, matching the OpenSpec specifications:

- **[ocr-processing.test.ts](ocr-processing.test.ts)** - 12 tests covering OCR image processing
- **[text-summarization.test.ts](text-summarization.test.ts)** - 10 tests covering AI summarization
- **[handwriting-reference.test.ts](handwriting-reference.test.ts)** - 20 tests covering handwriting reference system
- **[batch-processing.test.ts](batch-processing.test.ts)** - 19 tests covering batch file processing

**Total: 61 tests** covering **34 requirements** across 4 capabilities.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Framework

- **Vitest** - Fast unit test framework with TypeScript support
- **Mocking** - Uses Vitest's built-in mocking for external dependencies (OpenAI API, file system)

## Test Coverage by Specification

### OCR Processing (8 requirements → 12 tests)
- ✓ Image preprocessing
- ✓ Handwriting transcription accuracy (3 scenarios)
- ✓ Layout detection and preservation (2 scenarios)
- ✓ Visual element notation
- ✓ Capitalization preservation
- ✓ Output format compatibility
- ✓ Image format support (2 scenarios)
- ✓ Error handling

### Text Summarization (7 requirements → 10 tests)
- ✓ Meeting notes summarization
- ✓ Summary structure (5 section tests)
- ✓ AI model usage
- ✓ Summary error handling (2 scenarios)
- ✓ Summary clarity and conciseness

### Handwriting Reference (10 requirements → 20 tests)
- ✓ Configuration file loading (3 scenarios)
- ✓ Reference configuration format (3 scenarios)
- ✓ Reference image loading (4 scenarios)
- ✓ Prompt enhancement
- ✓ Image reference API integration
- ✓ Environment variable configuration (2 scenarios)
- ✓ Logging and observability (2 scenarios)
- ✓ Character disambiguation guidance
- ✓ Reference image existence check (2 scenarios)

### Batch Processing (9 requirements → 19 tests)
- ✓ Folder monitoring (2 scenarios)
- ✓ Image file discovery (2 scenarios)
- ✓ Duplicate processing prevention (3 scenarios)
- ✓ Batch OCR processing (2 scenarios)
- ✓ Output file generation (2 scenarios)
- ✓ Output file metadata (2 scenarios)
- ✓ Execution logging (3 scenarios)
- ✓ Single-run execution model
- ✓ File system traversal
- ✓ Summarization opt-out

## Writing New Tests

When adding new features:

1. **Update the spec** in `openspec/specs/<capability>/spec.md`
2. **Add test scenarios** matching each requirement
3. **Use the WHEN/THEN format** from specifications

Example:
```typescript
describe('Requirement: New feature description', () => {
  it('Scenario: Expected behavior - should do something', async () => {
    // WHEN: Set up the condition
    const input = createTestInput();

    // THEN: Verify the expected outcome
    const result = await functionUnderTest(input);
    expect(result).toBe(expectedValue);
  });
});
```

## Test Principles

1. **Spec-driven** - Every test maps to a specification requirement
2. **Isolated** - Tests use mocks for external dependencies (API calls, file system)
3. **Fast** - Unit tests run in milliseconds
4. **Readable** - Test names match specification scenarios
5. **Maintainable** - Tests are organized by capability

## Mocking Strategy

- **OpenAI API** - Mocked to avoid real API calls and costs
- **File system** - Mocked to avoid reading/writing real files
- **Environment variables** - Reset between tests for isolation

## Integration Testing

Note: Current tests are **unit tests** focused on individual modules. For integration testing (end-to-end workflows), consider:

- Testing the full OCR → Summarization pipeline
- Testing batch processing with real file fixtures
- Testing with actual (small) OpenAI API calls

## Continuous Integration

Add to your CI/CD pipeline:

```yaml
- name: Run tests
  run: npm test

- name: Check coverage
  run: npm run test:coverage
```

## Troubleshooting

### Tests failing with mock errors
- Ensure all external dependencies are properly mocked
- Check that mock implementations return expected data structures

### Tests timing out
- Increase timeout in vitest.config.ts if needed
- Check for unresolved promises in async tests

### Coverage not generated
- Install coverage provider: `npm install --save-dev @vitest/coverage-v8`

## Related Files

- [vitest.config.ts](../vitest.config.ts) - Test configuration
- [package.json](../package.json) - Test scripts
- [openspec/specs/](../openspec/specs/) - Specifications that tests verify
