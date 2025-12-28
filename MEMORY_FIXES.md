# Buffer Memory Fixes

## Issues Fixed

### 1. Session ID Always Using 'default'

**Problem**: Even when changing the session ID in the AI Agent options, the memory always used 'default'.

**Root Cause**: The code used `options.sessionId || 'default'`, which treats empty strings as falsy. Since the default value for sessionId in the UI is an empty string `''`, it would always fall back to `'default'`.

**Fix**: Changed the logic to:
```javascript
const sessionId = (options.sessionId && options.sessionId.trim()) || 'default';
```

This properly checks if the sessionId is a non-empty string before using it.

### 2. No Way to Clear Buffer Memory

**Problem**: The BufferMemory node had a `clear()` method, but there was no way to call it from the workflow UI.

**Solution**: Added a new "Clear Memory" boolean property to the BufferMemory node configuration:
- When enabled, the AI Agent will clear all messages for the session before loading history
- This happens automatically at the start of each execution
- Useful for starting fresh conversations or resetting context

## Usage

### Setting a Custom Session ID

In the AI Agent node, under Options:
1. Expand the "Options" section
2. Add "Session ID" option
3. Enter your session ID (e.g., `user-123` or `{{json.userId}}`)
4. The session ID now properly isolates conversations

### Clearing Memory

There are two ways to clear memory:

**Option 1: Clear on Next Execution (Automatic)**
1. Open the BufferMemory node configuration
2. Enable the "Clear Memory" checkbox
3. The next time the AI Agent runs, it will clear all messages for that session first
4. Disable it again if you want to resume accumulating history

**Option 2: Clear Immediately (Manual)**
1. Open the BufferMemory node configuration
2. Click the red "Clear Memory" button
3. Confirm the action
4. Memory is cleared instantly - no need to run the workflow

The button will show up in the Config tab of the BufferMemory node, below the other settings.

## Technical Details

### Session ID Resolution
- Empty strings or whitespace-only strings fall back to 'default'
- Supports expression syntax like `{{json.userId}}`
- Properly passed to all memory operations (getMessages, addMessage, clear)

### Clear Operation
- Executes before loading conversation history
- Only clears the specific session (other sessions unaffected)
- Logged for debugging purposes
- Gracefully handles errors without stopping execution
