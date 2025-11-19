/**
 * Redis Connection Credentials
 * Used for connecting to Redis for persistent memory storage
 */
const RedisConnectionCredentials = {
  name: "redisConnection",
  displayName: "Redis Connection",
  documentationUrl: "https://redis.io/docs/connect/clients/",
  testable: true,
  properties: [
    {
      displayName: "Host",
      name: "host",
      type: "string",
      default: "localhost",
      required: true,
      placeholder: "localhost",
      description: "Redis server hostname or IP address",
    },
    {
      displayName: "Port",
      name: "port",
      type: "number",
      default: 6379,
      required: true,
      placeholder: "6379",
      description: "Redis server port",
    },
    {
      displayName: "Password",
      name: "password",
      type: "password",
      default: "",
      required: false,
      placeholder: "Optional password",
      description: "Redis authentication password (leave empty if not required)",
    },
    {
      displayName: "Database",
      name: "database",
      type: "number",
      default: 0,
      required: false,
      placeholder: "0",
      description: "Redis database number (0-15)",
    },
  ],

  /**
   * Test the Redis connection
   */
  async test(data) {
    if (!data.host) {
      return {
        success: false,
        message: "Host is required",
      };
    }

    if (!data.port) {
      return {
        success: false,
        message: "Port is required",
      };
    }

    // Validate port number
    const port = parseInt(data.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      return {
        success: false,
        message: "Port must be a valid number between 1 and 65535",
      };
    }

    // Validate database number
    const database = parseInt(data.database || 0);
    if (isNaN(database) || database < 0 || database > 15) {
      return {
        success: false,
        message: "Database must be a number between 0 and 15",
      };
    }

    try {
      // Dynamically import redis to avoid requiring it if not used
      const redis = require("redis");

      // Create Redis client
      const client = redis.createClient({
        socket: {
          host: data.host,
          port: port,
          connectTimeout: 5000,
        },
        password: data.password || undefined,
        database: database,
      });

      // Handle connection errors
      client.on("error", (err) => {
        // Error will be caught in the try-catch
      });

      // Connect to Redis
      await client.connect();

      // Test the connection with a PING command
      const pong = await client.ping();

      // Get server info
      const info = await client.info("server");
      const versionMatch = info.match(/redis_version:([^\r\n]+)/);
      const version = versionMatch ? versionMatch[1] : "unknown";

      // Close the connection
      await client.quit();

      return {
        success: true,
        message: `Connected successfully to Redis ${version} at ${data.host}:${port}`,
      };
    } catch (error) {
      // Handle specific Redis errors
      if (error.code === "ECONNREFUSED") {
        return {
          success: false,
          message: `Connection refused. Please check if Redis is running at ${data.host}:${port}`,
        };
      } else if (error.code === "ENOTFOUND") {
        return {
          success: false,
          message: `Host not found: ${data.host}`,
        };
      } else if (error.message?.includes("WRONGPASS")) {
        return {
          success: false,
          message: "Invalid password. Please check your credentials.",
        };
      } else if (error.message?.includes("NOAUTH")) {
        return {
          success: false,
          message: "Authentication required. Please provide a password.",
        };
      } else if (error.code === "ETIMEDOUT") {
        return {
          success: false,
          message: `Connection timeout. Please check if Redis is accessible at ${data.host}:${port}`,
        };
      } else {
        return {
          success: false,
          message: `Connection failed: ${error.message || "Unknown error"}`,
        };
      }
    }
  },
};

module.exports = RedisConnectionCredentials;
