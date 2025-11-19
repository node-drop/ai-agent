#!/usr/bin/env node

/**
 * Tool Template Generator
 * 
 * Quick script to generate a tool wrapper template for any service.
 * 
 * Usage:
 *   node create-tool-template.js gmail "Send emails via Gmail"
 *   node create-tool-template.js sheets "Interact with Google Sheets"
 */

const fs = require('fs');
const path = require('path');

// Get command line arguments
const serviceName = process.argv[2];
const description = process.argv[3] || 'Service description';

if (!serviceName) {
  console.error('❌ Error: Service name is required');
  console.log('\nUsage:');
  console.log('  node create-tool-template.js <service-name> "<description>"');
  console.log('\nExamples:');
  console.log('  node create-tool-template.js gmail "Send emails via Gmail"');
  console.log('  node create-tool-template.js sheets "Interact with Google Sheets"');
  process.exit(1);
}

// Generate names
const serviceLower = serviceName.toLowerCase();
const serviceCapitalized = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
const identifier = `${serviceLower}-tool`;
const displayName = `${serviceCapitalized} Tool`;
const fileName = `${serviceCapitalized}Tool.node.js`;

// Generate template
const template = `/**
 * ${displayName}
 * 
 * ${description}
 * Connect this node to the AI Agent's 'tools' input to enable ${serviceLower} capabilities.
 * 
 * TODO: Implement the actual service integration
 */

const ${serviceCapitalized}ToolNode = {
  identifier: '${identifier}',
  nodeCategory: 'tool', // Indicates this is a tool node
  displayName: '${displayName}',
  name: '${identifier}',
  group: ['ai', 'tool'],
  version: 1,
  description: '${description} (service node for AI Agent)',
  icon: 'fa:icon-name', // TODO: Change to appropriate icon
  color: '#4A90E2', // TODO: Change to service brand color
  defaults: {
    name: '${displayName}',
  },
  inputs: [],
  outputs: ['tool'], // Output to connect to AI Agent's tools input
  credentials: [
    {
      name: '${serviceLower}', // TODO: Update to match your credential type
      required: true,
    },
  ],
  properties: [
    {
      displayName: 'Authentication',
      name: 'authentication',
      type: 'credential',
      required: true,
      default: '',
      description: 'Select ${serviceLower} credentials',
      placeholder: 'Select credentials...',
      allowedTypes: ['${serviceLower}'], // TODO: Update to match your credential type
    },
  ],

  /**
   * Get the tool definition for the AI model
   * Implements ToolNodeInterface.getDefinition()
   * 
   * @returns {Object} Tool definition with name, description, and parameters
   */
  getDefinition() {
    return {
      name: '${serviceLower}_action', // TODO: Change to specific action name
      description: 'TODO: Describe what this tool does and when to use it',
      parameters: {
        type: 'object',
        properties: {
          // TODO: Define parameters the AI needs to provide
          param1: {
            type: 'string',
            description: 'TODO: Describe this parameter',
          },
          param2: {
            type: 'string',
            description: 'TODO: Describe this parameter',
          },
        },
        required: ['param1'], // TODO: List required parameters
      },
    };
  },

  /**
   * Execute the ${serviceLower} tool
   * Implements ToolNodeInterface.executeTool()
   * 
   * @param {Object} args - Tool arguments from AI
   * @returns {Promise<Object>} Tool result with success status and data/error
   */
  async executeTool(args) {
    try {
      // TODO: Step 1 - Validate required parameters
      if (!args.param1 || typeof args.param1 !== 'string') {
        return {
          success: false,
          error: 'param1 is required and must be a string',
        };
      }

      // TODO: Step 2 - Get credentials
      const credentials = await this.getCredentials('${serviceLower}');
      if (!credentials) {
        return {
          success: false,
          error: '${serviceCapitalized} credentials not configured',
        };
      }

      this.logger?.info('[${displayName}] Executing action', {
        param1: args.param1,
      });

      // TODO: Step 3 - Call the actual service
      // Example:
      // const client = new ServiceClient(credentials.apiKey);
      // const result = await client.doSomething(args.param1);

      // TODO: Step 4 - Return success with data
      return {
        success: true,
        data: {
          message: 'Action completed successfully',
          // TODO: Include relevant result data
        },
      };
    } catch (error) {
      this.logger?.error('[${displayName}] Action failed', {
        error: error.message,
      });

      // TODO: Step 5 - Handle specific error cases
      return {
        success: false,
        error: \`Failed to execute ${serviceLower} action: \${error.message}\`,
      };
    }
  },

  /**
   * Execute method (required for node interface)
   * Service nodes don't execute directly - they're called by the AI Agent
   */
  execute: async function () {
    throw new Error(
      '${displayName} is a service node and should not be executed directly. ' +
        'Connect it to an AI Agent node instead.'
    );
  },
};

module.exports = ${serviceCapitalized}ToolNode;
`;

// Write the file
const outputPath = path.join(__dirname, 'nodes', fileName);

try {
  fs.writeFileSync(outputPath, template);
  console.log('✅ Tool template created successfully!');
  console.log(`\nFile: ${outputPath}`);
  console.log('\n📝 Next steps:');
  console.log('1. Open the file and search for "TODO" comments');
  console.log('2. Implement the service integration');
  console.log('3. Update getDefinition() with actual parameters');
  console.log('4. Implement executeTool() with service API calls');
  console.log('5. Add to index.js exports:');
  console.log(`   "${serviceLower}Tool": require("./nodes/${fileName}"),`);
  console.log('6. Add to package.json nodes array:');
  console.log(`   "nodes/${fileName}"`);
  console.log('7. Install any required dependencies');
  console.log('8. Restart the server');
  console.log('\n📚 See CREATING_TOOL_WRAPPERS.md for detailed guide');
} catch (error) {
  console.error('❌ Error creating template:', error.message);
  process.exit(1);
}
`;
