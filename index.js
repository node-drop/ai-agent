// Export the node definitions
module.exports = {
  nodes: {
    "aiAgent": require("./nodes/AIAgent.node.js"),
    "openaiModel": require("./nodes/OpenAIModel.node.js"),
    "anthropicModel": require("./nodes/AnthropicModel.node.js"),
    "bufferMemory": require("./nodes/BufferMemory.node.js"),
    "windowMemory": require("./nodes/WindowMemory.node.js"),
    "redisMemory": require("./nodes/RedisMemory.node.js"),
    "calculatorTool": require("./nodes/CalculatorTool.node.js"),
    "httpRequestTool": require("./nodes/HttpRequestTool.node.js"),
    "knowledgeBaseTool": require("./nodes/KnowledgeBaseTool.node.js"),
    "askHumanTool": require("./nodes/AskHumanTool.node.js"),
  },
  credentials: {
    "openaiApi": require("./credentials/OpenAIApi.credentials.js"),
    "anthropicApi": require("./credentials/AnthropicApi.credentials.js"),
    "redisConnection": require("./credentials/RedisConnection.credentials.js"),
  },
};
