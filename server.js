require("dotenv").config();

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { AppError, analyzeRepository } = require("./lib/github");
const { deterministicScore, getAiReview } = require("./lib/scoring");
const { createFetch, getProxyInfo } = require("./lib/http");
const { resolveAiConfig } = require("./lib/ai");

const PUBLIC_DIR = path.join(__dirname, "public");
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' https://avatars.githubusercontent.com data:; style-src 'self'; script-src 'self'; connect-src 'self'"
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new AppError("请求内容过大", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new AppError("请求 JSON 格式不正确", 400);
  }
}

async function serveStatic(request, response) {
  const requestPath = new URL(request.url, "http://localhost").pathname;
  const relative = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const filePath = path.resolve(PUBLIC_DIR, relative);
  const pathFromPublic = path.relative(PUBLIC_DIR, filePath);
  if (pathFromPublic.startsWith("..") || path.isAbsolute(pathFromPublic)) {
    throw new AppError("禁止访问", 403);
  }
  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' https://avatars.githubusercontent.com data:; style-src 'self'; script-src 'self'; connect-src 'self'"
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") throw new AppError("页面不存在", 404);
    throw error;
  }
}

function createServer(options = {}) {
  const fetchImpl = options.fetchImpl || createFetch(options.proxyUrl);
  const proxyInfo = options.fetchImpl
    ? { configured: false, address: "custom fetch" }
    : getProxyInfo(options.proxyUrl);
  const aiConfig = resolveAiConfig(options.ai || {
    deepseekApiKey: options.deepseekApiKey
  });

  return http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (request.method === "GET" && pathname === "/api/health") {
        return sendJson(response, 200, {
          ok: true,
          aiConfigured: aiConfig.configured,
          ai: {
            provider: aiConfig.provider || null,
            model: aiConfig.model || null
          },
          proxy: proxyInfo
        });
      }
      if (request.method === "POST" && pathname === "/api/analyze") {
        const body = await readJson(request);
        const data = await analyzeRepository(body.url, {
          token: options.githubToken ?? process.env.GITHUB_TOKEN,
          fetchImpl
        });
        const baseline = deterministicScore(data);
        const review = await getAiReview(
          data,
          aiConfig,
          fetchImpl
        );
        return sendJson(response, 200, {
          ...data,
          score: {
            ...review,
            dimensions: baseline.dimensions,
            dimensionDetails: baseline.details,
            methodology: baseline.methodology
          },
          generatedAt: new Date().toISOString()
        });
      }
      if (request.method === "GET" || request.method === "HEAD") {
        return await serveStatic(request, response);
      }
      throw new AppError("不支持的请求方法", 405);
    } catch (error) {
      const status = error instanceof AppError ? error.status : 500;
      if (status === 500) console.error(error);
      sendJson(response, status, {
        error: error.message || "服务器内部错误",
        details: error.details || undefined
      });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const proxy = getProxyInfo();
  createServer().listen(port, "127.0.0.1", () => {
    console.log(`GitHub Repo Checkup running at http://127.0.0.1:${port}`);
    console.log(proxy.configured ? `Proxy enabled: ${proxy.address}` : "Proxy disabled: direct connection");
  });
}

module.exports = { createServer, readJson };
