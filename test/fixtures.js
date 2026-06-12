const repository = {
  owner: { login: "jerry-ai-dev", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4" },
  name: "MODULAR-RAG-MCP-SERVER",
  full_name: "jerry-ai-dev/MODULAR-RAG-MCP-SERVER",
  html_url: "https://github.com/jerry-ai-dev/MODULAR-RAG-MCP-SERVER",
  description: "A modular RAG MCP server for flexible AI knowledge workflows.",
  homepage: "",
  created_at: "2025-01-15T00:00:00Z",
  updated_at: "2026-06-08T00:00:00Z",
  pushed_at: "2026-06-08T00:00:00Z",
  default_branch: "main",
  license: { spdx_id: "MIT" },
  archived: false,
  fork: false,
  size: 3210,
  stargazers_count: 428,
  forks_count: 61,
  subscribers_count: 14,
  open_issues_count: 9
};

const contributors = Array.from({ length: 8 }, (_, index) => ({ login: `user-${index}` }));
const commits = Array.from({ length: 12 }, (_, index) => ({
  sha: `${index}abcdef123456`,
  author: { login: `contributor-${index % 4}` },
  commit: {
    message: index === 0 ? "Improve modular retrieval pipeline" : `Project update ${index}`,
    author: { name: "Contributor", date: `2026-06-${String(Math.max(1, 10 - index)).padStart(2, "0")}T08:00:00Z` }
  }
}));

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  };
}

function createMockFetch() {
  return async (url) => {
    const value = String(url);
    if (value.includes("api.deepseek.com")) {
      return jsonResponse({
        choices: [{
          message: {
            content: JSON.stringify({
              recommendedAdjustment: 2,
              adjustmentReason: "项目近期活跃且 README 信息充分。",
              summary: "项目保持活跃，模块化定位清晰，工程与社区规范仍有提升空间。",
              projectOverview: {
                summary: "这是一个面向 AI 知识工作流的模块化 RAG MCP 服务。",
                positioning: "通过 MCP 协议向 AI 助手提供模块化知识检索能力。",
                projectType: "AI 基础设施 / MCP 服务",
                maturity: "成长阶段",
                coreFeatures: ["模块化检索流程", "MCP 协议服务", "知识库集成"],
                techHighlights: ["混合检索", "模块化架构", "MCP 协议"],
                targetUsers: ["AI 应用开发者", "RAG 平台团队"],
                useCases: ["为智能助手提供知识检索", "搭建模块化 RAG 服务"]
              },
              dimensionAnalysis: {
                popularity: { conclusion: "已有一定社区关注。", evidence: ["428 Stars", "61 Forks"], action: "持续发布案例扩大影响力。" },
                maintenance: { conclusion: "近期维护活跃。", evidence: ["近 90 天有提交"], action: "保持发布节奏。" },
                community: { conclusion: "社区规范仍不完整。", evidence: ["缺少贡献指南"], action: "补充治理文件。" },
                engineering: { conclusion: "具备测试和 CI 基础。", evidence: ["检测到测试目录", "检测到工作流"], action: "增加安全扫描。" },
                documentation: { conclusion: "README 信息较充分。", evidence: ["有 README"], action: "增加部署示例。" }
              },
              strengths: ["近期提交活跃", "具备许可证和基础文档", "已有多位贡献者参与"],
              risks: ["贡献流程文档不完整", "缺少行为准则", "发布版本数量有限"],
              suggestions: ["完善贡献指南", "增加行为准则与 PR 模板", "建立稳定的版本发布节奏"],
              verdict: "整体健康，适合试用并持续关注维护节奏。"
            })
          }
        }]
      });
    }
    if (value.includes("api.securityscorecards.dev")) return jsonResponse({ score: 7.4, date: "2026-06-10", checks: [] });
    if (value.endsWith("/languages")) return jsonResponse({ Python: 72000, TypeScript: 19000, Dockerfile: 3000, Shell: 2000 });
    if (value.includes("/contributors")) return jsonResponse(contributors);
    if (value.includes("/commits")) return jsonResponse(commits);
    if (value.includes("/releases")) return jsonResponse([{ tag_name: "v1.0.0" }, { tag_name: "v0.9.0" }]);
    if (value.endsWith("/contents")) return jsonResponse([
      { name: "README.md" }, { name: "LICENSE" }, { name: "pyproject.toml" },
      { name: "tests" }, { name: ".github" }
    ]);
    if (value.endsWith("/community/profile")) return jsonResponse({
      health_percentage: 72,
      files: { readme: {}, license: {}, issue_template: {} }
    });
    if (value.endsWith("/readme")) return jsonResponse({
      encoding: "base64",
      content: Buffer.from("# Modular RAG MCP Server\n\nA modular RAG server.\n\n## Features\n\n- Retrieval\n- MCP tools\n\n## Installation\n\nInstall dependencies.").toString("base64")
    });
    if (value.includes("/actions/workflows")) return jsonResponse({ total_count: 2, workflows: [] });
    if (value.includes("/repos/jerry-ai-dev/MODULAR-RAG-MCP-SERVER")) return jsonResponse(repository);
    return jsonResponse({ message: "Not Found" }, 404);
  };
}

module.exports = { createMockFetch };
