# Service Inputs Implementation Guide

## Overview

Service Inputs are a new type of node connection that appear at the **bottom-right** of a node with clear labels. They are designed for configuration/service connections that are separate from the main data flow.

## Visual Design

```
┌─────────────────────────┐
│  [●]  AI Agent    [●]  │  ← Main input/output (left/right)
│                         │
│  Agent Orchestrator     │
│                         │
│                         │
│              Model* [■] │  ← Service inputs (bottom-right)
│             Memory  [■] │     with labels
│              Tools  [■] │
└─────────────────────────┘
```

## Implementation

### 1. Backend Node Definition

In your node file (e.g., `AIAgent.node.js`):

```javascript
{
  type: 'ai-agent',
  inputs: ['main'],  // Regular workflow inputs (left side)
  outputs: ['main'], // Regular workflow outputs (right side)
  serviceInputs: [   // Service connections (bottom-right)
    {
      name: 'model',           // Connection ID
      displayName: 'Model',    // Label shown to user
      required: true,          // Shows asterisk and red ring
      description: 'AI Model (OpenAI or Anthropic)',  // Subtitle
    },
    {
      name: 'memory',
      displayName: 'Memory',
      required: false,
      description: 'Conversation Memory (optional)',
    },
    {
      name: 'tools',
      displayName: 'Tools',
      required: false,
      description: 'Agent Tools (optional)',
    },
  ],
  // ... rest of node definition
}
```

### 2. Frontend Data Flow

The data flows automatically through these components:

1. **workflowTransformers.ts**: Extracts `serviceInputs` from node type definition
2. **CustomNode.tsx**: Passes `serviceInputs` to `nodeConfig`
3. **BaseNodeWrapper.tsx**: Renders `ServiceHandles` component
4. **ServiceHandles.tsx**: Displays the labeled connections

No additional frontend code needed!

### 3. Visual Indicators

- **Required connections**: 
  - Asterisk (*) after label
  - Red ring around handle
  - Example: `Model*`

- **Optional connections**:
  - No special indicators
  - Example: `Memory`

- **Handle style**:
  - Square shape (vs round for workflow handles)
  - Primary color
  - Positioned at bottom-right

### 4. Styling

Service handles automatically:
- Position at bottom-right of node
- Stack vertically with 8px gap
- Show label + description
- Adapt to light/dark theme
- Respond to disabled state

## Use Cases

Service Inputs are perfect for:

1. **AI Agent Nodes**: Model, Memory, Tools connections
2. **Database Nodes**: Connection, Schema, Credentials
3. **API Nodes**: Authentication, Rate Limiter, Cache
4. **Transform Nodes**: Template, Validator, Formatter

## Benefits

✅ **Clear Separation**: Service config vs data flow
✅ **Self-Documenting**: Labels and descriptions guide users
✅ **Visual Hierarchy**: Bottom-right position is distinct
✅ **Professional**: Matches industry-standard tools
✅ **Reusable**: Any node can use this pattern

## Example: AI Agent Node

```javascript
// Backend definition
{
  type: 'ai-agent',
  displayName: 'AI Agent',
  inputs: ['main'],
  outputs: ['main'],
  serviceInputs: [
    {
      name: 'model',
      displayName: 'Model',
      required: true,
      description: 'AI Model (OpenAI or Anthropic)',
    },
    {
      name: 'memory',
      displayName: 'Memory',
      required: false,
      description: 'Conversation Memory (optional)',
    },
    {
      name: 'tools',
      displayName: 'Tools',
      required: false,
      description: 'Agent Tools (optional)',
    },
  ],
}
```

Result: Users see a clean node with:
- Main input on left for workflow data
- Main output on right for results
- Three labeled service connections at bottom-right:
  - Model* (required, with red ring)
  - Memory (optional)
  - Tools (optional)

## Technical Details

### Type Definition

```typescript
serviceInputs?: Array<{
  name: string;           // Connection identifier
  displayName: string;    // User-facing label
  required?: boolean;     // Visual indicator
  description?: string;   // Subtitle/help text
}>
```

### Component Hierarchy

```
BaseNodeWrapper
  ├─ NodeHandles (left/right)
  └─ ServiceHandles (bottom-right)
       └─ ServiceHandle (each connection)
            ├─ Label + Description
            └─ Handle (square, primary color)
```

### Positioning

- **Absolute positioning**: `bottom: 0, right: 0`
- **Padding**: `p-2 pb-3` (8px sides, 12px bottom)
- **Gap**: `gap-2` (8px between connections)
- **Alignment**: `items-end` (right-aligned)

## Migration Guide

If you have existing nodes with unlabeled inputs, you can migrate them:

### Before (confusing):
```javascript
{
  inputs: ['main', 'config1', 'config2', 'config3'],
  outputs: ['main'],
}
```

### After (clear):
```javascript
{
  inputs: ['main'],
  outputs: ['main'],
  serviceInputs: [
    { name: 'config1', displayName: 'Config 1', required: true, description: 'Primary configuration' },
    { name: 'config2', displayName: 'Config 2', required: false, description: 'Optional settings' },
    { name: 'config3', displayName: 'Config 3', required: false, description: 'Advanced options' },
  ],
}
```

## Best Practices

1. **Use for configuration**: Service inputs are for setup, not data flow
2. **Clear labels**: Use descriptive names (not "Input 1", "Input 2")
3. **Mark required**: Always set `required: true` for mandatory connections
4. **Add descriptions**: Help users understand what each connection does
5. **Limit count**: Keep to 3-5 service inputs max for clarity

## Troubleshooting

**Service inputs not showing?**
- Check that `serviceInputs` is defined in node definition
- Verify `workflowTransformers.ts` includes `getNodeServiceInputs()`
- Ensure `CustomNode` passes `serviceInputs` to `nodeConfig`
- Confirm `BaseNodeWrapper` renders `ServiceHandles` component

**Styling issues?**
- Service handles use Tailwind classes
- Check theme (light/dark) compatibility
- Verify `ServiceHandles.tsx` component is imported

**Connection not working?**
- Service inputs use the same connection system as regular inputs
- The `name` field must match the connection target
- Check workflow connections in database

## Future Enhancements

Potential improvements:
- Collapsible service inputs section
- Drag-to-reorder service connections
- Custom icons per service input
- Tooltips on hover
- Connection validation indicators
