const test = require("node:test");
const assert = require("node:assert/strict");
const { requestAiJson, resolveAiConfig } = require("../lib/ai");

test("DashScope provider uses Alibaba Cloud OpenAI-compatible defaults", () => {
  const config = resolveAiConfig({ provider: "dashscope", apiKey: "test-key" });
  assert.equal(config.baseUrl, "https://dashscope.aliyuncs.com/compatible-mode/v1");
  assert.equal(config.model, "qwen-plus");
  assert.equal(config.protocol, "openai");
  assert.equal(config.configured, true);
});

test("aliyun is an alias of the DashScope provider defaults", () => {
  const config = resolveAiConfig({ provider: "aliyun", apiKey: "test-key" });
  assert.equal(config.baseUrl, "https://dashscope.aliyuncs.com/compatible-mode/v1");
  assert.equal(config.model, "qwen-plus");
});

test("DashScope request uses the compatible chat completions contract", async () => {
  const config = resolveAiConfig({ provider: "dashscope", apiKey: "dashscope-test-key" });
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }]
      })
    };
  };
  const result = await requestAiJson(config, [{ role: "user", content: "test" }], fetchImpl);
  const body = JSON.parse(captured.options.body);
  assert.equal(captured.url, "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions");
  assert.equal(captured.options.headers.Authorization, "Bearer dashscope-test-key");
  assert.equal(body.model, "qwen-plus");
  assert.equal(result.text, '{"ok":true}');
});
