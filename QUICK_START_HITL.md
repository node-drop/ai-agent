# Quick Start: Human-in-the-Loop

Get started with human-in-the-loop in 5 minutes!

## Step 1: Restart Backend

```bash
cd backend
npm run dev
```

The new Ask Human Tool will be automatically registered.

## Step 2: Create a Simple Workflow

### Nodes Needed:
1. **Chat Trigger** - To receive user messages
2. **AI Agent** - The orchestrator
3. **OpenAI Model** - Connected to AI Agent's "Model" input
4. **Buffer Memory** - Connected to AI Agent's "Memory" input
5. **Ask Human Tool** - Connected to AI Agent's "Tools" input
6. **Chat Reply** - To send responses back

### Connections:
```
Chat Trigger → AI Agent → Chat Reply
                  ↓
            [Model: OpenAI]
            [Memory: Buffer]
            [Tools: Ask Human]
```

## Step 3: Configure AI Agent

### System Prompt:
```
You are a helpful assistant. Before taking any important action 
(like sending emails, deleting data, or making purchases), you 
MUST use the ask_human tool to get confirmation from the user.

Always provide clear details about what you're about to do and 
wait for the user's approval.
```

### User Message:
```
{{json.message}}
```

### Options:
- Tool Choice: `auto`
- Output Format: `text`
- Session ID: `{{json.userId}}`
- Timeout: `300000` (5 minutes)

## Step 4: Test It!

### Example Conversation:

**You:** "Send an email to all customers about our sale"

**Agent:** 
```
I'll help you with that. Let me prepare the email details.

🤔 Human Input Required

I'm about to send an email to 10,247 customers with the following details:

Subject: Big Sale - 50% Off Everything!
Preview: Don't miss our biggest sale of the year...

Recipients: 10,247 active customers
Estimated Cost: $102

📋 Context: This will be sent to all customers who opted in to marketing emails.

Options:
1. yes - send the email
2. no - cancel
3. modify - make changes

Please respond to continue...
```

**You:** "yes"

**Agent:** "✓ Email sent successfully to 10,247 customers!"

## Step 5: Monitor Paused Executions

### Check Status:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/executions/paused
```

### Resume Manually (if needed):
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"response":"yes, proceed"}' \
  http://localhost:4000/api/executions/EXECUTION_ID/resume
```

## Common Use Cases

### 1. Email Confirmation
```
System Prompt: "Before sending any email, use ask_human to confirm."
```

### 2. Data Deletion
```
System Prompt: "Before deleting any data, use ask_human to get approval."
```

### 3. Financial Transactions
```
System Prompt: "Before making any purchase or transfer, use ask_human to confirm."
```

### 4. API Calls
```
System Prompt: "Before calling external APIs, use ask_human to verify the request."
```

## Troubleshooting

### Agent doesn't ask for confirmation
- Check system prompt mentions `ask_human` tool
- Verify Ask Human Tool is connected
- Check Tool Choice is set to `auto` (not `none`)

### Execution never resumes
- Check timeout setting (default 5 minutes)
- Verify user responded in correct chat
- Check server logs for errors

### User response not recognized
- Agent receives full text regardless of keywords
- Keywords only affect the `intent` field
- Agent can interpret any response

## Advanced Configuration

### Custom Timeout:
```javascript
// In Ask Human Tool properties
timeout: 600 // 10 minutes
```

### Custom Keywords:
```javascript
// Auto-approve
autoApproveKeywords: "yes, approve, proceed, ok, confirm, do it, send it"

// Auto-reject
autoRejectKeywords: "no, reject, cancel, stop, deny, don't, abort"
```

### Multiple Tools:
```
AI Agent
  ├─ Model: OpenAI
  ├─ Memory: Buffer
  └─ Tools:
      ├─ Ask Human
      ├─ Calculator
      ├─ HTTP Request
      └─ Knowledge Base
```

## Next Steps

- Read full documentation: `docs/HUMAN_IN_THE_LOOP.md`
- See example workflow: `examples/human-in-the-loop-example.json`
- Check implementation details: `HUMAN_IN_THE_LOOP_IMPLEMENTATION.md`

## Need Help?

Common questions:
1. **How long can execution be paused?** Default 5 minutes, max 24 hours
2. **Can multiple users approve?** Not yet, but planned for future
3. **Does it work with Telegram/WhatsApp?** Yes! Works with any chat interface
4. **Is conversation history preserved?** Yes, everything is saved in memory

Happy building! 🚀
