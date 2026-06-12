const GITHUB_API = "https://api.github.com";
const { getDefaultFetch } = require("./http");

class AppError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
  }
}

function parseRepoUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new AppError("请输入 GitHub 仓库 URL", 400);

  let url;
  try {
    url = new URL(raw.match(/^https?:\/\//i) ? raw : `https://${raw}`);
  } catch {
    throw new AppError("仓库 URL 格式不正确", 400);
  }

  if (!["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) {
    throw new AppError("仅支持 github.com 的公开仓库", 400);
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) throw new AppError("URL 中缺少仓库所有者或仓库名", 400);

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  const safe = /^[A-Za-z0-9_.-]+$/;
  if (!safe.test(owner) || !safe.test(repo)) {
    throw new AppError("仓库所有者或仓库名包含非法字符", 400);
  }
  return { owner, repo };
}

function githubHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "github-repo-checkup"
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function requestGitHub(path, token, fetchImpl = getDefaultFetch()) {
  let response;
  try {
    response = await fetchImpl(`${GITHUB_API}${path}`, {
      headers: githubHeaders(token),
      signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    const timedOut = error.name === "TimeoutError" ||
      error.cause?.code === "UND_ERR_CONNECT_TIMEOUT";
    throw new AppError(
      timedOut
        ? "连接 GitHub API 超时，请检查网络或代理设置后重试"
        : "无法连接 GitHub API，请检查网络后重试",
      502
    );
  }
  if (!response.ok) {
    let data = {};
    try { data = await response.json(); } catch {}
    if (response.status === 404) {
      throw new AppError("未找到该公开仓库，请检查 URL 或仓库可见性", 404);
    }
    if (response.status === 403 || response.status === 429) {
      throw new AppError("GitHub API 请求额度已用完，请稍后重试或配置 GITHUB_TOKEN", 429);
    }
    throw new AppError(data.message || "GitHub 数据获取失败", response.status);
  }
  return response.json();
}

async function optionalRequest(path, token, fallback, fetchImpl) {
  try {
    return await requestGitHub(path, token, fetchImpl);
  } catch {
    return fallback;
  }
}

async function optionalExternalJson(url, fallback, fetchImpl) {
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json", "User-Agent": "github-repo-checkup" },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

function decodeReadme(readme) {
  if (!readme?.content || readme.encoding !== "base64") {
    return { text: "", length: 0, headings: [] };
  }
  const markdown = Buffer.from(readme.content.replace(/\s/g, ""), "base64").toString("utf8");
  const headings = [...markdown.matchAll(/^#{1,3}\s+(.+)$/gm)]
    .map((match) => match[1].replace(/[*_`[\]]/g, "").trim())
    .filter(Boolean)
    .slice(0, 20);
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { text: text.slice(0, 16000), length: markdown.length, headings };
}

function normalizeLanguages(languages) {
  const total = Object.values(languages).reduce((sum, value) => sum + value, 0);
  if (!total) return [];
  return Object.entries(languages)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percent: Number(((bytes / total) * 100).toFixed(1))
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

function daysSince(date) {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
}

async function analyzeRepository(input, options = {}) {
  const { owner, repo } = parseRepoUrl(input);
  const token = options.token || "";
  const fetchImpl = options.fetchImpl || getDefaultFetch();
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const repository = await requestGitHub(base, token, fetchImpl);
  const [languages, contributors, commits, releases, rootFiles, community, readme, workflows, scorecard] = await Promise.all([
    optionalRequest(`${base}/languages`, token, {}, fetchImpl),
    optionalRequest(`${base}/contributors?per_page=100&anon=1`, token, [], fetchImpl),
    optionalRequest(`${base}/commits?per_page=30`, token, [], fetchImpl),
    optionalRequest(`${base}/releases?per_page=10`, token, [], fetchImpl),
    optionalRequest(`${base}/contents`, token, [], fetchImpl),
    optionalRequest(`${base}/community/profile`, token, {}, fetchImpl),
    optionalRequest(`${base}/readme`, token, {}, fetchImpl),
    optionalRequest(`${base}/actions/workflows?per_page=1`, token, {}, fetchImpl),
    optionalExternalJson(
      `https://api.securityscorecards.dev/projects/github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      null,
      fetchImpl
    )
  ]);

  const files = Array.isArray(rootFiles) ? rootFiles.map((item) => item.name.toLowerCase()) : [];
  const commitDates = Array.isArray(commits)
    ? commits.map((item) => item.commit?.author?.date).filter(Boolean)
    : [];
  const recent90 = commitDates.filter((date) => daysSince(date) <= 90).length;

  return {
    repository: {
      owner: repository.owner?.login || owner,
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      description: repository.description || "暂无项目描述",
      avatar: repository.owner?.avatar_url || "",
      homepage: repository.homepage || "",
      createdAt: repository.created_at,
      updatedAt: repository.updated_at,
      pushedAt: repository.pushed_at,
      defaultBranch: repository.default_branch,
      license: repository.license?.spdx_id || "未声明",
      archived: Boolean(repository.archived),
      fork: Boolean(repository.fork),
      sizeKb: repository.size,
      topics: Array.isArray(repository.topics) ? repository.topics : [],
      visibility: repository.visibility || "public",
      hasWiki: Boolean(repository.has_wiki),
      hasDiscussions: Boolean(repository.has_discussions),
      latestRelease: Array.isArray(releases) && releases[0]
        ? {
            name: releases[0].name || releases[0].tag_name,
            tag: releases[0].tag_name,
            publishedAt: releases[0].published_at
          }
        : null
    },
    metrics: {
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      watchers: repository.subscribers_count,
      openIssues: repository.open_issues_count,
      contributors: Array.isArray(contributors) ? contributors.length : 0,
      contributorsCapped: Array.isArray(contributors) && contributors.length === 100,
      releases: Array.isArray(releases) ? releases.length : 0,
      commitsSampled: commitDates.length,
      commitsLast90Days: recent90,
      daysSincePush: daysSince(repository.pushed_at),
      ageDays: daysSince(repository.created_at)
    },
    languages: normalizeLanguages(languages),
    health: {
      healthPercentage: community.health_percentage || 0,
      hasReadme: Boolean(community.files?.readme || files.some((name) => name.startsWith("readme"))),
      hasLicense: Boolean(community.files?.license || repository.license),
      hasContributing: Boolean(community.files?.contributing || files.some((name) => name.startsWith("contributing"))),
      hasCodeOfConduct: Boolean(community.files?.code_of_conduct),
      hasIssueTemplate: Boolean(community.files?.issue_template || files.includes(".github")),
      hasPullRequestTemplate: Boolean(community.files?.pull_request_template),
      hasTests: files.some((name) => ["test", "tests", "__tests__", "spec"].includes(name)),
      hasCi: Number(workflows.total_count) > 0 || files.some((name) => name.includes("travis") || name.includes("circleci")),
      hasPackageManifest: files.some((name) =>
        ["package.json", "pyproject.toml", "requirements.txt", "cargo.toml", "go.mod", "pom.xml", "build.gradle"].includes(name)
      )
    },
    readme: decodeReadme(readme),
    security: {
      score: Number.isFinite(scorecard?.score) ? scorecard.score : null,
      date: scorecard?.date || null,
      checks: Array.isArray(scorecard?.checks)
        ? scorecard.checks.slice(0, 20).map((check) => ({
            name: check.name,
            score: check.score,
            reason: check.reason
          }))
        : []
    },
    recentCommits: Array.isArray(commits)
      ? commits.slice(0, 8).map((item) => ({
          sha: item.sha?.slice(0, 7),
          message: String(item.commit?.message || "").split("\n")[0].slice(0, 120),
          author: item.author?.login || item.commit?.author?.name || "Unknown",
          date: item.commit?.author?.date
        }))
      : []
  };
}

module.exports = { AppError, analyzeRepository, decodeReadme, parseRepoUrl, normalizeLanguages, daysSince };
