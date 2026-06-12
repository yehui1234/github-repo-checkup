const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicDir = path.join(__dirname, "..", "public");
const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
const script = fs.readFileSync(path.join(publicDir, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(publicDir, "styles.css"), "utf8");

test("every ID selected by the frontend script exists in the page", () => {
  const selectedIds = [...script.matchAll(/\$\("#([^"]+)"\)/g)].map((match) => match[1]);
  const uniqueIds = [...new Set(selectedIds)];
  assert.ok(uniqueIds.length >= 20);
  for (const id of uniqueIds) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `Missing #${id} in index.html`);
  }
});

test("page has responsive rules and no inline executable script", () => {
  assert.match(styles, /@media\s*\(max-width:\s*800px\)/);
  assert.match(styles, /@media\s*\(max-width:\s*520px\)/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
});

test("report includes all required visualization sections", () => {
  for (const id of [
    "metrics-grid", "dimensions", "dimension-analysis", "overview-summary",
    "overview-positioning", "project-type", "project-maturity", "repo-facts",
    "topic-list", "core-features", "tech-highlights", "language-donut",
    "strengths", "risks", "suggestions"
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("dimension bars use native progress values under strict CSP", () => {
  assert.match(script, /<progress class="dimension-progress"/);
  assert.match(script, /value="\$\{Math\.max/);
  assert.match(styles, /\.dimension-progress::\-webkit-progress-value/);
  assert.doesNotMatch(styles, /\.bar i/);
});
