# AI Agent Node - Changelog

## [Unreleased]

### Added
- **Structured JSON Output with Schema** - New output format that forces the LLM to return data matching a JSON Schema
  - Added "Structured JSON (with Schema)" option to Output Format
  - Added Output Schema field for defining JSON Schema
  - Added Schema Name and Schema Description fields
  - Integrated with LLM's native structured output capability (response_format)
  - Automatic JSON parsing and validation
  - See `docs/STRUCTURED_OUTPUT.md` for detailed documentation
  - See `examples/structured-output-schemas.json` for ready-to-use examples

### Changed
- Updated `_formatOutput()` to handle structured output format
- Updated `_executeAgentLoop()` to accept and pass schema parameters
- Updated model chat call to include response_format when schema is provided
- Enhanced output parsing to extract structured data from model response

### Documentation
- Added comprehensive structured output documentation in `docs/STRUCTURED_OUTPUT.md`
- Added example schemas in `examples/structured-output-schemas.json`
- Updated node header documentation to mention structured output feature

## Benefits of Structured Output

1. **No Separate Parser Node Needed** - Unlike n8n's approach, schema is built into the agent
2. **More Reliable** - Uses LLM's native structured output instead of post-processing
3. **Simpler Workflows** - One node instead of two (agent + parser)
4. **Better UX** - Configure everything in one place
5. **Backward Compatible** - Existing workflows continue to work with default "text" format

## Use Cases

- Data extraction (products, contacts, entities)
- Sentiment analysis with structured scores
- Task breakdown into steps
- Classification with confidence scores
- Form filling and validation
- API response formatting
