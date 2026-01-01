# Supervisor Agent Node

The Supervisor Agent orchestrates multiple AI agents to accomplish complex tasks through intelligent delegation.

## Overview

Instead of one agent doing everything, the Supervisor Agent acts as a "manager" that:
1. Analyzes incoming tasks
2. Delegates subtasks to specialized worker agents
3. Coordinates parallel or sequential execution
4. Aggregates results into a unified response

## How Worker Agents Receive Tasks

Worker agents (regular AI Agent nodes) connect to the Supervisor as **service inputs**. They don't receive data through the normal workflow flow - instead, the Supervisor calls them programmatically using the `executeAsWorker()` method.

```
┌──────────────────────────────────────────────────────────────────┐
│                         WORKFLOW CANVAS                          │
│                                                                  │
│   [Chat] ──────────▶ [Supervisor Agent] ──────────▶ [Output]    │
│                            │  │  │                               │
│                            │  │  │  (service connections)        │
│                            ▼  ▼  ▼                               │
│                      ┌─────┐┌─────┐┌─────┐                      │
│                      │Agent││Agent││Agent│                      │
│                      │  1  ││  2  ││  3  │                      │
│                      └──┬──┘└──┬──┘└──┬──┘                      │
│                         │     │     │                            │
│                         ▼     ▼     ▼                            │
│                      [Model][Model][Model]                       │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User** sends message via Chat → **Supervisor** receives it
2. **Supervisor** analyzes the task and decides which agent(s) to use
3. **Supervisor** calls `agent.executeAsWorker(task)` for each worker
4. **Worker agents** process their subtasks and return results
5. **Supervisor** aggregates results and returns final response

```
User: "Research competitors and write a report"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPERVISOR AGENT                          │
│                                                              │
│  Thinks: "This needs research + writing"                    │
│                                                              │
│  Calls: researchAgent.executeAsWorker(                      │
│           "Find competitor information for..."              │
│         )                                                    │
│         ↓                                                    │
│  Result: { competitors: [...], pricing: [...] }             │
│                                                              │
│  Calls: writerAgent.executeAsWorker(                        │
│           "Write a summary report based on: {research}"     │
│         )                                                    │
│         ↓                                                    │
│  Result: "## Competitor Analysis Report..."                 │
│                                                              │
│  Aggregates → Final Response                                │
└─────────────────────────────────────────────────────────────┘
```

## Architecture

```
                    ┌─────────────────┐
                    │   User Request  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Supervisor Agent │◄── Model (GPT-4, Claude)
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │   Worker    │   │   Worker    │   │   Worker    │
    │   Agent 1   │   │   Agent 2   │   │   Agent 3   │
    └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
           │                 │                 │
           ▼                 ▼                 ▼
        [Model]           [Model]           [Model]
        [Tools]           [Tools]           [Tools]
```

## Node Types

| Node | Purpose | Inputs | Outputs |
|------|---------|--------|---------|
| **Supervisor Agent** | Orchestrates workers | Chat/Trigger + Model + Workers | Response |
| **Worker Agent** | Executes delegated tasks | Model + Tools (no main input) | To Supervisor |
| **AI Agent** | Standalone agent | Chat/Trigger + Model + Tools | Response |

## Routing Strategies

### Auto (Supervisor Decides)
The supervisor analyzes the task and intelligently decides which agent(s) to delegate to.

```
User: "Research competitors and write a summary report"

Supervisor thinks:
  → This needs research first, then writing
  → Delegate to Research Agent: "Find competitor information"
  → Delegate to Writer Agent: "Summarize the research findings"
  → Synthesize final response
```

### Broadcast (All Agents)
Send the task to all connected agents and aggregate their responses.

```
User: "Analyze this code for issues"

Supervisor broadcasts to:
  → Security Agent: checks for vulnerabilities
  → Performance Agent: checks for bottlenecks
  → Style Agent: checks for code quality
  → Aggregates all findings
```

### Sequential (Chain)
Pass the task through agents in order, each building on the previous output.

```
User: "Create a blog post about AI"

Chain:
  → Research Agent: gathers information
  → Writer Agent: drafts post from research
  → Editor Agent: polishes the draft
  → Final output
```

## Result Aggregation Modes

| Mode | Description |
|------|-------------|
| **Synthesize** | Supervisor creates a unified response from all agent outputs |
| **Concatenate** | Combine all responses sequentially with agent labels |
| **Best Result** | Supervisor picks the single best response |
| **Structured** | Return results as JSON object keyed by agent name |

## Usage Examples

### Example 1: Customer Support Router

```
[Webhook Trigger] → [Supervisor Agent] ← [OpenAI Model]
                           ↓
              ┌────────────┼────────────┐
              ↓            ↓            ↓
        [Billing     [Technical    [General
         Agent]       Agent]        Agent]
```

Configuration:
- Routing: Auto
- System Prompt: "Route customer inquiries to the appropriate specialist"

### Example 2: Content Creation Pipeline

```
[Manual Trigger] → [Supervisor Agent] ← [Claude Model]
                          ↓
              ┌───────────┼───────────┐
              ↓           ↓           ↓
        [Research   [Writer      [SEO
         Agent]      Agent]       Agent]
```

Configuration:
- Routing: Sequential
- Aggregation: Synthesize

### Example 3: Code Review Team

```
[GitHub Webhook] → [Supervisor Agent] ← [GPT-4 Model]
                          ↓
         ┌────────────────┼────────────────┐
         ↓                ↓                ↓
   [Security        [Performance     [Style
    Reviewer]        Reviewer]        Reviewer]
```

Configuration:
- Routing: Broadcast
- Parallel Execution: Yes
- Aggregation: Structured

## Configuration Options

### Basic Settings

| Property | Description | Default |
|----------|-------------|---------|
| System Prompt | Instructions for the supervisor | Coordinator prompt |
| User Message | Task to process (supports expressions) | Required |
| Routing Strategy | How to delegate tasks | Auto |
| Max Iterations | Supervisor reasoning loops | 5 |
| Max Delegations | Total delegations allowed | 10 |

### Advanced Options

| Option | Description | Default |
|--------|-------------|---------|
| Result Aggregation | How to combine agent outputs | Synthesize |
| Parallel Execution | Run independent tasks in parallel | Yes |
| Share Context | Share results between agents | Yes |
| Session ID | Conversation context identifier | default |
| Timeout | Maximum execution time (ms) | 600000 |

## Best Practices

### 1. Design Specialized Agents
Each worker agent should have a clear, focused role:
- ✅ "Research Agent" - finds and summarizes information
- ✅ "Code Agent" - writes and reviews code
- ❌ "General Agent" - does everything (defeats the purpose)

### 2. Write Clear System Prompts
Help the supervisor understand each agent's capabilities:

```
Research Agent System Prompt:
"You are a research specialist. You excel at finding information,
verifying facts, and summarizing findings. You have access to
web search and knowledge base tools."
```

### 3. Use Appropriate Routing
- **Auto**: Complex tasks requiring judgment
- **Broadcast**: Tasks needing multiple perspectives
- **Sequential**: Tasks with clear dependencies

### 4. Set Reasonable Limits
- Max Iterations: 3-5 for simple tasks, 5-10 for complex
- Max Delegations: 5-10 for most use cases
- Timeout: 2-5 minutes for typical workflows

## Troubleshooting

### Supervisor not delegating
- Check that worker agents are properly connected
- Verify system prompt explains available agents
- Ensure routing strategy is set to "auto"

### Agents not receiving context
- Enable "Share Context Between Agents" option
- Check that agents have compatible input formats

### Timeout errors
- Increase timeout for complex multi-agent tasks
- Reduce max iterations/delegations
- Simplify agent tasks

### Poor result quality
- Use "Synthesize" aggregation for coherent responses
- Improve agent system prompts
- Consider sequential routing for dependent tasks

## API Reference

### Input
```typescript
{
  main: [{
    json: {
      message: string;  // User's request
      context?: any;    // Optional context data
    }
  }]
}
```

### Output
```typescript
{
  main: [{
    json: {
      response: string;      // Final aggregated response
      success: boolean;
      summary?: string;      // Optional summary
      metadata: {
        routingStrategy: string;
        aggregationMode: string;
        duration: number;
        totalDelegations: number;
        delegationHistory: Array<{
          agentName: string;
          task: string;
          status: string;
          duration: number;
        }>;
        iterations: number;
      }
    }
  }]
}
```

## Comparison with AI Agent

| Feature | AI Agent | Supervisor Agent |
|---------|----------|------------------|
| Single LLM | ✅ | ✅ (for coordination) |
| Tool execution | ✅ | Via worker agents |
| Multi-agent | ❌ | ✅ |
| Task delegation | ❌ | ✅ |
| Parallel execution | ❌ | ✅ |
| Result aggregation | ❌ | ✅ |
| Best for | Single-focus tasks | Complex multi-step tasks |
