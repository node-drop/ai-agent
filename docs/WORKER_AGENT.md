# Worker Agent Node

A specialized agent designed to work as part of a multi-agent team, receiving tasks from a Supervisor Agent.

## Overview

The Worker Agent is different from the regular AI Agent:

| Feature | AI Agent | Worker Agent |
|---------|----------|--------------|
| Main input | ✅ Yes (from Chat/Trigger) | ❌ No |
| Receives tasks from | Workflow flow | Supervisor Agent |
| Output | To workflow | To Supervisor |
| Use case | Standalone agent | Multi-agent team member |

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     WORKFLOW CANVAS                          │
│                                                              │
│  [Chat] ──▶ [Supervisor Agent] ──▶ [Output]                 │
│                  │    │    │                                 │
│                  │    │    │  (agentService connections)     │
│                  ▼    ▼    ▼                                 │
│            ┌────────┐┌────────┐┌────────┐                   │
│            │ Worker ││ Worker ││ Worker │                   │
│            │ Agent  ││ Agent  ││ Agent  │                   │
│            │Research││ Writer ││ Coder  │                   │
│            └───┬────┘└───┬────┘└───┬────┘                   │
│                │         │         │                         │
│                ▼         ▼         ▼                         │
│            [Model]   [Model]   [Model]                       │
│            [Tools]   [Tools]   [Tools]                       │
└─────────────────────────────────────────────────────────────┘
```

1. User sends message → Supervisor receives it
2. Supervisor analyzes and delegates → calls `workerAgent.executeTask(task)`
3. Worker processes with its own Model + Tools
4. Worker returns result → Supervisor aggregates

## Configuration

### Properties

| Property | Description | Example |
|----------|-------------|---------|
| **Agent Name** | Identifier shown in logs | "Research Agent" |
| **Specialty** | Brief description of expertise | "Web research and data gathering" |
| **System Prompt** | Detailed instructions | "You are a research specialist..." |
| **Max Iterations** | Agent loop limit | 10 |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| Tool Choice | When to use tools | Auto |
| Include Shared Context | Receive other agents' results | Yes |
| Timeout | Max execution time | 120000ms |

## Example Setup

### 1. Research Agent

```
Name: Research Agent
Specialty: Web research and information gathering

System Prompt:
You are a research specialist. Your job is to:
- Find accurate, up-to-date information
- Verify facts from multiple sources
- Summarize findings clearly
- Cite your sources

Tools: HTTP Request Tool, Knowledge Base Tool
```

### 2. Writer Agent

```
Name: Writer Agent  
Specialty: Content writing and editing

System Prompt:
You are a professional writer. Your job is to:
- Write clear, engaging content
- Adapt tone to the audience
- Structure information logically
- Edit for clarity and grammar

Tools: None (pure writing)
```

### 3. Code Agent

```
Name: Code Agent
Specialty: Code generation and review

System Prompt:
You are a senior software engineer. Your job is to:
- Write clean, efficient code
- Follow best practices
- Add helpful comments
- Consider edge cases

Tools: Calculator Tool (for algorithms)
```

## Shared Context

When "Include Shared Context" is enabled, Worker Agents receive results from other team members:

```
Task from Supervisor: "Write a summary of the research"

Context added automatically:
---
Relevant findings from team members:
[Research Agent]: Found 5 competitors with pricing ranging from $10-50/month...
[Data Agent]: Market analysis shows 23% growth in Q4...
```

This allows agents to build on each other's work.

## API Reference

### executeTask(task, options)

Called by Supervisor Agent to execute a task.

**Parameters:**
```typescript
task: string           // The task/message to process
options: {
  context?: string     // Additional context
  sharedContext?: {    // Results from other agents
    previousResults: Array<{
      agentName: string
      result: string
    }>
  }
  sessionId?: string   // For memory persistence
}
```

**Returns:**
```typescript
{
  success: boolean
  response: string        // Agent's response
  agentName: string       // This agent's name
  error?: string          // If success is false
  metadata: {
    iterations: number
    toolsUsed: string[]
    duration: number
  }
}
```

### getAgentDefinition()

Returns metadata about the agent for Supervisor.

```typescript
{
  name: string          // Agent name
  specialty: string     // Brief specialty description
  description: string   // System prompt excerpt
  identifier: string    // Node identifier
}
```

## Best Practices

### 1. Clear Specialization
Each Worker Agent should have a focused role:
- ✅ "Research Agent" - finds information
- ✅ "Writer Agent" - creates content
- ❌ "General Agent" - does everything

### 2. Descriptive System Prompts
Help the agent understand its role:
```
You are a [ROLE]. Your expertise is in [SPECIALTY].

When given a task, you should:
1. [SPECIFIC BEHAVIOR]
2. [SPECIFIC BEHAVIOR]
3. [SPECIFIC BEHAVIOR]

You have access to these tools: [TOOL LIST]
```

### 3. Appropriate Tools
Connect only relevant tools:
- Research Agent → HTTP Request, Knowledge Base
- Writer Agent → None (or grammar checker)
- Code Agent → Calculator, Code Executor

### 4. Reasonable Limits
- Max Iterations: 5-10 for most tasks
- Timeout: 60-120 seconds typically

## Troubleshooting

### "Worker Agent should be connected to Supervisor"
This node doesn't work standalone. Connect it to a Supervisor Agent's "Agents" input.

### Agent not receiving tasks
- Verify connection to Supervisor's agentService input
- Check Supervisor's routing strategy
- Ensure agent has a Model connected

### Poor quality responses
- Improve system prompt with specific instructions
- Add relevant tools for the task type
- Enable shared context for team awareness

### Timeout errors
- Increase timeout in options
- Reduce max iterations
- Simplify the task scope
