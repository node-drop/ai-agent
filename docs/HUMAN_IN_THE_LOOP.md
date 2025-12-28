# Human-in-the-Loop (HITL) Feature

## Overview

The Human-in-the-Loop feature allows your AI Agent to pause execution and ask for human confirmation, approval, or input before taking important actions. This is perfect for scenarios where you need human judgment or want to prevent the agent from making mistakes.

## How It Works

1. **Agent calls `ask_human` tool** - The AI decides it needs human input
2. **Question sent to user** - The question appears in the chat interface
3. **Execution pauses** - The workflow pauses and saves its state
4. **User responds** - User types their response in the chat
5. **Execution resumes** - The workflow continues with the user's answer
6. **Agent proceeds** - The AI uses the human's response to continue

## Setup

### 1. Connect the Ask Human Tool

In your workflow:
1. Add the **"Ask Human Tool"** node
2. Connect it to your **AI Agent** node's "Tools" input
3. The agent will automatically have access to the `ask_human` tool

```
┌─────────────┐
│  AI Agent   │
└──────┬──────┘
       │ Tools
       ├──────────┐
       │          │
┌──────▼──────┐  │
│ Ask Human   │  │
│    Tool     │  │
└─────────────┘  │
                 │
┌────────────────▼┐
│  Other Tools    │
│  (Calculator,   │
│   HTTP, etc.)   │
└─────────────────┘
```

### 2. Configure Your Chat Interface

The agent needs to be connected to a chat interface (Chat Trigger, Telegram, WhatsApp, etc.) so users can respond.

```
┌──────────────┐
│ Chat Trigger │
└──────┬───────┘
       │
┌──────▼──────┐
│  AI Agent   │
│  (with Ask  │
│  Human Tool)│
└──────┬──────┘
       │
┌──────▼──────┐
│ Chat Reply  │
└─────────────┘
```

## Usage Examples

### Example 1: Email Confirmation

```javascript
// Agent's system prompt:
"You are an email assistant. Before sending any email, 
always use the ask_human tool to get confirmation."

// Conversation:
User: "Send a promotional email to all customers"

Agent: [Calls ask_human tool]
{
  question: "I'm about to send an email to 10,247 customers with subject 'New Product Launch'. Should I proceed?",
  context: "This will send to all active customers in the database.",
  options: ["yes", "no", "modify"]
}

// Execution pauses, user sees:
"🤔 Human Input Required

I'm about to send an email to 10,247 customers with subject 'New Product Launch'. Should I proceed?

📋 Context: This will send to all active customers in the database.

Options:
1. yes
2. no
3. modify

Please respond to continue..."

User: "Change the subject to something catchier"

// Execution resumes, agent receives: "Change the subject to something catchier"
Agent: "I'll revise the subject. How about 'You Won't Believe What We Just Launched 🚀'?"

User: "Perfect, send it"

Agent: [Sends email]
"✓ Email sent to 10,247 customers"
```

### Example 2: Database Operations

```javascript
// Agent's system prompt:
"You are a database admin assistant. Always ask for confirmation 
before deleting, updating, or modifying data."

User: "Delete all inactive user accounts"

Agent: [Calls ask_human tool]
{
  question: "I found 5,247 inactive accounts to delete. Should I proceed?",
  context: "Accounts with no login in 2+ years. 15 have pending orders.",
  options: ["yes - delete all", "safe - exclude pending orders", "no - cancel"]
}

User: "safe - exclude pending orders"

Agent: [Deletes 5,232 accounts]
"✓ Deleted 5,232 accounts. Preserved 15 with pending orders."
```

### Example 3: Financial Transactions

```javascript
User: "Rebalance my portfolio"

Agent: [Analyzes portfolio, calls ask_human tool]
{
  question: "Portfolio Rebalancing Plan:\n\nSELL:\n• $50,000 Apple @ $180\n• $30,000 Tesla @ $245\n\nBUY:\n• $40,000 Bitcoin\n• $25,000 S&P 500 ETF\n• $15,000 Bonds\n\nExpected: +12% growth, Medium risk\n\nProceed?",
  options: ["yes", "no", "modify"]
}

User: "reduce bitcoin to 20k and add more bonds"

Agent: "Updated plan: $20K Bitcoin, $25K S&P 500, $35K Bonds. Risk: Low-Medium. Proceed?"

User: "yes"

Agent: [Executes trades]
"✓ Trades executed. Portfolio rebalanced."
```

## API Endpoints

### Resume Execution
```http
POST /api/executions/:executionId/resume
Authorization: Bearer <token>
Content-Type: application/json

{
  "response": "yes, proceed with the action"
}
```

### Check Execution Status
```http
GET /api/executions/:executionId/status
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "executionId": "exec_123",
  "isPaused": true,
  "info": {
    "executionId": "exec_123",
    "timestamp": 1234567890,
    "waitingTime": 5000,
    "hasTimeout": true
  }
}
```

### Get All Paused Executions
```http
GET /api/executions/paused
Authorization: Bearer <token>
```

### Cancel Paused Execution
```http
POST /api/executions/:executionId/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "User cancelled the operation"
}
```

## Configuration Options

### Ask Human Tool Properties

- **Default Timeout** (seconds): How long to wait for user response (0 = no timeout)
  - Default: 300 seconds (5 minutes)
  - Range: 0 to 86400 (24 hours)

- **Auto-approve Keywords**: Comma-separated keywords that count as approval
  - Default: "yes, approve, proceed, ok, confirm"
  - Case-insensitive

- **Auto-reject Keywords**: Comma-separated keywords that count as rejection
  - Default: "no, reject, cancel, stop, deny"
  - Case-insensitive

## Best Practices

### 1. Clear Questions
✅ Good: "I'm about to delete 5,000 user accounts. Should I proceed?"
❌ Bad: "Delete users?"

### 2. Provide Context
✅ Good: "Sending email to 10K customers. Subject: 'Sale'. Cost: $500. Proceed?"
❌ Bad: "Send email?"

### 3. Offer Options
✅ Good: "Options: 1. yes 2. no 3. modify"
❌ Bad: Just asking without guidance

### 4. Use for Important Actions
✅ Use for: Deleting data, sending emails, financial transactions, API calls
❌ Don't use for: Simple queries, calculations, reading data

### 5. Set Appropriate Timeouts
- Quick decisions: 60-300 seconds
- Review tasks: 300-1800 seconds (5-30 minutes)
- Async approval: 3600+ seconds (1+ hours)

## Troubleshooting

### Execution Never Resumes
- Check if user responded in the correct chat
- Verify execution ID is correct
- Check if timeout was reached
- Look for errors in server logs

### User Response Not Recognized
- Check auto-approve/reject keywords configuration
- User might need to be more explicit ("yes" vs "maybe")
- Agent will receive the full response text regardless

### Multiple Paused Executions
- Each execution has a unique ID
- Users can have multiple paused conversations
- Use `/api/executions/paused` to see all pending

## Architecture Notes

### Execution State
When execution pauses, the following state is saved:
- All conversation messages
- Current iteration number
- Tool call details
- Agent metadata

### Resume Mechanism
1. User response triggers API call
2. ExecutionPauseManager finds pending execution
3. Promise resolves with user's response
4. Agent loop continues from where it paused
5. User's response is added to conversation history

### Memory Integration
- Paused state is stored in-memory (fast)
- Execution status is saved to database
- Conversation history includes the pause/resume
- Works seamlessly with Memory nodes

## Security Considerations

- Only authenticated users can resume executions
- Execution IDs are unique and hard to guess
- Timeouts prevent indefinite waits
- Old paused executions are cleaned up automatically (24 hours)

## Future Enhancements

Potential improvements:
- [ ] Multi-user approval (require 2+ approvals)
- [ ] Approval workflows (escalation chains)
- [ ] Scheduled approvals (approve at specific time)
- [ ] Approval templates (pre-defined approval flows)
- [ ] Audit trail (who approved what and when)
