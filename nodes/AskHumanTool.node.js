/**
 * Ask Human Tool Node
 * 
 * Enables human-in-the-loop for AI Agent by pausing execution and waiting for user response.
 * The agent can ask for confirmation, clarification, or approval before taking actions.
 * 
 * Features:
 * - Conversational confirmation (no UI alerts)
 * - Works with any chat interface (Chat, Telegram, WhatsApp, etc.)
 * - Execution pause/resume mechanism
 * - Timeout handling
 * - Natural conversation flow
 * 
 * How it works:
 * 1. Agent calls ask_human tool with a question
 * 2. Question is sent to user via chat
 * 3. Execution pauses and saves state
 * 4. User responds in chat
 * 5. Execution resumes with user's response
 * 6. Agent continues with user's answer
 */

const { ToolNodeInterface } = require('../utils/interfaces');

const AskHumanToolNode = {
  identifier: 'ask-human-tool',
  nodeCategory: 'tool',
  displayName: 'Ask Human Tool',
  name: 'ask-human-tool',
  group: ['ai', 'tool', 'human'],
  version: 1,
  description: 'Ask human for confirmation or input (enables human-in-the-loop)',
  icon: 'file:ask-human.svg',
  color: '#FF6B6B',
  defaults: {
    name: 'Ask Human',
  },
  inputs: [],
  outputs: ['toolService'],
  properties: [
    {
      displayName: 'Default Timeout',
      name: 'timeout',
      type: 'number',
      default: 300,
      required: false,
      description: 'Default timeout in seconds to wait for human response (0 = no timeout)',
      placeholder: '300',
      typeOptions: {
        minValue: 0,
        maxValue: 86400, // 24 hours
      },
    },
    {
      displayName: 'Auto-approve Keywords',
      name: 'autoApproveKeywords',
      type: 'string',
      default: 'yes, approve, proceed, ok, confirm',
      required: false,
      description: 'Comma-separated keywords that count as approval (case-insensitive)',
      placeholder: 'yes, approve, proceed',
    },
    {
      displayName: 'Auto-reject Keywords',
      name: 'autoRejectKeywords',
      type: 'string',
      default: 'no, reject, cancel, stop, deny',
      required: false,
      description: 'Comma-separated keywords that count as rejection (case-insensitive)',
      placeholder: 'no, reject, cancel',
    },
  ],

  /**
   * Get the tool definition for the AI model
   * Implements ToolNodeInterface.getDefinition()
   */
  getDefinition() {
    return {
      name: 'ask_human',
      description: 'Ask the human user for confirmation, approval, or input before proceeding with an action. Use this when you need human judgment, approval for important actions, or clarification. The execution will pause until the human responds.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to ask the human. Be clear and specific about what you need.',
          },
          context: {
            type: 'string',
            description: 'Additional context about what action you\'re about to take and why you need approval.',
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: Suggested response options for the user (e.g., ["yes", "no", "modify"])',
          },
        },
        required: ['question'],
      },
    };
  },

  /**
   * Parse user response to determine intent
   * @private
   */
  _parseUserResponse(response, autoApproveKeywords, autoRejectKeywords) {
    const normalizedResponse = response.toLowerCase().trim();
    
    // Check for approval keywords
    const approveKeywords = autoApproveKeywords.split(',').map(k => k.trim().toLowerCase());
    const isApproved = approveKeywords.some(keyword => normalizedResponse.includes(keyword));
    
    // Check for rejection keywords
    const rejectKeywords = autoRejectKeywords.split(',').map(k => k.trim().toLowerCase());
    const isRejected = rejectKeywords.some(keyword => normalizedResponse.includes(keyword));
    
    return {
      approved: isApproved && !isRejected,
      rejected: isRejected && !isApproved,
      response: response,
      intent: isApproved ? 'approve' : isRejected ? 'reject' : 'clarify',
    };
  },

  /**
   * Execute the ask human tool
   * Implements ToolNodeInterface.executeTool()
   */
  async executeTool(args) {
    try {
      // Validate arguments
      if (!args.question || typeof args.question !== 'string') {
        return {
          success: false,
          error: 'Question parameter is required and must be a string',
        };
      }

      const question = args.question.trim();
      const context = args.context?.trim() || '';
      const options = args.options || [];

      this.logger?.info('[Ask Human Tool] Requesting human input', {
        question: question.substring(0, 100),
        hasContext: !!context,
        hasOptions: options.length > 0,
      });

      // Format the message to send to user
      let formattedMessage = `🤔 **Human Input Required**\n\n${question}`;
      
      if (context) {
        formattedMessage += `\n\n📋 **Context:** ${context}`;
      }
      
      if (options.length > 0) {
        formattedMessage += `\n\n**Options:**\n${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`;
      }
      
      formattedMessage += `\n\n_Please respond to continue..._`;

      // Return special status to pause execution
      // The AI Agent will detect this and handle the pause/resume
      return {
        success: true,
        requiresHumanInput: true,
        question: formattedMessage,
        originalQuestion: question,
        context,
        options,
        timestamp: Date.now(),
        // This signals to the agent that execution should pause
        _pauseExecution: true,
      };
    } catch (error) {
      this.logger?.error('[Ask Human Tool] Failed to request human input', {
        error: error.message,
      });

      return {
        success: false,
        error: `Failed to request human input: ${error.message}`,
      };
    }
  },

  /**
   * Execute method (required for node interface)
   * Service nodes don't execute directly - they're called by the AI Agent
   */
  execute: async function () {
    throw new Error(
      'Ask Human Tool is a service node and should not be executed directly. ' +
        'Connect it to an AI Agent node instead.'
    );
  },
};

module.exports = AskHumanToolNode;
