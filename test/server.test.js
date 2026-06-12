const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("../server");
const { createMockFetch } = require("./fixtures");

async function withServer(callback) {
  const server = createServer({
    fetchImpl: createMockFetch(),
    deepseekApiKey: "test-key"
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET /api/health reports AI configuration", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.aiConfigured, true);
  });
});

test("POST /api/analyze returns a complete report for the requested repository", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://github.com/jerry-ai-dev/MODULAR-RAG-MCP-SERVER" })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.repository.fullName, "jerry-ai-dev/MODULAR-RAG-MCP-SERVER");
    assert.equal(body.score.source, "ai");
    assert.equal(body.score.provider, "deepseek");
    assert.ok(body.score.score >= 0 && body.score.score <= 100);
    assert.equal(Object.keys(body.score.dimensionAnalysis).length, 5);
    assert.ok(body.score.projectOverview.coreFeatures.length > 0);
    assert.ok(body.score.projectOverview.techHighlights.length > 0);
    assert.ok(body.score.projectOverview.positioning.length > 0);
    assert.ok(body.repository.latestRelease.tag);
    assert.equal(body.languages[0].name, "Python");
    assert.equal(body.recentCommits.length, 8);
  });
});

test("POST /api/analyze rejects non-GitHub URLs", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/owner/repo" })
    });
    assert.equal(response.status, 400);
  });
});
