const $ = (selector) => document.querySelector(selector);
const form = $("#repo-form");
const button = $("#analyze-button");
const errorBox = $("#error");
const loading = $("#loading");
const report = $("#report");
const languageColors = ["#ff5c35", "#7957ff", "#3c8dff", "#83b735", "#f2b134", "#d44f9d", "#22a69a", "#77746d"];

const formatNumber = new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 });
const formatDate = (value) => value ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)) : "-";

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    $("#ai-status").textContent = data.aiConfigured
      ? `${data.ai.provider} / ${data.ai.model} 已就绪`
      : "AI 未配置 · 使用规则评分";
  } catch {
    $("#ai-status").textContent = "服务状态未知";
  }
}

function setLoading(active) {
  button.disabled = active;
  button.querySelector("span").textContent = active ? "分析中..." : "开始体检";
  loading.classList.toggle("hidden", !active);
  if (active) report.classList.add("hidden");
}

function renderList(selector, items) {
  $(selector).innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}

function renderMetrics(data) {
  const m = data.metrics;
  const items = [
    ["★", m.stars, "Stars"],
    ["⑂", m.forks, "Forks"],
    ["◉", m.watchers, "Watchers"],
    ["◇", m.openIssues, "Open issues"],
    ["◎", `${m.contributors}${m.contributorsCapped ? "+" : ""}`, "Contributors"],
    ["↻", m.daysSincePush === null ? "-" : `${m.daysSincePush}天`, "距上次推送"]
  ];
  $("#metrics-grid").innerHTML = items.map(([icon, value, label]) => `
    <div class="metric"><strong>${icon} ${typeof value === "number" ? formatNumber.format(value) : value}</strong><span>${label}</span></div>
  `).join("");
}

function renderDimensions(score) {
  const labels = { popularity: "影响力", maintenance: "维护活跃", community: "社区治理", engineering: "工程安全", documentation: "文档完备" };
  $("#methodology").textContent = score.methodology || "";
  $("#dimensions").innerHTML = Object.entries(score.dimensions).map(([key, value]) => {
    const detail = score.dimensionDetails?.[key];
    return `
      <div class="dimension">
        <span>${labels[key]}</span>
        <progress class="dimension-progress" aria-label="${labels[key]}" value="${Math.max(0, Math.min(100, value))}" max="100">${value}%</progress>
        <b>${value}</b>
        <small>权重 ${Math.round((detail?.weight || 0) * 100)}%</small>
      </div>
    `;
  }).join("");
}

function renderDimensionAnalysis(score) {
  const labels = { popularity: "影响力", maintenance: "维护活跃度", community: "社区治理", engineering: "工程与安全", documentation: "文档完备度" };
  $("#dimension-analysis").innerHTML = Object.entries(score.dimensionDetails || {}).map(([key, detail]) => {
    const analysis = score.dimensionAnalysis?.[key] || {};
    const evidence = (detail.evidence || []).map((entry) =>
      `<span class="evidence-chip">${escapeHtml(entry.label)} · ${escapeHtml(entry.value)}</span>`
    ).join("");
    return `
      <section class="dimension-diagnosis">
        <div class="diagnosis-accent diagnosis-${key}"></div>
        <div class="diagnosis-head">
          <div><span class="diagnosis-index">0${Object.keys(score.dimensionDetails).indexOf(key) + 1}</span><h3>${labels[key]}</h3></div>
          <div class="diagnosis-score"><strong>${detail.score}</strong><span>/100</span></div>
        </div>
        <progress class="diagnosis-progress diagnosis-${key}" value="${detail.score}" max="100">${detail.score}%</progress>
        <p>${escapeHtml(analysis.conclusion || "")}</p>
        <div class="evidence-list">${evidence}</div>
        <p class="dimension-action"><b>建议：</b>${escapeHtml(analysis.action || "")}</p>
        <small><span>参考</span>${escapeHtml(detail.standard || "")}</small>
      </section>
    `;
  }).join("");
}

function formatSize(kb) {
  if (!Number.isFinite(kb)) return "-";
  return kb >= 1024 ? `${(kb / 1024).toFixed(kb >= 10240 ? 0 : 1)} MB` : `${kb} KB`;
}

function renderOverview(score, data) {
  const overview = score.projectOverview || {};
  $("#overview-summary").textContent = overview.summary || "暂无项目概述";
  $("#overview-positioning").textContent = overview.positioning || "";
  $("#project-type").textContent = overview.projectType || "开源项目";
  $("#project-maturity").textContent = overview.maturity || "待评估";
  renderList("#core-features", overview.coreFeatures || []);
  renderList("#tech-highlights", overview.techHighlights || []);
  renderList("#target-users", overview.targetUsers || []);
  renderList("#use-cases", overview.useCases || []);
  const repo = data.repository;
  const facts = [
    ["主语言", data.languages[0]?.name || "未知"],
    ["许可证", repo.license],
    ["默认分支", repo.defaultBranch],
    ["仓库规模", formatSize(repo.sizeKb)],
    ["项目年龄", data.metrics.ageDays === null ? "未知" : `${Math.max(1, Math.round(data.metrics.ageDays / 30))} 个月`],
    ["最近发布", repo.latestRelease?.tag || "暂无 Release"]
  ];
  $("#repo-facts").innerHTML = facts.map(([label, value], index) => `
    <div class="repo-fact">
      <span>0${index + 1}</span>
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
  const topics = [...new Set([
    ...(repo.topics || []),
    ...data.languages.slice(0, 4).map((item) => item.name),
    ...(overview.techHighlights || []).slice(0, 4)
  ])].slice(0, 10);
  $("#topic-list").innerHTML = topics.length
    ? topics.map((topic, index) => `<span class="topic-chip topic-${index % 4}">${escapeHtml(topic)}</span>`).join("")
    : '<span class="topic-chip">暂无标签</span>';
  $("#overview-source").textContent = score.source === "ai"
    ? `${String(score.provider).toUpperCase()} / ${score.model}`
    : "README + RULES";
}

function renderLanguages(languages) {
  $("#language-count").textContent = languages.length;
  if (!languages.length) {
    $("#language-donut").style.background = "#ddd";
    $("#language-list").innerHTML = '<div class="language-item"><span></span><span>暂无语言数据</span><b>-</b></div>';
    return;
  }
  let cursor = 0;
  const segments = languages.slice(0, 8).map((lang, index) => {
    const start = cursor;
    cursor += lang.percent;
    return `${languageColors[index]} ${start}% ${cursor}%`;
  });
  if (cursor < 100) segments.push(`#b9b6ae ${cursor}% 100%`);
  $("#language-donut").style.background = `conic-gradient(${segments.join(",")})`;
  $("#language-list").innerHTML = languages.slice(0, 6).map((lang, index) => `
    <div class="language-item"><i style="background:${languageColors[index]}"></i><span>${escapeHtml(lang.name)}</span><b>${lang.percent}%</b></div>
  `).join("");
}

function renderCommits(commits) {
  $("#commit-list").innerHTML = commits.length ? commits.slice(0, 6).map((commit) => `
    <div class="commit"><code>${escapeHtml(commit.sha)}</code><p title="${escapeHtml(commit.message)}">${escapeHtml(commit.message)}</p><time>${formatDate(commit.date)}</time></div>
  `).join("") : '<p class="score-summary">暂无可用的提交记录</p>';
}

function renderHealth(health) {
  const labels = {
    hasReadme: "README 文档", hasLicense: "开源许可证", hasContributing: "贡献指南",
    hasCodeOfConduct: "行为准则", hasIssueTemplate: "Issue 模板",
    hasPullRequestTemplate: "PR 模板", hasTests: "测试目录", hasCi: "持续集成",
    hasPackageManifest: "依赖清单"
  };
  $("#health-list").innerHTML = Object.entries(labels).map(([key, label]) => `
    <div class="health-item"><span>${label}</span><span class="health-state ${health[key] ? "yes" : "no"}">${health[key] ? "✓" : "−"}</span></div>
  `).join("");
}

function renderReport(data) {
  const r = data.repository;
  $("#repo-avatar").src = r.avatar;
  $("#repo-avatar").alt = `${r.owner} avatar`;
  $("#repo-owner").textContent = r.owner;
  $("#repo-name").textContent = r.name;
  $("#repo-description").textContent = r.description;
  $("#github-link").href = r.url;
  $("#generated-date").textContent = formatDate(data.generatedAt);

  $("#score-number").textContent = data.score.score;
  $("#score-grade").textContent = data.score.grade;
  $("#score-verdict").textContent = data.score.verdict;
  $("#score-summary").textContent = data.score.summary;
  $("#score-source").textContent = data.score.source === "ai"
    ? `${String(data.score.provider).toUpperCase()} · ${data.score.model}`
    : "RULE ENGINE";
  $("#score-ring").style.setProperty("--score", data.score.score);

  renderMetrics(data);
  renderOverview(data.score, data);
  renderDimensions(data.score);
  renderDimensionAnalysis(data.score);
  renderLanguages(data.languages);
  renderList("#strengths", data.score.strengths);
  renderList("#risks", data.score.risks);
  renderList("#suggestions", data.score.suggestions);
  renderCommits(data.recentCommits);
  renderHealth(data.health);

  report.classList.remove("hidden");
  setTimeout(() => report.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.textContent = "";
  setLoading(true);
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: $("#repo-url").value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "分析失败");
    renderReport(data);
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    setLoading(false);
  }
});

checkHealth();
