/**
 * OpenAI API Credentials
 * Used for authenticating with OpenAI's API for GPT models
 */
const OpenAIApiCredentials = {
  name: "apiKey",
  displayName: "OpenAI API",
  documentationUrl: "https://platform.openai.com/docs/api-reference/authentication",
  testable: true,
  properties: [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "password",
      default: "",
      required: true,
      placeholder: "sk-proj-...",
      description: "Your OpenAI API key from https://platform.openai.com/api-keys",
    },
  ],

  /**
   * Test the OpenAI API connection
   */
  async test(data) {
    if (!data.apiKey) {
      return {
        success: false,
        message: "API key is required",
      };
    }

    // Validate API key format
    if (!data.apiKey.startsWith("sk-")) {
      return {
        success: false,
        message: "Invalid API key format. OpenAI API keys should start with 'sk-'",
      };
    }

    try {
      // Test the connection by making a simple API call
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${data.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const models = await response.json();
        return {
          success: true,
          message: `Connected successfully. ${models.data?.length || 0} models available.`,
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

module.exports = OpenAIApiCredentials;
