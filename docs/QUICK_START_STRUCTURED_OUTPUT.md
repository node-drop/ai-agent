# Quick Start: Structured Output

Get started with structured output in 3 simple steps.

## Step 1: Select Output Format

In your AI Agent node, go to **Options** → **Output Format** and select:
```
Structured JSON (with Schema)
```

## Step 2: Define Your Schema

In the **Output Schema** field, paste a JSON Schema. Here's a simple example:

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
      "description": "Confidence level from 0 to 1"
    }
  },
  "required": ["answer", "confidence"]
}
```

## Step 3: Run Your Workflow

The agent will now return structured JSON:

```json
{
  "answer": "Paris is the capital of France",
  "confidence": 0.99
}
```

## Common Schemas

### Extract Multiple Items
```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "value": { "type": "string" }
        },
        "required": ["name"]
      }
    }
  },
  "required": ["items"]
}
```

### Classification
```json
{
  "type": "object",
  "properties": {
    "category": {
      "type": "string",
      "enum": ["urgent", "normal", "low"]
    },
    "reason": {
      "type": "string"
    }
  },
  "required": ["category"]
}
```

### Yes/No with Explanation
```json
{
  "type": "object",
  "properties": {
    "decision": {
      "type": "boolean",
      "description": "True for yes, false for no"
    },
    "explanation": {
      "type": "string"
    }
  },
  "required": ["decision", "explanation"]
}
```

## Tips

1. **Always use `"type": "object"`** at the root level
2. **Add descriptions** to help the LLM understand what to return
3. **Mark required fields** using the `required` array
4. **Use `enum`** when you want specific values only
5. **Start simple** and add complexity as needed

## Need More Examples?

Check out `examples/structured-output-schemas.json` for 5+ ready-to-use schemas covering:
- Product extraction
- Sentiment analysis
- Task breakdown
- Contact information
- And more!

## Full Documentation

See `docs/STRUCTURED_OUTPUT.md` for complete documentation including:
- JSON Schema basics
- Advanced examples
- Troubleshooting
- Model compatibility
