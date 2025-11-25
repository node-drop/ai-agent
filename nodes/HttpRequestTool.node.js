/**
 * HTTP Request Tool Node
 * 
 * Makes HTTP requests to external APIs for the AI Agent.
 * Connect this node to the AI Agent's 'tools' input to enable HTTP request capabilities.
 * 
 * Features:
 * - Support for GET, POST, PUT, DELETE, PATCH methods
 * - Optional authentication (Basic, Bearer, API Key, Header)
 * - Custom headers and request body
 * - Security validation to prevent SSRF attacks
 * - Configurable timeout and redirect handling
 * - Structured response with status, headers, and body
 */

const { ToolNodeInterface } = require('../utils/interfaces');
const { validateUrl } = require('../utils/urlSecurityValidator');

const HttpRequestToolNode = {
  identifier: 'http-request-tool',
  nodeCategory: 'tool', // Indicates this is a tool node (not directly executable)
  displayName: 'HTTP Tool',
  name: 'http-request-tool',
  group: ['ai', 'tool'],
  version: 1,
  description: 'Make HTTP requests to external APIs (service node for AI Agent)',
  icon: 'fa:globe',
  color: '#2196F3',
  defaults: {
    name: 'HTTP Request Tool',
  },
  inputs: [],
  outputs: ['toolService'], // Output to connect to AI Agent's tools input
  properties: [
    {
      displayName: 'Authentication',
      name: 'authentication',
      type: 'credential',
      required: false,
      default: '',
      description: 'Optional authentication for HTTP requests',
      placeholder: 'None',
      allowedTypes: ['httpBasicAuth', 'httpHeaderAuth', 'httpBearerAuth', 'apiKey'],
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      description: 'HTTP request configuration',
      options: [
        {
          name: 'timeout',
          displayName: 'Timeout (ms)',
          type: 'number',
          default: 30000,
          description: 'Request timeout in milliseconds',
          placeholder: '30000',
          typeOptions: {
            minValue: 1000,
            maxValue: 300000,
          },
        },
        {
          name: 'followRedirects',
          displayName: 'Follow Redirects',
          type: 'boolean',
          default: true,
          description: 'Whether to follow HTTP redirects',
        },
        {
          name: 'maxRedirects',
          displayName: 'Max Redirects',
          type: 'number',
          default: 5,
          description: 'Maximum number of redirects to follow',
          typeOptions: {
            minValue: 0,
            maxValue: 20,
          },
        },
      ],
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
      name: 'http_request',
      description: 'Make HTTP requests to external APIs. Supports GET, POST, PUT, DELETE, PATCH methods. Can include custom headers and request body.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to make the request to (must be http or https)',
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            description: 'HTTP method to use',
          },
          headers: {
            type: 'object',
            description: 'Optional headers to include in the request (e.g., {"Content-Type": "application/json"})',
          },
          body: {
            type: 'object',
            description: 'Optional request body for POST/PUT/PATCH requests (will be JSON stringified)',
          },
        },
        required: ['url', 'method'],
      },
    };
  },

  /**
   * Apply authentication to request headers
   * @private
   * @param {Object} headers - Existing headers object
   * @param {Object} credentials - Authentication credentials
   * @returns {Object} Headers with authentication applied
   */
  _applyAuthentication: async function(headers, credentials) {
    if (!credentials) {
      return headers;
    }

    const authHeaders = { ...headers };

    // Handle different authentication types
    if (credentials.type === 'httpBasicAuth') {
      const token = Buffer.from(`${credentials.user}:${credentials.password}`).toString('base64');
      authHeaders['Authorization'] = `Basic ${token}`;
    } else if (credentials.type === 'httpBearerAuth') {
      authHeaders['Authorization'] = `Bearer ${credentials.token}`;
    } else if (credentials.type === 'httpHeaderAuth') {
      authHeaders[credentials.name] = credentials.value;
    } else if (credentials.type === 'apiKey') {
      if (credentials.placement === 'header') {
        authHeaders[credentials.name] = credentials.value;
      }
      // Note: Query parameter placement would be handled in URL construction
    }

    return authHeaders;
  },

  /**
   * Execute the HTTP request tool
   * Implements ToolNodeInterface.execute()
   * 
   * @param {Object} args - Tool arguments
   * @param {string} args.url - URL to request
   * @param {string} args.method - HTTP method
   * @param {Object} [args.headers] - Optional headers
   * @param {Object} [args.body] - Optional request body
   * @returns {Promise<Object>} Tool result with success status and data/error
   */
  async executeTool(args) {
    try {
      // Validate required parameters
      if (!args.url || typeof args.url !== 'string') {
        return {
          success: false,
          error: 'URL parameter is required and must be a string',
        };
      }

      if (!args.method || typeof args.method !== 'string') {
        return {
          success: false,
          error: 'Method parameter is required and must be a string',
        };
      }

      const method = args.method.toUpperCase();
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      if (!validMethods.includes(method)) {
        return {
          success: false,
          error: `Invalid method '${method}'. Must be one of: ${validMethods.join(', ')}`,
        };
      }

      // Security validation
      const validation = validateUrl(args.url);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Security validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Get options
      const options = (await this.getNodeParameter('options')) || {};
      const timeout = options.timeout || 30000;
      const followRedirects = options.followRedirects !== false;
      const maxRedirects = options.maxRedirects || 5;

      // Prepare headers
      let headers = args.headers || {};
      
      // Apply authentication if configured
      try {
        const credentials = await this.getCredentials('authentication');
        headers = await this._applyAuthentication(headers, credentials);
      } catch (error) {
        // No credentials configured, continue without authentication
      }

      // Prepare request options
      const fetchOptions = {
        method,
        headers,
        redirect: followRedirects ? 'follow' : 'manual',
      };

      // Add body for methods that support it
      if (['POST', 'PUT', 'PATCH'].includes(method) && args.body) {
        // Set Content-Type if not already set
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
        }
        fetchOptions.body = JSON.stringify(args.body);
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      fetchOptions.signal = controller.signal;

      this.logger?.info('[HTTP Request Tool] Making request', {
        url: args.url,
        method,
        hasAuth: !!fetchOptions.headers['Authorization'],
        hasBody: !!fetchOptions.body,
      });

      // Make the request
      const response = await fetch(args.url, fetchOptions);
      clearTimeout(timeoutId);

      // Get response body
      const contentType = response.headers.get('content-type') || '';
      let responseBody;
      
      if (contentType.includes('application/json')) {
        try {
          responseBody = await response.json();
        } catch (error) {
          responseBody = await response.text();
        }
      } else {
        responseBody = await response.text();
      }

      // Convert headers to plain object
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      this.logger?.info('[HTTP Request Tool] Request completed', {
        url: args.url,
        status: response.status,
        statusText: response.statusText,
      });

      return {
        success: true,
        data: {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseBody,
        },
      };
    } catch (error) {
      this.logger?.error('[HTTP Request Tool] Request failed', {
        url: args.url,
        error: error.message,
      });

      // Handle specific error types
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout exceeded',
        };
      } else if (error.code === 'ENOTFOUND') {
        return {
          success: false,
          error: `DNS lookup failed: ${args.url}`,
        };
      } else if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: `Connection refused: ${args.url}`,
        };
      } else {
        return {
          success: false,
          error: `HTTP request failed: ${error.message}`,
        };
      }
    }
  },

  /**
   * Execute method (required for node interface)
   * Service nodes don't execute directly - they're called by the AI Agent
   */
  execute: async function () {
    throw new Error(
      'HTTP Request Tool is a service node and should not be executed directly. ' +
        'Connect it to an AI Agent node instead.'
    );
  },
};

module.exports = HttpRequestToolNode;
