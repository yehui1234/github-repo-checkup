const { getDefaultFetch } = require("./http");

const PROVIDER_DEFAULTS = {
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", protocol: "openai" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini", protocol: "openai" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4.1-mini", protocol: "openai" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", protocol: "openai" },
  mistral: { baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest", protocol: "openai" },
  siliconflow: { baseUrl: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen3-8B", protocol: "openai" },
  dashscope: { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", protocol: "openai" },
  aliyun: { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", protocol: "openai" },
  ollama: { baseUrl: "http://127.0.0.1:11434/v1", model: "qwen3:8b", protocol: "openai" },
  compatible: { baseUrl: "http://127.0.0.1:8000/v1", model: "", protocol: "openai" },
  anthropic: { baseUrl: "https://api.anthropic.com", model: "", protocol: "anthropic" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com", model: "", protocol: "gemini" }
};

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function resolveAiConfig(overrides = {}) {
  const legacyKey = overrides.deepseekApiKey ?? process.env.DEEPSEEK_API_KEY;
  const provider = String(
    overrides.provider ||
    process.env.AI_PROVIDER ||
    (legacyKey ? "deepseek" : "")
  ).toLowerCase();
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.compatible;
  const dashscopeKey = ["dashscope", "aliyun"].includes(provider)
    ? process.env.DASHSCOPE_API_KEY
    : "";
  const apiKey = overrides.apiKey || process.env.AI_API_KEY || dashscopeKey || legacyKey || "";
  const baseUrl = trimSlash(overrides.baseUrl || process.env.AI_BASE_URL || defaults.baseUrl);
  const model = overrides.model || process.env.AI_MODEL || defaults.model;
  const protocol = overrides.protocol || process.env.AI_PROTOCOL || defaults.protocol;

  return {
    provider,
    apiKey,
    baseUrl,
    model,
    protocol,
    configured: Boolean(provider && model && (apiKey || ["ollama", "compatible"].includes(provider)))
  };
}

function extractText(body, protocol) {
  if (protocol === "anthropic") {
    return body.content?.find((item) => item.type === "text")?.text || "";
  }
  if (protocol === "gemini") {
    return body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  }
  return body.choices?.[0]?.message?.content || "";
}

async function requestAiJson(config, messages, fetchImpl = getDefaultFetch()) {
  if (!config.configured) throw new Error("AI provider is not configured");
  let url;
  let headers = { "Content-Type": "application/json" };
  let body;

  if (config.protocol === "anthropic") {
    url = `${config.baseUrl}/v1/messages`;
    headers = { ...headers, "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" };
    body = {
      model: config.model,
      max_tokens: 2200,
      temperature: 0.2,
      system: messages.find((item) => item.role === "system")?.content || "",
      messages: messages.filter((item) => item.role !== "system")
    };
  } else if (config.protocol === "gemini") {
    url = `${config.baseUrl}/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
    const system = messages.find((item) => item.role === "system")?.content || "";
    const user = messages.filter((item) => item.role !== "system").map((item) => item.content).join("\n");
    body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
    };
  } else {
    url = `${config.baseUrl}/chat/completions`;
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
    body = {
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages
    };
  }

  const response = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${config.provider} API ${response.status}: ${text.slice(0, 160)}`);
  }
  const responseBody = await response.json();
  return { text: extractText(responseBody, config.protocol), raw: responseBody };
}

module.exports = { PROVIDER_DEFAULTS, requestAiJson, resolveAiConfig };
