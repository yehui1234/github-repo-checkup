const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRepoUrl, normalizeLanguages } = require("../lib/github");

test("parseRepoUrl accepts common GitHub repository URLs", () => {
  assert.deepEqual(parseRepoUrl("https://github.com/jerry-ai-dev/MODULAR-RAG-MCP-SERVER"), {
    owner: "jerry-ai-dev",
    repo: "MODULAR-RAG-MCP-SERVER"
  });
  assert.deepEqual(parseRepoUrl("github.com/openai/openai-node.git"), {
    owner: "openai",
    repo: "openai-node"
  });
});

test("parseRepoUrl rejects unsupported hosts and incomplete URLs", () => {
  assert.throws(() => parseRepoUrl("https://gitlab.com/a/b"), /仅支持/);
  assert.throws(() => parseRepoUrl("https://github.com/a"), /缺少/);
});

test("normalizeLanguages calculates sorted percentages", () => {
  const result = normalizeLanguages({ JavaScript: 750, CSS: 250 });
  assert.equal(result[0].name, "JavaScript");
  assert.equal(result[0].percent, 75);
  assert.equal(result[1].percent, 25);
});
