# AI Agent Nodes

AI Agent nodes for workflow automation - Build intelligent agents with LLMs, memory, and tools.

## Overview

This package provides a modular node architecture for creating AI agents that can:
- Interact with various language models (OpenAI, Anthropic)
- Maintain conversation memory using different storage strategies
- Execute tools to accomplish tasks
- Orchestrate complex agent workflows

## Architecture

The system consists of four primary node types:

1. **AI Agent Node** - The orchestrator that manages the agent execution loop
2. **Model Nodes** - Abstract AI provider implementations (OpenAI, Anthropic)
3. **Memory Nodes** - Manage conversation history (Buffer, Window, Redis)
4. **Tool Nodes** - Executable functions the agent can invoke (Calculator, HTTP Request, Knowledge Base)

## Installation

This package is automatically loaded as a custom node package. Dependencies will be installed when the package is first used.

## Nodes

### AI Agent
The main orchestrator node that coordinates between model, memory, and tool nodes.

### Model Nodes
- **OpenAI Model** - Use GPT models (GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo)
- **Anthropic Model** - Use Claude models (Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus)

### Memory Nodes
- **Buffer Memory** - Store all messages without limit (in-memory)
- **Window Memory** - Keep only N most recent messages (in-memory)
- **Redis Memory** - Persistent storage using Redis

### Tool Nodes
- **Calculator Tool** - Perform mathematical calculations
- **HTTP Request Tool** - Make HTTP requests to external APIs
- **Knowledge Base Tool** - Search vector databases for information

## Usage

### Basic Agent Workflow

1. Add an **AI Agent** node to your workflow
2. Connect a **Model** node (OpenAI or Anthropic)
3. Optionally connect a **Memory** node for conversation history
4. Optionally connect **Tool** nodes to extend capabilities
5. Configure the agent's system prompt and parameters
6. Execute the workflow

### Example: Simple Q&A Agent

```
[Trigger] → [AI Agent] ← [OpenAI Model]
```

### Example: Agent with Memory

```
[Trigger] → [AI Agent] ← [OpenAI Model]
                       ← [Buffer Memory]
```

### Example: Agent with Tools

```
[Trigger] → [AI Agent] ← [OpenAI Model]
                       ← [Calculator Tool]
                       ← [HTTP Request Tool]
```

## Credentials

### OpenAI API
Required for OpenAI Model and Knowledge Base Tool nodes.
- API Key: Your OpenAI API key

### Anthropic API
Required for Anthropic Model nodes.
- API Key: Your Anthropic API key

### Redis Connection
Required for Redis Memory nodes.
- Host: Redis server hostname
- Port: Redis server port
- Password: Redis authentication password (optional)
- Database: Redis database number (optional)

## Configuration

### AI Agent Node
- **System Prompt**: Instructions that define the agent's behavior
- **User Message**: The message to send to the agent (supports expressions)
- **Max Iterations**: Maximum number of agent loop iterations (default: 10)
- **Tool Choice**: Control when the agent can use tools (auto/required/none)
- **Output Format**: Format of the response (text/json/full)

### Model Nodes
- **Model**: Select the specific model to use
- **Temperature**: Control randomness (0-2 for OpenAI, 0-1 for Anthropic)
- **Max Tokens**: Maximum response length

### Memory Nodes
- **Session ID**: Unique identifier for conversation context (supports expressions)
- **Max Messages** (Window Memory): Number of recent messages to keep
- **TTL** (Redis Memory): Time-to-live for messages in seconds

## Troubleshooting

### Agent not using tools
- Check that Tool nodes are properly connected to the AI Agent
- Verify Tool Choice is set to "auto" or "required"
- Ensure the model supports function calling (GPT-4+, Claude 3+)

### Memory not persisting
- For Buffer/Window Memory: These use in-memory storage and reset on workflow restart
- For Redis Memory: Verify Redis connection credentials and that Redis server is running

### API errors
- Verify API credentials are correctly configured
- Check API rate limits and quotas
- Ensure you have access to the selected model

## Development

This package follows the custom node development pattern. Each node is implemented as a separate file in the `nodes/` directory, with credentials defined in the `credentials/` directory and shared utilities in the `utils/` directory.

## License

MIT
