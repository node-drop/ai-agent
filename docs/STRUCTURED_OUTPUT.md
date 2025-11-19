# Structured Output for AI Agent

## Overview

The AI Agent node now supports **Structured JSON Output**, which forces the LLM to return data in a specific format defined by a JSON Schema. This is useful when you need predictable, parseable output for downstream processing.

## How It Works

When you select "Structured JSON (with Schema)" as the output format:

1. You define a JSON Schema that describes the expected output structure
2. The schema is passed to the LLM using its native structured output capability
3. The LLM is forced to return JSON that matches your schema
4. The output is validated and returned as structured data

## Benefits

- **Predictable Output**: No more parsing freeform text or dealing with inconsistent formats
- **Type Safety**: Define exact types, required fields, and constraints
- **Reliable Parsing**: Output is guaranteed to be valid JSON matching your schema
- **Better Integration**: Structured data flows seamlessly to downstream nodes
- **No Post-Processing**: No need for separate parser nodes or regex extraction

## Configuration

### 1. Output Format
Select **"Structured JSON (with Schema)"** from the Output Format dropdown

### 2. Output Schema (Required)
Define a JSON Schema that describes your expected output structure:

```json
{
  "type": "object",
  "properties": {
    "answer": {
      "type": "string",
      "description": "The main answer"
    },
    "confidence": {
      "type": "number",
      "description": "Confidence level from 0 to 1"
    }
  },
  "required": ["answer", "confidence"]
}
```

### 3. Schema Name (Optional)
A name for your schema (default: "response")

### 4. Schema Description (Optional)
A description of what the structured output represents

## JSON Schema Basics

### Supported Types
- `string` - Text values
- `number` - Numeric values (integers or decimals)
- `boolean` - true/false values
- `object` - Nested objects
- `array` - Lists of items
- `null` - Null values

### Common Properties

**type**: The data type
```json
{ "type": "string" }
```

**description**: Helps the LLM understand what to put in this field
```json
{
  "type": "string",
  "description": "User's email address"
}
```

**required**: Array of required field names
```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number" }
  },
  "required": ["name"]
}
```

**enum**: Restrict to specific values
```json
{
  "type": "string",
  "enum": ["positive", "negative", "neutral"]
}
```

**items**: Define array item structure
```json
{
  "type": "array",
  "items": {
    "type": "string"
  }
}
```

## Example Use Cases

### 1. Simple Q&A with Confidence
```json
{
  "type": "object",
  "properties": {
    "answer": {
      "type": "string",
      "description": "The answer to the question"
    },
    "confidence": {
      "type": "number",
      "description": "Confidence from 0 to 1"
    }
  },
  "required": ["answer", "confidence"]
}
```

**User Message**: "What is the capital of France?"

**Output**:
```json
{
  "answer": "Paris",
  "confidence": 0.99
}
```

### 2. Product Extraction
```json
{
  "type": "object",
  "properties": {
    "products": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "price": { "type": "number" },
          "category": { "type": "string" }
        },
        "required": ["name", "price"]
      }
    }
  },
  "required": ["products"]
}
```

**User Message**: "Extract products from: iPhone 15 Pro costs $999 in Electronics. AirPods Max are $549 in Audio."

**Output**:
```json
{
  "products": [
    {
      "name": "iPhone 15 Pro",
      "price": 999,
      "category": "Electronics"
    },
    {
      "name": "AirPods Max",
      "price": 549,
      "category": "Audio"
    }
  ]
}
```

### 3. Sentiment Analysis
```json
{
  "type": "object",
  "properties": {
    "sentiment": {
      "type": "string",
      "enum": ["positive", "negative", "neutral"]
    },
    "score": {
      "type": "number",
      "description": "Score from -1 to 1"
    },
    "emotions": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["sentiment", "score"]
}
```

### 4. Task Breakdown
```json
{
  "type": "object",
  "properties": {
    "taskName": { "type": "string" },
    "steps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "stepNumber": { "type": "number" },
          "title": { "type": "string" },
          "description": { "type": "string" }
        },
        "required": ["stepNumber", "title"]
      }
    }
  },
  "required": ["taskName", "steps"]
}
```

## Tips for Writing Good Schemas

1. **Use Descriptions**: Help the LLM understand what each field should contain
2. **Mark Required Fields**: Use the `required` array to specify mandatory fields
3. **Use Enums for Categories**: When you want specific values, use `enum`
4. **Keep It Simple**: Start with simple schemas and add complexity as needed
5. **Test Your Schema**: Try with different prompts to ensure it works as expected

## Comparison with Other Output Formats

| Format | Use Case | Output |
|--------|----------|--------|
| **Text Only** | Simple responses, chat | Plain text string |
| **JSON** | Basic structure | `{ response, success }` |
| **Structured JSON** | Custom data extraction | Your schema |
| **Full** | Debugging, monitoring | Response + metadata |

## Model Support

Structured output is supported by:
- ✅ OpenAI GPT-4 and GPT-4 Turbo (with `response_format`)
- ✅ OpenAI GPT-3.5 Turbo (with `response_format`)
- ⚠️ Anthropic Claude (may require JSON mode prompting)

## Troubleshooting

**Error: "Output schema is required"**
- Make sure you've entered a valid JSON Schema in the Output Schema field

**Error: "Schema must be an object type"**
- The root `type` must be `"object"`, not `"string"` or `"array"`

**Error: "Invalid output schema"**
- Check that your JSON is valid (use a JSON validator)
- Ensure all brackets and quotes are properly closed

**LLM returns text instead of JSON**
- Some models may not support structured output
- Try adding "Return your response as JSON" to your system prompt

## More Examples

See `examples/structured-output-schemas.json` for more ready-to-use schema examples.
