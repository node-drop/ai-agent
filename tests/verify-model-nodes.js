/**
 * Verification script for Model nodes
 * Tests that the OpenAI and Anthropic model nodes are properly structured
 */

const OpenAIModelNode = require('../nodes/OpenAIModel.node.js');
const AnthropicModelNode = require('../nodes/AnthropicModel.node.js');

console.log('🔍 Verifying Model Nodes Implementation...\n');

let errors = 0;
let warnings = 0;

// Test OpenAI Model Node
console.log('📦 Testing OpenAI Model Node:');
try {
  // Check required properties
  if (!OpenAIModelNode.type) {
    console.error('  ❌ Missing type property');
    errors++;
  } else if (OpenAIModelNode.type !== 'openai-model') {
    console.error(`  ❌ Wrong type: ${OpenAIModelNode.type}`);
    errors++;
  } else {
    console.log(`  ✅ Type: ${OpenAIModelNode.type}`);
  }

  if (!OpenAIModelNode.displayName) {
    console.error('  ❌ Missing displayName');
    errors++;
  } else {
    console.log(`  ✅ Display Name: ${OpenAIModelNode.displayName}`);
  }

  if (!OpenAIModelNode.properties || !Array.isArray(OpenAIModelNode.properties)) {
    console.error('  ❌ Missing or invalid properties array');
    errors++;
  } else {
    console.log(`  ✅ Properties: ${OpenAIModelNode.properties.length} defined`);
    
    // Check for required properties
    const propNames = OpenAIModelNode.properties.map(p => p.name);
    const required = ['authentication', 'model', 'temperature', 'maxTokens', 'options'];
    required.forEach(name => {
      if (!propNames.includes(name)) {
        console.error(`  ❌ Missing required property: ${name}`);
        errors++;
      }
    });
  }

  // Check for required methods
  if (typeof OpenAIModelNode.chat !== 'function') {
    console.error('  ❌ Missing chat() method');
    errors++;
  } else {
    console.log('  ✅ chat() method defined');
  }

  if (typeof OpenAIModelNode.supportsTools !== 'function') {
    console.error('  ❌ Missing supportsTools() method');
    errors++;
  } else {
    console.log('  ✅ supportsTools() method defined');
  }

  if (typeof OpenAIModelNode.getModelInfo !== 'function') {
    console.error('  ❌ Missing getModelInfo() method');
    errors++;
  } else {
    console.log('  ✅ getModelInfo() method defined');
  }

  // Check service node configuration
  if (OpenAIModelNode.inputs && OpenAIModelNode.inputs.length > 0) {
    console.warn('  ⚠️  Service node should have no inputs');
    warnings++;
  } else {
    console.log('  ✅ No inputs (service node)');
  }

  if (OpenAIModelNode.outputs && OpenAIModelNode.outputs.length > 0) {
    console.warn('  ⚠️  Service node should have no outputs');
    warnings++;
  } else {
    console.log('  ✅ No outputs (service node)');
  }

  console.log('');
} catch (error) {
  console.error(`  ❌ Error loading OpenAI Model Node: ${error.message}`);
  errors++;
}

// Test Anthropic Model Node
console.log('📦 Testing Anthropic Model Node:');
try {
  // Check required properties
  if (!AnthropicModelNode.type) {
    console.error('  ❌ Missing type property');
    errors++;
  } else if (AnthropicModelNode.type !== 'anthropic-model') {
    console.error(`  ❌ Wrong type: ${AnthropicModelNode.type}`);
    errors++;
  } else {
    console.log(`  ✅ Type: ${AnthropicModelNode.type}`);
  }

  if (!AnthropicModelNode.displayName) {
    console.error('  ❌ Missing displayName');
    errors++;
  } else {
    console.log(`  ✅ Display Name: ${AnthropicModelNode.displayName}`);
  }

  if (!AnthropicModelNode.properties || !Array.isArray(AnthropicModelNode.properties)) {
    console.error('  ❌ Missing or invalid properties array');
    errors++;
  } else {
    console.log(`  ✅ Properties: ${AnthropicModelNode.properties.length} defined`);
    
    // Check for required properties
    const propNames = AnthropicModelNode.properties.map(p => p.name);
    const required = ['authentication', 'model', 'temperature', 'maxTokens', 'options'];
    required.forEach(name => {
      if (!propNames.includes(name)) {
        console.error(`  ❌ Missing required property: ${name}`);
        errors++;
      }
    });
  }

  // Check for required methods
  if (typeof AnthropicModelNode.chat !== 'function') {
    console.error('  ❌ Missing chat() method');
    errors++;
  } else {
    console.log('  ✅ chat() method defined');
  }

  if (typeof AnthropicModelNode.supportsTools !== 'function') {
    console.error('  ❌ Missing supportsTools() method');
    errors++;
  } else {
    console.log('  ✅ supportsTools() method defined');
  }

  if (typeof AnthropicModelNode.getModelInfo !== 'function') {
    console.error('  ❌ Missing getModelInfo() method');
    errors++;
  } else {
    console.log('  ✅ getModelInfo() method defined');
  }

  // Check service node configuration
  if (AnthropicModelNode.inputs && AnthropicModelNode.inputs.length > 0) {
    console.warn('  ⚠️  Service node should have no inputs');
    warnings++;
  } else {
    console.log('  ✅ No inputs (service node)');
  }

  if (AnthropicModelNode.outputs && AnthropicModelNode.outputs.length > 0) {
    console.warn('  ⚠️  Service node should have no outputs');
    warnings++;
  } else {
    console.log('  ✅ No outputs (service node)');
  }

  console.log('');
} catch (error) {
  console.error(`  ❌ Error loading Anthropic Model Node: ${error.message}`);
  errors++;
}

// Summary
console.log('═'.repeat(50));
if (errors === 0 && warnings === 0) {
  console.log('✅ All checks passed! Model nodes are properly implemented.');
  process.exit(0);
} else {
  if (errors > 0) {
    console.log(`❌ ${errors} error(s) found`);
  }
  if (warnings > 0) {
    console.log(`⚠️  ${warnings} warning(s) found`);
  }
  process.exit(errors > 0 ? 1 : 0);
}
