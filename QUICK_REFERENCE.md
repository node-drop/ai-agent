# Tool Wrapper Quick Reference

## TL;DR

**YES** - You need a tool wrapper for each service (Gmail, Slack, Sheets, etc.)  
**BUT** - It's a 5-minute copy-paste job per service

## The Two Required Methods

```javascript
// 1. What the AI sees
getDefinition() {
  return {
    name: 'tool_name',
    description: 'What it does',
    parameters: { /* JSON Schema */ }
  };
}

// 2. What actually happens
async executeTool(args) {
  // validate → get credentials → call service → return result
}
```

## Quick Create

### Option 1: Use Template Generator
```bash
cd backend/custom-nodes/packages/ai-agent-nodes
node create-tool-template.js gmail "Send emails via Gmail"
```

### Option 2: Copy Existing Tool
```bash
cp nodes/SlackTool.node.js nodes/GmailTool.node.js
# Edit and replace Slack with Gmail
```

## Existing Tools

| Tool | What It Does | File |
|------|-------------|------|
| Calculator | Math operations | `CalculatorTool.node.js` |
| HTTP Request | API calls | `HttpRequestTool.node.js` |
| Knowledge Base | Search knowledge | `KnowledgeBaseTool.node.js` |
| Slack | Send messages | `SlackTool.node.js` |

## Common Services to Wrap

### Communication
- ✅ Slack (done)
- ⬜ Gmail
- ⬜ Email (SMTP)
- ⬜ Discord
- ⬜ Telegram

### Productivity
- ⬜ Google Sheets
- ⬜ Google Drive
- ⬜ Google Calendar
- ⬜ Notion
- ⬜ Airtable

### Databases
- ⬜ MongoDB
- ⬜ PostgreSQL
- ⬜ MySQL
- ⬜ Redis

### Other
- ⬜ Stripe (payments)
- ⬜ Twilio (SMS)
- ⬜ AWS S3 (storage)
- ⬜ GitHub (repos)

## Minimal Example

```javascript
const ServiceToolNode = {
  identifier: 'service-tool',
  nodeCategory: 'tool',
  displayName: 'Service Tool',
  inputs: [],
  outputs: ['tool'],
  
  getDefinition() {
    return {
      name: 'service_action',
      description: 'Does something useful',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'What to do' }
        },
        required: ['input']
      }
    };
  },
  
  async executeTool(args) {
    try {
      const creds = await this.getCredentials('service');
      const result = await callServiceAPI(creds, args.input);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  execute: async function() {
    throw new Error('Connect to AI Agent instead');
  }
};
```

## Registration Checklist

After creating a tool:

1. ✅ Create `ServiceTool.node.js`
2. ✅ Add to `index.js`:
   ```javascript
   "serviceTool": require("./nodes/ServiceTool.node.js")
   ```
3. ✅ Add to `package.json` nodes array:
   ```json
   "nodes/ServiceTool.node.js"
   ```
4. ✅ Install dependencies: `npm install`
5. ✅ Restart server

## Testing

1. Add AI Agent node to workflow
2. Add your Tool node to workflow
3. Connect Tool → Agent's "tools" input
4. Add Model node → Agent's "model" input
5. Test with prompt: "Use [service] to do [action]"

## Common Mistakes

❌ Forgetting to export in `index.js`  
❌ Not implementing both methods  
❌ Using `execute()` instead of `executeTool()`  
❌ Not validating parameters  
❌ Not handling errors gracefully  

## Help

- **Detailed Guide:** `CREATING_TOOL_WRAPPERS.md`
- **Summary:** `TOOL_WRAPPER_SUMMARY.md`
- **Examples:** Check `nodes/SlackTool.node.js`
- **Template Generator:** `node create-tool-template.js`

## The Bottom Line

**Every service = One tool wrapper**

But it's worth it because:
- AI can use your services automatically
- Natural language → Actions
- Intelligent multi-step workflows
- 5 minutes per service

Start with your top 3 most-used services and expand from there!
