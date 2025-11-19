# AI Agent Nodes Connection Guide

## Overview

The AI Agent system uses a modular architecture where different nodes are connected to create intelligent agents. This guide explains how to connect the nodes properly.

## Node Types and Connections

### AI Agent Node (Orchestrator)

The central node that coordinates all other nodes.

**Inputs:**
- `main` - Main workflow input (receives trigger data or user messages)
- `model` - **Required** - Connect a Model node here
- `memory` - Optional - Connect a Memory node here
- `tools` - Optional - Connect Tool nodes here (supports multiple connections)

**Outputs:**
- `main` - Returns agent response with optional metadata

---

### Model Nodes

Provide AI reasoning capabilities. **One Model node is required.**

#### OpenAI Model Node
- **Type**: `openai-model`
- **Outputs**: `model` - Connect to AI Agent's `model` input
- **Models**: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo

#### Anthropic Model Node
- **Type**: `anthropic-model`
- **Outputs**: `model` - Connect to AI Agent's `model` input
- **Models**: Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus

**Connection:**
```
[OpenAI Model] --model--> [AI Agent]
     or
[Anthropic Model] --model--> [AI Agent]
```

---

### Memory Nodes

Store and retrieve conversation history. **Memory nodes are optional.**

#### Buffer Memory Node
- **Type**: `buffer-memory`
- **Outputs**: `memory` - Connect to AI Agent's `memory` input
- **Storage**: In-memory (unlimited messages)
- **Use Case**: Short conversations, development/testing

#### Window Memory Node
- **Type**: `window-memory`
- **Outputs**: `memory` - Connect to AI Agent's `memory` input
- **Storage**: In-memory (sliding window of recent messages)
- **Use Case**: Long conversations with context management

#### Redis Memory Node
- **Type**: `redis-memory`
- **Outputs**: `memory` - Connect to AI Agent's `memory` input
- **Storage**: Redis (persistent, with TTL)
- **Use Case**: Production, multi-session, persistent storage

**Connection:**
```
[Buffer Memory] --memory--> [AI Agent]
      or
[Window Memory] --memory--> [AI Agent]
      or
[Redis Memory] --memory--> [AI Agent]
```

---

### Tool Nodes

Extend agent capabilities with specific functions. **Tool nodes are optional.**

#### Calculator Tool Node
- **Type**: `calculator-tool`
- **Outputs**: `tool` - Connect to AI Agent's `tools` input
- **Capability**: Mathematical calculations
- **Operations**: +, -, *, /, ^ (exponents), parentheses

#### HTTP Request Tool Node
- **Type**: `http-request-tool`
- **Outputs**: `tool` - Connect to AI Agent's `tools` input
- **Capability**: Make HTTP requests to external APIs
- **Methods**: GET, POST, PUT, DELETE, PATCH
- **Features**: Custom headers, request body, security validation

#### Knowledge Base Tool Node
- **Type**: `knowledge-base-tool`
- **Outputs**: `tool` - Connect to AI Agent's `tools` input
- **Capability**: Semantic search in vector database
- **Features**: Embedding generation, similarity search, configurable results

**Connection (Multiple Tools):**
```
[Calculator Tool] ----\
                       \
[HTTP Request Tool] ---+-tools--> [AI Agent]
                       /
[Knowledge Base Tool] /
```

---

## Complete Connection Examples

### Example 1: Basic Agent (Model Only)

```
[Manual Trigger] --main--> [AI Agent] --main--> [Output]
                              ^
                              |
                           [model]
                              |
                      [OpenAI Model]
```

**Use Case**: Simple Q&A without memory or tools

---

### Example 2: Agent with Memory

```
[Manual Trigger] --main--> [AI Agent] --main--> [Output]
                              ^  ^
                              |  |
                         [model][memory]
                              |  |
                      [OpenAI Model]
                                 |
                          [Buffer Memory]
```

**Use Case**: Conversational agent that remembers context

---

### Example 3: Agent with Tools

```
[Manual Trigger] --main--> [AI Agent] --main--> [Output]
                              ^  ^
                              |  |
                         [model][tools]
                              |  |
                      [OpenAI Model]
                                 |
                          [Calculator Tool]
                                 |
                          [HTTP Request Tool]
```

**Use Case**: Agent that can perform calculations and make API calls

---

### Example 4: Full-Featured Agent

```
[Manual Trigger] --main--> [AI Agent] --main--> [Output]
                              ^  ^  ^
                              |  |  |
                         [model][memory][tools]
                              |  |  |
                      [OpenAI Model]
                                 |
                          [Redis Memory]
                                 |
                          [Calculator Tool]
                                 |
                          [HTTP Request Tool]
                                 |
                          [Knowledge Base Tool]
```

**Use Case**: Production agent with full capabilities

---

## Connection Rules

### Required Connections
1. **Model node is required** - AI Agent must have a Model node connected to function
2. **Main input** - AI Agent must receive input from a trigger or previous node

### Optional Connections
1. **Memory node** - If not connected, agent won't remember conversation history
2. **Tool nodes** - If not connected, agent can only respond with text (no actions)

### Multiple Connections
1. **Only ONE Model node** - Connect either OpenAI or Anthropic, not both
2. **Only ONE Memory node** - Choose one memory strategy
3. **Multiple Tool nodes** - Connect as many tools as needed to the `tools` input

---

## Visual Connection in Workflow Editor

### Step 1: Add Nodes to Canvas
1. Drag **AI Agent** node to canvas
2. Drag **OpenAI Model** (or Anthropic Model) to canvas
3. (Optional) Drag **Memory** node to canvas
4. (Optional) Drag **Tool** nodes to canvas

### Step 2: Connect Model
1. Click on the **output port** of the Model node (labeled `model`)
2. Drag to the **model input port** of the AI Agent node
3. Release to create connection

### Step 3: Connect Memory (Optional)
1. Click on the **output port** of the Memory node (labeled `memory`)
2. Drag to the **memory input port** of the AI Agent node
3. Release to create connection

### Step 4: Connect Tools (Optional)
1. Click on the **output port** of the first Tool node (labeled `tool`)
2. Drag to the **tools input port** of the AI Agent node
3. Release to create connection
4. Repeat for additional Tool nodes (all connect to the same `tools` input)

### Step 5: Connect Main Flow
1. Connect a trigger node to the AI Agent's `main` input
2. Connect the AI Agent's `main` output to subsequent nodes

---

## Configuration After Connection

### AI Agent Configuration
- **System Prompt**: Define agent behavior
- **User Message**: The message to process (supports expressions)
- **Max Iterations**: Limit agent loop iterations (default: 10)
- **Options**:
  - Tool Choice: auto, required, or none
  - Output Format: text, json, or full
  - Session ID: For conversation tracking
  - Timeout: Maximum execution time

### Model Configuration
- **Authentication**: API credentials
- **Model**: Select specific model
- **Temperature**: Control randomness (0-2)
- **Max Tokens**: Response length limit

### Memory Configuration
- **Session ID**: Unique identifier for conversation
- **Window Size** (Window Memory): Number of messages to keep
- **TTL** (Redis Memory): Time-to-live for messages

### Tool Configuration
- Tools are self-contained and require no configuration
- The agent automatically discovers and uses connected tools

---

## Troubleshooting

### "Model node is required" Error
- **Cause**: No Model node connected
- **Solution**: Connect an OpenAI or Anthropic Model node to the `model` input

### Agent Not Using Tools
- **Cause**: Tools not connected or toolChoice set to 'none'
- **Solution**: 
  1. Verify Tool nodes are connected to `tools` input
  2. Check toolChoice option is set to 'auto' or 'required'

### Agent Not Remembering Conversation
- **Cause**: No Memory node connected or different session IDs
- **Solution**:
  1. Connect a Memory node to `memory` input
  2. Ensure consistent session ID across requests

### "Cannot connect to X" Error
- **Cause**: Invalid connection attempt
- **Solution**: 
  - Model nodes connect to `model` input only
  - Memory nodes connect to `memory` input only
  - Tool nodes connect to `tools` input only

---

## Best Practices

1. **Start Simple**: Begin with just Model + AI Agent, then add Memory and Tools
2. **Use Memory for Conversations**: Always add Memory for multi-turn conversations
3. **Choose Right Memory**: 
   - Buffer for development
   - Window for long conversations
   - Redis for production
4. **Add Tools Strategically**: Only add tools the agent actually needs
5. **Set Appropriate Limits**: Configure maxIterations based on task complexity
6. **Monitor Token Usage**: Use 'full' output format to track token consumption
7. **Test Incrementally**: Test each connection before adding more complexity

---

## Summary

The AI Agent system uses a clean, modular architecture:

- **AI Agent** = Orchestrator (required)
- **Model** = Brain (required, one only)
- **Memory** = Context (optional, one only)
- **Tools** = Capabilities (optional, multiple allowed)

Connect them visually in the workflow editor, configure as needed, and you have a fully functional AI agent!
