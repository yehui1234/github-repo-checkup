const { requestAiJson, resolveAiConfig } = require("./ai");
const { getDefaultFetch } = require("./http");

const DIMENSIONS = {
  popularity: { label: "影响力", weight: 0.15, standard: "CHAOSS: Popularity / Community Growth" },
  maintenance: { label: "维护活跃度", weight: 0.25, standard: "CHAOSS: Change Requests / Time & Activity" },
  community: { label: "社区治理", weight: 0.20, standard: "GitHub Community Profile + CHAOSS Contributors" },
  engineering: { label: "工程与安全", weight: 0.25, standard: "OpenSSF Scorecard inspired" },
  documentation: { label: "文档完备度", weight: 0.15, standard: "GitHub Community Profile" }
};

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}

function logScore(value, target) {
  if (value <= 0) return 0;
  return clamp((Math.log10(value + 1) / Math.log10(target + 1)) * 100);
}

function activityScore(days) {
  if (days === null) return 20;
  if (days <= 7) return 100;
  if (days <= 30) return 90;
  if (days <= 90) return 75;
  if (days <= 180) return 58;
  if (days <= 365) return 38;
  if (days <= 730) return 22;
  return 8;
}

function item(label, value, contribution) {
  return { label, value: String(value), contribution: clamp(contribution) };
}

function deterministicScore(data) {
  const { metrics: m, health: h, repository: r } = data;
  const popularity = clamp(
    logScore(m.stars, 10000) * 0.55 +
    logScore(m.forks, 2000) * 0.30 +
    logScore(m.watchers, 500) * 0.15
  );

  let maintenance = clamp(
    activityScore(m.daysSincePush) * 0.70 +
    Math.min(m.commitsLast90Days * 5, 100) * 0.20 +
    Math.min(m.releases * 20, 100) * 0.10
  );
  if (r.archived) maintenance = Math.min(maintenance, 15);

  const communityChecks = [
    h.hasContributing, h.hasCodeOfConduct, h.hasIssueTemplate, h.hasPullRequestTemplate
  ];
  const community = clamp(
    communityChecks.filter(Boolean).length / communityChecks.length * 65 +
    Math.min(m.contributors, 10) / 10 * 25 +
    (h.healthPercentage || 0) * 0.10
  );

  const engineeringChecks = [h.hasTests, h.hasCi, h.hasPackageManifest, h.hasLicense];
  const localEngineering = engineeringChecks.filter(Boolean).length / engineeringChecks.length * 100;
  const scorecardAvailable = Number.isFinite(data.security?.score);
  const engineering = clamp(scorecardAvailable
    ? localEngineering * 0.65 + data.security.score * 10 * 0.35
    : localEngineering
  );

  const readmeQuality = Math.min((data.readme?.length || 0) / 8000, 1) * 20 +
    Math.min((data.readme?.headings?.length || 0) / 8, 1) * 10;
  const documentation = clamp(
    (h.hasReadme ? 40 : 0) +
    (r.description && r.description !== "暂无项目描述" ? 15 : 0) +
    (r.homepage ? 10 : 0) +
    readmeQuality +
    (h.hasLicense ? 5 : 0)
  );

  const values = { popularity, maintenance, community, engineering, documentation };
  const details = {
    popularity: {
      ...DIMENSIONS.popularity, score: popularity,
      evidence: [
        item("Stars", m.stars, logScore(m.stars, 10000)),
        item("Forks", m.forks, logScore(m.forks, 2000)),
        item("Watchers", m.watchers, logScore(m.watchers, 500))
      ]
    },
    maintenance: {
      ...DIMENSIONS.maintenance, score: maintenance,
      evidence: [
        item("距上次推送", m.daysSincePush === null ? "未知" : `${m.daysSincePush} 天`, activityScore(m.daysSincePush)),
        item("近 90 天提交样本", m.commitsLast90Days, Math.min(m.commitsLast90Days * 5, 100)),
        item("近期 Release", m.releases, Math.min(m.releases * 20, 100))
      ]
    },
    community: {
      ...DIMENSIONS.community, score: community,
      evidence: [
        item("贡献者", m.contributorsCapped ? `${m.contributors}+` : m.contributors, Math.min(m.contributors * 10, 100)),
        item("社区规范文件", `${communityChecks.filter(Boolean).length}/${communityChecks.length}`, communityChecks.filter(Boolean).length / communityChecks.length * 100),
        item("GitHub 社区健康度", `${h.healthPercentage || 0}%`, h.healthPercentage || 0)
      ]
    },
    engineering: {
      ...DIMENSIONS.engineering, score: engineering,
      evidence: [
        item("测试 / CI / 依赖 / 许可", `${engineeringChecks.filter(Boolean).length}/${engineeringChecks.length}`, localEngineering),
        item("OpenSSF Scorecard", scorecardAvailable ? `${data.security.score}/10` : "暂无公开结果", scorecardAvailable ? data.security.score * 10 : 0)
      ]
    },
    documentation: {
      ...DIMENSIONS.documentation, score: documentation,
      evidence: [
        item("README", h.hasReadme ? "已检测" : "缺失", h.hasReadme ? 100 : 0),
        item("项目描述与主页", `${r.description !== "暂无项目描述" ? "描述" : "无描述"} / ${r.homepage ? "主页" : "无主页"}`, (r.description !== "暂无项目描述" ? 60 : 0) + (r.homepage ? 40 : 0)),
        item("README 信息量", `${data.readme?.length || 0} 字符 / ${data.readme?.headings?.length || 0} 标题`, readmeQuality / 0.3)
      ]
    }
  };
  const total = clamp(Object.entries(values).reduce((sum, [key, value]) =>
    sum + value * DIMENSIONS[key].weight, 0));
  return { total, dimensions: values, details, methodology: "RepoScope 2026.1" };
}

function gradeFor(score) {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "E";
}

function fallbackOverview(data) {
  const language = data.languages[0]?.name || "未识别语言";
  const maturity = data.metrics.releases > 0 && data.metrics.contributors >= 3
    ? "成长阶段"
    : data.metrics.daysSincePush <= 90 ? "早期活跃阶段" : "早期观察阶段";
  return {
    summary: data.repository.description,
    positioning: `${language} 技术栈的开源项目，需结合 README 与代码进一步判断具体定位。`,
    projectType: data.repository.fork ? "派生项目" : "独立开源项目",
    maturity,
    coreFeatures: data.readme?.headings?.slice(0, 5) || [],
    techHighlights: data.languages.slice(0, 4).map((item) => `${item.name} ${item.percent}%`),
    targetUsers: ["需要评估该项目的开发者和技术团队"],
    useCases: [`基于 ${language} 技术栈的相关场景`]
  };
}

function dimensionFallback(base) {
  return Object.fromEntries(Object.entries(base.details).map(([key, detail]) => {
    const level = detail.score >= 75 ? "表现良好" : detail.score >= 50 ? "基础尚可" : "需要重点改善";
    return [key, {
      conclusion: `${detail.label}${level}，当前得分 ${detail.score}。`,
      evidence: detail.evidence.map((entry) => `${entry.label}：${entry.value}`).slice(0, 3),
      action: detail.score >= 75 ? "保持当前实践并持续监测趋势。" : "优先改善该维度中贡献最低的指标。"
    }];
  }));
}

function fallbackReview(data, base) {
  const dimensionAnalysis = dimensionFallback(base);
  const sorted = Object.entries(base.details).sort((a, b) => b[1].score - a[1].score);
  return {
    score: base.total,
    baselineScore: base.total,
    adjustment: 0,
    grade: gradeFor(base.total),
    summary: `${data.repository.fullName} 的可审计基准健康度为 ${base.total} 分。`,
    projectOverview: fallbackOverview(data),
    dimensionAnalysis,
    strengths: sorted.slice(0, 2).map(([, value]) => `${value.label}得分 ${value.score}，是当前优势维度。`),
    risks: sorted.slice(-2).map(([, value]) => `${value.label}仅 ${value.score} 分，需要关注。`),
    suggestions: sorted.slice(-2).map(([, value]) => `优先改进${value.label}，并跟踪其原始指标变化。`),
    verdict: base.total >= 75 ? "整体健康，可进入更深入的代码与安全审查。" : "建议完成关键改进后再作为核心依赖采用。",
    source: "rules",
    provider: null,
    model: null
  };
}

function parseAiJson(text) {
  const cleaned = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI response does not contain JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeStringArray(value, fallback, max = 4) {
  return Array.isArray(value) && value.length
    ? value.slice(0, max).map((item) => String(item).slice(0, 220))
    : fallback;
}

function buildPrompt(data, base) {
  const payload = {
    repository: data.repository,
    topics: data.repository.topics,
    metrics: data.metrics,
    languages: data.languages.slice(0, 8),
    health: data.health,
    security: data.security,
    readme: {
      headings: data.readme?.headings,
      excerpt: data.readme?.text?.slice(0, 10000)
    },
    deterministicAssessment: base
  };
  return [
    {
      role: "system",
      content: [
        "你是严谨的开源项目健康度评审专家。",
        "只能依据输入的 GitHub 数据、README 摘要和确定性评分，不得臆测代码质量、性能或安全性。",
        "确定性五维分数不可修改。你只能建议 -5 到 +5 的综合分修正，并说明依据。",
        "必须逐一分析 popularity、maintenance、community、engineering、documentation 五个维度。",
        "输出严格 JSON，不要 Markdown，所有说明使用中文。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "请输出以下 JSON 结构：",
        JSON.stringify({
          recommendedAdjustment: 0,
          adjustmentReason: "一句话",
          summary: "综合评价",
          projectOverview: {
            summary: "项目概述",
            positioning: "一句话产品或技术定位",
            projectType: "项目类型，例如框架、工具、服务、SDK、应用或学习项目",
            maturity: "成熟度判断，例如实验性、早期、成长、成熟或维护停滞，并避免无依据判断",
            coreFeatures: ["主要功能"],
            techHighlights: ["技术亮点或架构特点"],
            targetUsers: ["适用对象"],
            useCases: ["典型场景"]
          },
          dimensionAnalysis: {
            popularity: { conclusion: "结论", evidence: ["证据"], action: "行动建议" },
            maintenance: { conclusion: "结论", evidence: ["证据"], action: "行动建议" },
            community: { conclusion: "结论", evidence: ["证据"], action: "行动建议" },
            engineering: { conclusion: "结论", evidence: ["证据"], action: "行动建议" },
            documentation: { conclusion: "结论", evidence: ["证据"], action: "行动建议" }
          },
          strengths: ["跨维度优势信号"],
          risks: ["跨维度风险关注"],
          suggestions: ["按优先级排列的改进建议"],
          verdict: "采用建议"
        }),
        `待评估数据：${JSON.stringify(payload)}`
      ].join("\n")
    }
  ];
}

async function getAiReview(data, configOrKey, fetchImpl = getDefaultFetch()) {
  const base = deterministicScore(data);
  const fallback = fallbackReview(data, base);
  const config = typeof configOrKey === "string"
    ? resolveAiConfig({ provider: configOrKey ? "deepseek" : "", apiKey: configOrKey })
    : resolveAiConfig(configOrKey || {});
  if (!config.configured) return fallback;

  try {
    const result = await requestAiJson(config, buildPrompt(data, base), fetchImpl);
    const ai = parseAiJson(result.text);
    const adjustment = Math.max(-5, Math.min(5, Math.round(Number(ai.recommendedAdjustment) || 0)));
    const score = clamp(base.total + adjustment);
    const fallbackDimensions = dimensionFallback(base);
    const dimensionAnalysis = Object.fromEntries(Object.keys(DIMENSIONS).map((key) => {
      const value = ai.dimensionAnalysis?.[key] || {};
      return [key, {
        conclusion: String(value.conclusion || fallbackDimensions[key].conclusion).slice(0, 300),
        evidence: normalizeStringArray(value.evidence, fallbackDimensions[key].evidence, 4),
        action: String(value.action || fallbackDimensions[key].action).slice(0, 300)
      }];
    }));
    const overview = ai.projectOverview || {};
    return {
      score,
      baselineScore: base.total,
      adjustment,
      adjustmentReason: String(ai.adjustmentReason || "AI 未提供额外修正理由").slice(0, 240),
      grade: gradeFor(score),
      summary: String(ai.summary || fallback.summary).slice(0, 500),
      projectOverview: {
        summary: String(overview.summary || fallback.projectOverview.summary).slice(0, 800),
        positioning: String(overview.positioning || fallback.projectOverview.positioning).slice(0, 300),
        projectType: String(overview.projectType || fallback.projectOverview.projectType).slice(0, 100),
        maturity: String(overview.maturity || fallback.projectOverview.maturity).slice(0, 100),
        coreFeatures: normalizeStringArray(overview.coreFeatures, fallback.projectOverview.coreFeatures, 6),
        techHighlights: normalizeStringArray(overview.techHighlights, fallback.projectOverview.techHighlights, 6),
        targetUsers: normalizeStringArray(overview.targetUsers, fallback.projectOverview.targetUsers, 4),
        useCases: normalizeStringArray(overview.useCases, fallback.projectOverview.useCases, 4)
      },
      dimensionAnalysis,
      strengths: normalizeStringArray(ai.strengths, fallback.strengths),
      risks: normalizeStringArray(ai.risks, fallback.risks),
      suggestions: normalizeStringArray(ai.suggestions, fallback.suggestions),
      verdict: String(ai.verdict || fallback.verdict).slice(0, 300),
      source: "ai",
      provider: config.provider,
      model: config.model
    };
  } catch (error) {
    return { ...fallback, aiError: error.message, provider: config.provider, model: config.model };
  }
}

module.exports = {
  DIMENSIONS,
  buildPrompt,
  clamp,
  deterministicScore,
  fallbackReview,
  getAiReview,
  gradeFor,
  parseAiJson
};
