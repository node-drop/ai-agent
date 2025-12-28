# Human-in-the-Loop Implementation Summary

## What We Built

A complete human-in-the-loop (HITL) system that allows AI Agents to pause execution and wait for human confirmation, approval, or input before taking actions.

## Components Created

### 1. Ask Human Tool Node
**File:** `nodes/AskHumanTool.node.js`

A tool node that the AI Agent can call to request human input. When called:
- Formats a question for the user
- Returns a special status flag (`requiresHumanInput: true`)
- Signals the agent to pause execution

**Features:**
- Configurable timeout
- Auto-approve/reject keywords
- Optional response options
- Context and question formatting

### 2. Execution Pause Manager
**File:** `utils/executionPauseManager.js`

Manages paused executions and resume callbacks:
- Stores pending executions in memory
- Handles timeout logic
- Updates database execution status
- Provides resume/cancel functionality
- Auto-cleanup of old executions

**Key Methods:**
- `pauseForHumanInput(executionId, state, timeout)` - Pause and wait
- `resumeWithResponse(executionId, response)` - Resume with user's answer
- `cancelExecution(executionId, reason)` - Cancel paused execution
- `isPaused(executionId)` - Check if execution is paused

### 3. AI Agent Integration
**File:** `nodes/AIAgent.node.js` (modified)

Updated the agent loop to detect and handle human input requests:
- Detects when tool returns `requiresHumanInput: true`
- Pauses execution using ExecutionPauseManager
- Waits for user response (with timeout)
- Resumes execution with user's answer
- Adds user response to conversation history

### 4. API Endpoints
**File:** `src/routes/execution-resume.ts`

REST API for managing paused executions:
- `POST /api/executions/:id/resume` - Resume with user response
- `GET /api/executions/:id/status` - Check if paused
- `GET /api/executions/paused` - List all paused executions
- `POST /api/executions/:id/cancel` - Cancel paused execution

### 5. Documentation
**Files:**
- `docs/HUMAN_IN_THE_LOOP.md` - Complete user guide
- `examples/human-in-the-loop-example.json` - Example workflow

## How It Works

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User sends message via chat                              │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 2. AI Agent processes message                               │
│    - Calls model                                             │
│    - Model decides to use ask_human tool                     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 3. Ask Human Tool executes                                  │
│    - Returns: { requiresHumanInput: true, question: "..." } │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 4. AI Agent detects human input required                    │
│    - Adds question to conversation                           │
│    - Calls executionPauseManager.pauseForHumanInput()       │
│    - Saves execution state                                   │
│    - Updates DB: status = PAUSED                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ ⏸️  EXECUTION PAUSED
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 5. User sees question in chat and responds                  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 6. Chat system calls API:                                   │
│    POST /api/executions/:id/resume                          │
│    { response: "yes, proceed" }                             │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 7. ExecutionPauseManager resumes execution                  │
│    - Resolves promise with user's response                  │
│    - Updates DB: status = RUNNING                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ ▶️  EXECUTION RESUMED
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 8. AI Agent continues                                       │
│    - Adds user response to conversation                      │
│    - Adds tool result with user's answer                     │
│    - Calls model again with updated context                  │
│    - Model processes user's response                         │
│    - Agent completes or continues loop                       │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 9. Final response sent to user                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Conversational Approach
✅ **Chosen:** Questions appear as messages in chat
❌ **Not chosen:** UI alerts/modals

**Why:** Works with any chat interface (Telegram, WhatsApp, Slack, etc.), feels natural, async-friendly

### 2. In-Memory State with DB Backup
✅ **Chosen:** Promise-based pause/resume with in-memory storage
❌ **Not chosen:** Polling database for responses

**Why:** Fast, efficient, real-time resume, automatic cleanup

### 3. Tool-Based Implementation
✅ **Chosen:** `ask_human` as a regular tool
❌ **Not chosen:** Built-in agent feature

**Why:** Flexible, optional, follows existing architecture, agent decides when to use

### 4. No Langchain Dependency
✅ **Chosen:** Custom implementation
❌ **Not chosen:** Langchain's HumanInputRun

**Why:** Langchain doesn't solve the hard parts (pause/resume), adds overhead, less control

## Usage Example

### Simple Workflow

```javascript
// 1. Add Ask Human Tool to workflow
const askHumanTool = {
  type: 'ask-human-tool',
  parameters: {
    timeout: 300, // 5 minutes
    autoApproveKeywords: 'yes, approve, proceed',
    autoRejectKeywords: 'no, reject, cancel'
  }
};

// 2. Connect to AI Agent
// The agent automatically gets access to ask_human tool

// 3. Agent uses it naturally
// System prompt: "Before deleting data, always ask for confirmation"

// User: "Delete old accounts"
// Agent: [Calls ask_human tool]
// Execution pauses
// User: "yes"
// Execution resumes
// Agent: [Deletes accounts] "Done!"
```

### API Integration

```javascript
// When user responds in chat, call:
await fetch(`/api/executions/${executionId}/resume`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    response: userMessage
  })
});
```

## Testing

### Manual Test

1. Create workflow with AI Agent + Ask Human Tool
2. Connect to chat interface
3. Send message that triggers confirmation
4. Verify execution pauses
5. Respond in chat
6. Verify execution resumes
7. Check conversation history includes pause/resume

### API Test

```bash
# Check paused executions
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/executions/paused

# Resume execution
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"response":"yes, proceed"}' \
  http://localhost:4000/api/executions/exec_123/resume

# Check status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/executions/exec_123/status
```

## Database Schema

Uses existing `Execution` model fields:
- `pausedAt` - Timestamp when execution paused
- `resumedAt` - Timestamp when execution resumed
- `status` - Execution status (RUNNING, PAUSED, COMPLETED, etc.)
- `flowProgressData` - Stores execution state during pause

No schema changes required! ✅

## Next Steps

### For Frontend Integration:
1. Detect when execution is paused (via WebSocket or polling)
2. Show "waiting for response" indicator
3. When user sends message, call resume API
4. Update UI when execution resumes

### For Chat Nodes:
1. Detect paused executions in chat context
2. Automatically call resume API when user responds
3. Handle timeout gracefully
4. Show clear indicators in chat UI

### Future Enhancements:
- Multi-user approval workflows
- Approval templates
- Scheduled approvals
- Audit trail
- Approval delegation

## Files Modified

1. ✅ `nodes/AskHumanTool.node.js` - NEW
2. ✅ `utils/executionPauseManager.js` - NEW
3. ✅ `nodes/AIAgent.node.js` - MODIFIED (added pause/resume logic)
4. ✅ `index.js` - MODIFIED (registered new tool)
5. ✅ `src/routes/execution-resume.ts` - NEW
6. ✅ `src/index.ts` - MODIFIED (registered new route)
7. ✅ `docs/HUMAN_IN_THE_LOOP.md` - NEW
8. ✅ `examples/human-in-the-loop-example.json` - NEW

## Ready to Use! 🎉

The human-in-the-loop feature is now fully implemented and ready to use. Just:
1. Restart your backend server
2. Add the Ask Human Tool to your workflow
3. Connect it to your AI Agent
4. Start asking for confirmations!
