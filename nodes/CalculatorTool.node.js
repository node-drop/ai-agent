/**
 * Calculator Tool Node
 * 
 * Performs mathematical calculations for the AI Agent.
 * Connect this node to the AI Agent's 'tools' input to enable calculation capabilities.
 * 
 * Features:
 * - Safe mathematical expression evaluation
 * - Basic arithmetic operations (+, -, *, /)
 * - Exponents (^)
 * - Parentheses for operation precedence
 * - Input validation to prevent code injection
 */

const { ToolNodeInterface } = require('../utils/interfaces');

const CalculatorToolNode = {
  identifier: 'calculator-tool',
  nodeCategory: 'tool', // Indicates this is a tool node (not directly executable)
  displayName: 'Calculator Tool',
  name: 'calculator-tool',
  group: ['ai', 'tool'],
  version: 1,
  description: 'Perform mathematical calculations (service node for AI Agent)',
  icon: 'fa:calculator',
  color: '#4CAF50',
  defaults: {
    name: 'Calculator Tool',
  },
  inputs: [],
  outputs: ['tool'], // Output to connect to AI Agent's tools input
  properties: [], // No properties needed - tool is self-contained

  /**
   * Get the tool definition for the AI model
   * Implements ToolNodeInterface.getDefinition()
   * 
   * @returns {Object} Tool definition with name, description, and parameters
   */
  getDefinition() {
    return {
      name: 'calculator',
      description: 'Perform mathematical calculations. Supports basic arithmetic (+, -, *, /), exponents (^), and parentheses for operation precedence.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate (e.g., "2 + 2", "(10 * 5) / 2", "2^8")',
          },
        },
        required: ['expression'],
      },
    };
  },

  /**
   * Safely evaluate a mathematical expression
   * @private
   * @param {string} expression - The mathematical expression to evaluate
   * @returns {number} The result of the calculation
   */
  _evaluateExpression(expression) {
    // Replace ^ with ** for exponentiation
    let processedExpression = expression.replace(/\^/g, '**');
    
    // Use Function constructor for safe evaluation
    // This is safer than eval() as it doesn't have access to local scope
    try {
      const result = new Function(`'use strict'; return (${processedExpression})`)();
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Result is not a valid number');
      }
      
      return result;
    } catch (error) {
      throw new Error(`Invalid expression: ${error.message}`);
    }
  },

  /**
   * Execute the calculator tool
   * Implements ToolNodeInterface.execute()
   * 
   * @param {Object} args - Tool arguments
   * @param {string} args.expression - Mathematical expression to evaluate
   * @returns {Promise<Object>} Tool result with success status and data/error
   */
  async executeTool(args) {
    try {
      // Validate that expression is provided
      if (!args.expression || typeof args.expression !== 'string') {
        return {
          success: false,
          error: 'Expression parameter is required and must be a string',
        };
      }

      const expression = args.expression.trim();

      // Validate expression contains only safe characters
      // Allow: numbers, operators (+, -, *, /, ^), parentheses, decimal points, and whitespace
      const safePattern = /^[0-9+\-*/().\s^]+$/;
      if (!safePattern.test(expression)) {
        return {
          success: false,
          error: 'Invalid expression: only numbers, operators (+, -, *, /, ^), parentheses, and decimal points are allowed',
        };
      }

      // Check for empty expression
      if (expression.length === 0) {
        return {
          success: false,
          error: 'Expression cannot be empty',
        };
      }

      // Evaluate the expression
      const result = this._evaluateExpression(expression);

      this.logger?.info('[Calculator Tool] Calculation completed', {
        expression,
        result,
      });

      return {
        success: true,
        data: {
          result,
          expression,
        },
      };
    } catch (error) {
      this.logger?.error('[Calculator Tool] Calculation failed', {
        expression: args.expression,
        error: error.message,
      });

      return {
        success: false,
        error: `Calculation error: ${error.message}`,
      };
    }
  },

  /**
   * Execute method (required for node interface)
   * Service nodes don't execute directly - they're called by the AI Agent
   */
  execute: async function () {
    throw new Error(
      'Calculator Tool is a service node and should not be executed directly. ' +
        'Connect it to an AI Agent node instead.'
    );
  },
};

module.exports = CalculatorToolNode;
