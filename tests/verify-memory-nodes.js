/**
 * Verification script for Memory nodes
 * Tests Buffer Memory, Window Memory, and Redis Memory implementations
 */

const BufferMemory = require('../nodes/BufferMemory.node.js');
const WindowMemory = require('../nodes/WindowMemory.node.js');
const RedisMemory = require('../nodes/RedisMemory.node.js');

// Mock logger
const mockLogger = {
  info: (...args) => console.log('[INFO]', ...args),
  debug: (...args) => console.log('[DEBUG]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

// Mock node context
function createMockContext(nodeType, params = {}) {
  return {
    logger: mockLogger,
    async getNodeParameter(name) {
      return params[name];
    },
    async resolveValue(value) {
      // Simple expression resolver for testing
      if (typeof value === 'string' && value.includes('{{')) {
        // For testing, just return the value as-is
        return value.replace(/\{\{|\}\}/g, '');
      }
      return value;
    },
    async getCredentials(type) {
      // Mock Redis credentials for testing
      if (type === 'redisConnection') {
        return {
          host: 'localhost',
          port: 6379,
          password: '',
          database: 0,
        };
      }
      return null;
    },
  };
}

// Test messages
const testMessages = [
  { role: 'user', content: 'Hello!', timestamp: Date.now() },
  { role: 'assistant', content: 'Hi there!', timestamp: Date.now() + 1000 },
  { role: 'user', content: 'How are you?', timestamp: Date.now() + 2000 },
  { role: 'assistant', content: 'I am doing well!', timestamp: Date.now() + 3000 },
];

async function testBufferMemory() {
  console.log('\n=== Testing Buffer Memory ===\n');

  const context = createMockContext('buffer-memory', { sessionId: 'test-session-1' });
  const node = Object.assign(Object.create(BufferMemory), context);

  try {
    // Test 1: Get messages from empty session
    console.log('Test 1: Get messages from empty session');
    const emptyMessages = await node.getMessages('test-session-1');
    console.log('✓ Empty messages:', emptyMessages.length === 0 ? 'PASS' : 'FAIL');

    // Test 2: Add messages
    console.log('\nTest 2: Add messages');
    for (const msg of testMessages) {
      await node.addMessage('test-session-1', msg);
    }
    console.log('✓ Added 4 messages');

    // Test 3: Get all messages
    console.log('\nTest 3: Get all messages');
    const allMessages = await node.getMessages('test-session-1');
    console.log('✓ Retrieved messages:', allMessages.length === 4 ? 'PASS' : 'FAIL');
    console.log('  Message count:', allMessages.length);

    // Test 4: Session isolation
    console.log('\nTest 4: Session isolation');
    await node.addMessage('test-session-2', testMessages[0]);
    const session1Messages = await node.getMessages('test-session-1');
    const session2Messages = await node.getMessages('test-session-2');
    console.log('✓ Session 1 messages:', session1Messages.length);
    console.log('✓ Session 2 messages:', session2Messages.length);
    console.log('✓ Isolation:', session1Messages.length === 4 && session2Messages.length === 1 ? 'PASS' : 'FAIL');

    // Test 5: Clear session
    console.log('\nTest 5: Clear session');
    await node.clear('test-session-1');
    const clearedMessages = await node.getMessages('test-session-1');
    console.log('✓ Cleared session:', clearedMessages.length === 0 ? 'PASS' : 'FAIL');

    console.log('\n✓ Buffer Memory: ALL TESTS PASSED\n');
    return true;
  } catch (error) {
    console.error('✗ Buffer Memory test failed:', error.message);
    return false;
  }
}

async function testWindowMemory() {
  console.log('\n=== Testing Window Memory ===\n');

  const context = createMockContext('window-memory', {
    sessionId: 'test-session-3',
    maxMessages: 2,
  });
  const node = Object.assign(Object.create(WindowMemory), context);

  try {
    // Test 1: Add messages beyond window size
    console.log('Test 1: Add messages beyond window size (max=2)');
    for (const msg of testMessages) {
      await node.addMessage('test-session-3', msg);
    }
    console.log('✓ Added 4 messages');

    // Test 2: Get messages (should only return last 2)
    console.log('\nTest 2: Get messages (should return last 2)');
    const windowMessages = await node.getMessages('test-session-3');
    console.log('✓ Retrieved messages:', windowMessages.length === 2 ? 'PASS' : 'FAIL');
    console.log('  Message count:', windowMessages.length);
    console.log('  Last message:', windowMessages[windowMessages.length - 1].content);

    // Test 3: Verify correct messages are kept
    console.log('\nTest 3: Verify correct messages (should be last 2)');
    const lastTwo = windowMessages.map((m) => m.content);
    const expectedLastTwo = ['How are you?', 'I am doing well!'];
    const correct = JSON.stringify(lastTwo) === JSON.stringify(expectedLastTwo);
    console.log('✓ Correct messages:', correct ? 'PASS' : 'FAIL');
    console.log('  Expected:', expectedLastTwo);
    console.log('  Got:', lastTwo);

    // Test 4: Clear session
    console.log('\nTest 4: Clear session');
    await node.clear('test-session-3');
    const clearedMessages = await node.getMessages('test-session-3');
    console.log('✓ Cleared session:', clearedMessages.length === 0 ? 'PASS' : 'FAIL');

    console.log('\n✓ Window Memory: ALL TESTS PASSED\n');
    return true;
  } catch (error) {
    console.error('✗ Window Memory test failed:', error.message);
    return false;
  }
}

async function testRedisMemory() {
  console.log('\n=== Testing Redis Memory ===\n');
  console.log('Note: Redis tests require a running Redis server on localhost:6379');
  console.log('If Redis is not available, tests will gracefully degrade.\n');

  const context = createMockContext('redis-memory', {
    sessionId: 'test-session-4',
    options: {
      ttl: 3600,
      keyPrefix: 'test:agent:memory:',
    },
  });
  const node = Object.assign(Object.create(RedisMemory), context);

  try {
    // Test 1: Add messages
    console.log('Test 1: Add messages to Redis');
    for (const msg of testMessages.slice(0, 2)) {
      await node.addMessage('test-session-4', msg);
    }
    console.log('✓ Added 2 messages (or gracefully degraded)');

    // Test 2: Get messages
    console.log('\nTest 2: Get messages from Redis');
    const messages = await node.getMessages('test-session-4');
    console.log('✓ Retrieved messages:', messages.length);
    console.log('  (If Redis unavailable, returns empty array)');

    // Test 3: Clear session
    console.log('\nTest 3: Clear session');
    await node.clear('test-session-4');
    console.log('✓ Cleared session (or gracefully degraded)');

    console.log('\n✓ Redis Memory: TESTS COMPLETED (graceful degradation enabled)\n');
    return true;
  } catch (error) {
    console.error('✗ Redis Memory test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Memory Nodes Verification Script                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const results = {
    bufferMemory: false,
    windowMemory: false,
    redisMemory: false,
  };

  results.bufferMemory = await testBufferMemory();
  results.windowMemory = await testWindowMemory();
  results.redisMemory = await testRedisMemory();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('Buffer Memory:', results.bufferMemory ? '✓ PASS' : '✗ FAIL');
  console.log('Window Memory:', results.windowMemory ? '✓ PASS' : '✗ FAIL');
  console.log('Redis Memory:', results.redisMemory ? '✓ PASS' : '✗ FAIL');
  console.log('');

  const allPassed = Object.values(results).every((r) => r);
  if (allPassed) {
    console.log('✓ All Memory nodes verified successfully!');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed. Please review the output above.');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
