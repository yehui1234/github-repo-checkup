const test = require("node:test");
const assert = require("node:assert/strict");
const { deterministicScore, getAiReview, gradeFor, parseAiJson } = require("../lib/scoring");

const fixture = {
  repository: {
    fullName: "owner/repo", description: "A useful project", homepage: "",
    license: "MIT", archived: false, topics: ["rag"]
  },
  metrics: {
    stars: 1200, forks: 180, watchers: 30, contributors: 12, releases: 3,
    commitsLast90Days: 9, daysSincePush: 3
  },
  health: {
    healthPercentage: 80, hasReadme: true, hasLicense: true, hasContributing: true,
    hasCodeOfConduct: false, hasIssueTemplate: true, hasPullRequestTemplate: false,
    hasTests: true, hasCi: true, hasPackageManifest: true
  },
  languages: [{ name: "TypeScript", percent: 90 }, { name: "JavaScript", percent: 10 }],
  readme: { length: 9000, headings: ["Features", "Install"], text: "Useful project documentation." },
  security: { score: 7.2, checks: [] }
};

test("deterministicScore returns bounded dimensions and total", () => {
  const score = deterministicScore(fixture);
  assert.ok(score.total >= 0 && score.total <= 100);
  Object.values(score.dimensions).forEach((value) => assert.ok(value >= 0 && value <= 100));
  assert.equal(Object.keys(score.details).length, 5);
  assert.equal(score.methodology, "RepoScope 2026.1");
});

test("gradeFor maps score bands", () => {
  assert.equal(gradeFor(91), "S");
  assert.equal(gradeFor(82), "A");
  assert.equal(gradeFor(50), "D");
});

test("parseAiJson handles fenced JSON", () => {
  assert.deepEqual(parseAiJson('```json\n{"score":80}\n```'), { score: 80 });
});

test("getAiReview falls back without an API key", async () => {
  const review = await getAiReview(fixture, "");
  assert.equal(review.source, "rules");
  assert.ok(review.summary.length > 0);
  assert.equal(Object.keys(review.dimensionAnalysis).length, 5);
});
