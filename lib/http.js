const { execFileSync } = require("node:child_process");
const { fetch: undiciFetch, ProxyAgent } = require("undici");

let defaultClient;
let defaultProxyUrl;

function normalizeProxyUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  let selected = raw;
  if (raw.includes(";")) {
    const entries = Object.fromEntries(
      raw.split(";")
        .map((entry) => entry.trim().split("=", 2))
        .filter(([key, target]) => key && target)
        .map(([key, target]) => [key.toLowerCase(), target])
    );
    selected = entries.https || entries.http || entries.socks || "";
  } else if (/^(https?|socks)=/i.test(raw)) {
    selected = raw.replace(/^[^=]+=/, "");
  }

  if (!selected) return "";
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(selected)) {
    selected = `http://${selected}`;
  }

  try {
    const parsed = new URL(selected);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function queryWindowsProxy() {
  if (process.platform !== "win32") return "";
  const key = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
  try {
    const enabledOutput = execFileSync("reg.exe", ["query", key, "/v", "ProxyEnable"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 2000
    });
    if (!/ProxyEnable\s+REG_DWORD\s+0x1/i.test(enabledOutput)) return "";

    const serverOutput = execFileSync("reg.exe", ["query", key, "/v", "ProxyServer"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 2000
    });
    const match = serverOutput.match(/ProxyServer\s+REG_SZ\s+(.+)\s*$/im);
    return normalizeProxyUrl(match?.[1]);
  } catch {
    return "";
  }
}

function resolveProxyUrl(explicitProxy) {
  if (explicitProxy !== undefined) return normalizeProxyUrl(explicitProxy);
  return normalizeProxyUrl(
    process.env.PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY
  ) || queryWindowsProxy();
}

function createFetch(proxyUrl) {
  const resolvedProxy = resolveProxyUrl(proxyUrl);
  const dispatcher = resolvedProxy ? new ProxyAgent(resolvedProxy) : null;
  const client = (url, options = {}) => undiciFetch(url, {
    ...options,
    ...(dispatcher ? { dispatcher } : {})
  });
  client.proxyUrl = resolvedProxy;
  return client;
}

function getDefaultFetch() {
  if (!defaultClient) {
    defaultClient = createFetch();
    defaultProxyUrl = defaultClient.proxyUrl;
  }
  return defaultClient;
}

function getProxyInfo(proxyUrl) {
  const resolved = proxyUrl !== undefined ? resolveProxyUrl(proxyUrl) : (defaultProxyUrl ?? resolveProxyUrl());
  if (!resolved) return { configured: false, address: "" };
  const parsed = new URL(resolved);
  return {
    configured: true,
    address: `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`
  };
}

module.exports = {
  createFetch,
  getDefaultFetch,
  getProxyInfo,
  normalizeProxyUrl,
  queryWindowsProxy,
  resolveProxyUrl
};
