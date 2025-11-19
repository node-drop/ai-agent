/**
 * Anthropic API Credentials
 * Used for authenticating with Anthropic's API for Claude models
 */
const AnthropicApiCredentials = {
  name: "anthropicApi",
  displayName: "Anthropic API",
  documentationUrl: "https://docs.anthropic.com/claude/reference/getting-started-with-the-api",
  testable: true,
  properties: [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "password",
      default: "",
      required: true,
      placeholder: "sk-ant-...",
      description: "Your Anthropic API key from https://console.anthropic.com/",
    },
  ],

  /**
   * Test the Anthropic API connection
   */
  async test(data) {
    if (!data.apiKey) {
      return {
        success: false,
        message: "API key is required",
      };
    }

    // Validate API key format
    if (!data.apiKey.startsWith("sk-ant-")) {
      return {
        success: false,
        message: "Invalid API key format. Anthropic API keys should start with 'sk-ant-'",
      };
    }

    try {
      // Test the connection by making a simple API call
      // Using a minimal message to test authentication
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": data.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1,
          messages: [
            {
              role: "user",
              content: "Hi",
            },
          ],
        }),
      });

      if (response.ok) {
        return {
          success: true,
          message: "Connected successfully to Anthropic API.",
        };
      } else if (response.status === 401) {
        return {
          success: false,
          message: "Invalid API key. Please check your credentials.",
        };
      } else if (response.status === 429) {
        return {
          success: false,
          message: "Rate limit exceeded. Please try again later.",
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: `Connection failed: ${errorData.error?.message || response.statusText}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error.message || "Unknown error"}`,
      };
    }
  },
};

module.exports = AnthropicApiCredentials;
