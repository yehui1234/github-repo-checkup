const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeProxyUrl, resolveProxyUrl } = require("../lib/http");

test("normalizeProxyUrl accepts v2rayN mixed proxy addresses", () => {
  assert.equal(normalizeProxyUrl("127.0.0.1:10808"), "http://127.0.0.1:10808/");
  assert.equal(normalizeProxyUrl("http://127.0.0.1:10808"), "http://127.0.0.1:10808/");
});

test("normalizeProxyUrl selects HTTPS proxy from Windows multi-value format", () => {
  assert.equal(
    normalizeProxyUrl("http=127.0.0.1:10809;https=127.0.0.1:10808"),
    "http://127.0.0.1:10808/"
  );
});

test("resolveProxyUrl allows an explicit empty value to disable proxy", () => {
  assert.equal(resolveProxyUrl(""), "");
});
