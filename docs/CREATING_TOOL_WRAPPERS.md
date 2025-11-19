# Creating Tool Wrappers for AI Agent

## Overview

To make any service (Gmail, Slack, Google Sheets, etc.) available to the AI Agent, you need to create a **Tool Wrapper Node**. This is a lightweight wrapper that implements the tool interface.

## Why Tool Wrappers?

- **Regular nodes** (like HTTP Request, Slack, Gmail) execute in workflows
- **Tool nodes** are called by the AI Agent when the AI decides to use them
- Tool nodes implement `getDefinition()` and `executeTool()` methods

## Quick Pattern

Here's the minimal template for any tool wrapper:

```javascript
const ServiceToolNode = {
  identifier: 'service-tool',
  nodeCategory: 'tool',
  displayName: 'Service Tool',
  name: 'service-tool',
  group: ['ai', 'tool'],
  version: 1,
  description: 'Service description (service node for AI Agent)',
  icon: 'fa:icon-name',
  color: '#HEXCOLOR',
  defaults: {
    name: 'Service Tool',
  },
  inputs: [],
  outputs: ['tool'],
  credentials: [
    {
      name: 'serviceCredential',
      required: true,
    },
  ],
  properties: [
    {
      displayName: 'Authentication',
      name: 'authentication',
      type: 'credential',
      required: true,
      default: '',
      description: 'Select service credentials',
      allowedTypes: ['serviceCredential'],
    },
  ],

  /**
   * Define what the AI sees about this tool
   */
  getDefinition() {
    return {
      name: 'tool_name',
      description: 'What this tool does - be clear and specific',
      parameters: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: 'What this parameter does',
          },
          param2: {
            type: 'string',
            description: 'What this parameter does',
          },
        },
        required: ['param1'],
      },
    };
  },

  /**
   * Execute the tool when AI calls it
   */
  async executeTool(args) {
    try {
      // 1. Validate parameters
      if (!args.param1) {
        return {
          success: false,
          error: 'param1 is required',
        };
      }

      // 2. Get credentials
      const credentials = await this.getCredentials('serviceCredential');
      if (!credentials) {
        return {
          success: false,
          error: 'Credentials not configured',
        };
      }

      // 3. Call the actual service
      // Use the service's SDK or API here
      const result = await callServiceAPI(credentials, args);

      // 4. Return success
      return {
        success: true,
        data: {
          message: 'Operation completed',
          result: result,
        },
      };
    } catch (error) {
      // 5. Handle errors gracefully
      return {
        success: false,
        error: `Failed: ${error.message}`,
      };
    }
  },

  /**
   * Prevent direct execution
   */
  execute: async function () {
    throw new Error(
      'This is a service node and should not be executed directly. ' +
        'Connect it to an AI Agent node instead.'
    );
  },
};

module.exports = ServiceToolNode;
```

## Real Examples

### 1. Slack Tool (Simple)
**File:** `nodes/SlackTool.node.js`

**What it does:** Send messages to Slack channels

**Parameters:**
- `channel` - Channel name or ID
- `text` - Message to send
- `thread_ts` - Optional thread to reply to

### 2. HTTP Request Tool (Medium)
**File:** `nodes/HttpRequestTool.node.js`

**What it does:** Make HTTP requests to any API

**Parameters:**
- `url` - URL to request
- `method` - HTTP method (GET, POST, etc.)
- `headers` - Optional headers
- `body` - Optional request body

### 3. Calculator Tool (Simple)
**File:** `nodes/CalculatorTool.node.js`

**What it does:** Perform mathematical calculations

**Parameters:**
- `expression` - Math expression to evaluate

## Creating Tools for Your Services

### For Gmail:
```javascript
// GmailTool.node.js
getDefinition() {
  return {
    name: 'gmail_send_email',
    description: 'Send an email via Gmail',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body content' },
      },
      required: ['to', 'subject', 'body'],
    },
  };
}
```

### For Google Sheets:
```javascript
// GoogleSheetsTool.node.js
getDefinition() {
  return {
    name: 'sheets_append_row',
    description: 'Append a row to a Google Sheet',
    parameters: {
      type: 'object',
      properties: {
        spreadsheet_id: { type: 'string', description: 'Spreadsheet ID' },
        sheet_name: { type: 'string', description: 'Sheet name (e.g., "Sheet1")' },
        values: { type: 'array', description: 'Array of values to append' },
      },
      required: ['spreadsheet_id', 'sheet_name', 'values'],
    },
  };
}
```

### For Database Query:
```javascript
// DatabaseTool.node.js
getDefinition() {
  return {
    name: 'database_query',
    description: 'Execute a SQL query on the database',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'SQL query to execute' },
      },
      required: ['query'],
    },
  };
}
```

## Best Practices

### 1. Clear Tool Names
- Use descriptive names: `gmail_send_email`, `slack_send_message`
- Avoid generic names: `send`, `post`, `create`

### 2. Detailed Descriptions
- Explain WHAT the tool does
- Explain WHEN to use it
- Include examples in the description

### 3. Parameter Validation
- Always validate required parameters
- Return clear error messages
- Check parameter types

### 4. Error Handling
- Catch all errors
- Return user-friendly error messages
- Log errors for debugging

### 5. Credentials
- Always check if credentials exist
- Handle missing credentials gracefully
- Use the service's SDK when available

## Registering New Tools

After creating a tool, register it in `index.js`:

```javascript
module.exports = {
  nodes: {
    // ... existing nodes
    "gmailTool": require("./nodes/GmailTool.node.js"),
    "googleSheetsTool": require("./nodes/GoogleSheetsTool.node.js"),
  },
};
```

## Testing Your Tool

1. **Start the server** with your new tool
2. **Create a workflow** with:
   - AI Agent node
   - Your Tool node connected to Agent's "tools" input
   - Model node connected to Agent's "model" input
3. **Test with a prompt** like: "Send a message to #general saying hello"
4. **Check the logs** for any errors

## Common Issues

### Tool not discovered
- Check that `getDefinition()` and `executeTool()` are implemented
- Verify the tool is exported in `index.js`
- Restart the server after adding new tools

### Credentials not working
- Ensure credentials are configured in the UI
- Check the credential type matches in `allowedTypes`
- Verify `getCredentials()` is called correctly

### AI not using the tool
- Make the description more specific
- Add examples in the description
- Check parameter names are clear

## Summary

**For each service you want the AI to use:**

1. Create a tool wrapper file (e.g., `SlackTool.node.js`)
2. Implement `getDefinition()` - what the AI sees
3. Implement `executeTool()` - what actually happens
4. Export it in `index.js`
5. Restart the server

That's it! The AI Agent will automatically discover and use your tools.
