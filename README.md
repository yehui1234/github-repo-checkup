# RepoScope - GitHub 仓库体检工具

RepoScope 是一个面向公开 GitHub 仓库的 Web 分析工具。输入仓库 URL 后，
它会聚合 GitHub API、README、社区健康文件和可用的 OpenSSF 数据，
生成项目画像、可视化指标、五维健康度和可解释 AI 诊断。

> AI 负责概述、逐维分析和有限修正；基础分由确定性指标计算，避免模型随意评分。

## 演示视频

点击下面的链接查看 RepoScope 完整操作演示：

### [▶ 查看项目演示视频](./vedio.mp4)

> 视频文件约 12.5 MB，已包含在本仓库中。若浏览器无法直接播放，请点击链接后下载观看。

## 功能

- 分析任意公开 GitHub 仓库 URL
- 展示 Stars、Forks、Watchers、Issues、贡献者和最近推送
- 可视化编程语言分布
- 根据 README 生成项目定位、主要功能、技术亮点、用户与场景
- 展示许可证、默认分支、仓库规模、项目年龄和 Release
- 计算影响力、维护活跃度、社区治理、工程安全和文档完备度
- 针对每个评分维度展示证据、AI 结论和行动建议
- 支持 DeepSeek、阿里云百炼、OpenAI、Gemini、Anthropic 等平台
- 支持 Ollama、LM Studio、vLLM 等本地或 OpenAI-compatible 服务
- 自动识别 Windows 系统代理，也支持显式代理配置
- AI 不可用时自动降级为规则诊断

## 技术栈

- Node.js 原生 HTTP Server
- 原生 HTML、CSS、JavaScript
- GitHub REST API
- `undici`：HTTP 请求及代理调度
- `dotenv`：读取本地 `.env` 配置
- Node.js Test Runner：自动化测试

项目没有使用前端框架，也不需要数据库。

## 环境要求

| 环境 | 要求 |
|---|---|
| Node.js | 18 或更高版本 |
| npm | 随 Node.js 安装，建议 9 或更高版本 |
| 网络 | 能访问 GitHub API 和所配置的 AI 服务 |
| GitHub Token | 可选，用于提高 API 请求限额 |
| AI API Key | 可选；不配置时使用规则评分 |

检查本机环境：

```bash
node --version
npm --version
```

## 安装

### 1. 获取代码

在 GitHub 仓库页面点击绿色的 **Code** 按钮，复制仓库地址，然后执行：

```bash
git clone <This_repo>
cd github-repo-checkup
```


也可以在 GitHub 页面点击 **Code → Download ZIP**，下载并解压后，在终端中进入
解压得到的 `github-repo-checkup` 文件夹。

### 2. 安装依赖

```bash
npm install
```

生产依赖包括：

- `undici`：请求 GitHub、AI 服务以及通过 v2rayN 等 HTTP 代理联网
- `dotenv`：从 `.env` 文件加载 API Key 和服务配置

`node_modules` 不应提交到 GitHub，其他使用者需要自行运行 `npm install`。
依赖版本记录在 `package-lock.json` 中。

### 3. 创建环境配置

项目提供了一个不包含真实密钥的配置模板 `.env.example`。需要将它复制为
`.env`，然后在 `.env` 中填写自己的 API Key。程序启动时会自动读取 `.env`。

`.env.example` 是公开示例文件，`.env` 是你自己的私密配置文件。

Windows PowerShell 中执行：

```powershell
Copy-Item .env.example .env
```

这条命令的意思是：复制 `.env.example`，并把复制出来的新文件命名为 `.env`。

如果不想使用命令，也可以在文件管理器中：

1. 复制 `.env.example`
2. 将复制后的文件重命名为 `.env`
3. 使用记事本或代码编辑器打开 `.env`

macOS / Linux 中执行：

```bash
cp .env.example .env
```

打开新生成的 `.env`，至少填写一个 AI 平台的配置。例如使用 DeepSeek：

```dotenv
PORT=3000
AI_PROVIDER=deepseek
AI_API_KEY=your_api_key
AI_MODEL=deepseek-chat
```

将 `your_api_key` 替换为自己的真实 API Key。例如：

```dotenv
AI_API_KEY=sk-xxxxxxxxxxxxxxxx
```

如果暂时没有 AI API Key，也可以将 `AI_API_KEY` 留空。项目仍然可以运行，
但会使用规则评分，无法生成完整的 AI 项目画像和诊断。

`.env` 已加入 `.gitignore`，不要把真实 API Key 提交到仓库。

## 运行

生产方式：

```bash
npm start
```

开发方式，文件变化后自动重启：

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:3000
```

## AI 平台配置

### DeepSeek

```dotenv
AI_PROVIDER=deepseek
AI_API_KEY=your_deepseek_key
AI_MODEL=deepseek-chat
```

也兼容旧变量：

```dotenv
DEEPSEEK_API_KEY=your_deepseek_key
```

### 阿里云百炼

```dotenv
AI_PROVIDER=dashscope
DASHSCOPE_API_KEY=your_dashscope_key
AI_MODEL=qwen-plus
```

`aliyun` 可作为 `dashscope` 的别名。默认使用北京地域兼容地址：

```text
https://dashscope.aliyuncs.com/compatible-mode/v1
```

其他地域或业务空间可设置：

```dotenv
AI_BASE_URL=your_dashscope_compatible_endpoint
```

### OpenAI-compatible 平台

适用于 OpenRouter、Groq、Mistral、SiliconFlow、LM Studio 和 vLLM：

```dotenv
AI_PROVIDER=compatible
AI_API_KEY=your_key
AI_MODEL=your_model
AI_BASE_URL=https://example.com/v1
```

内置提供商名称：

```text
deepseek, dashscope, aliyun, openai, openrouter, groq,
mistral, siliconflow, anthropic, gemini, ollama, compatible
```

### 本地 Ollama

先安装 Ollama 并下载模型：

```bash
ollama pull qwen3:8b
```

配置：

```dotenv
AI_PROVIDER=ollama
AI_MODEL=qwen3:8b
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_API_KEY=
```

确保 Ollama 服务已经运行：

```bash
ollama serve
```

## GitHub API 配置

公开仓库可以匿名读取，但匿名 API 限额较低。分析频繁时建议创建
GitHub Personal Access Token：

```dotenv
GITHUB_TOKEN=github_pat_xxx
```

Token 仅在服务端用于访问 GitHub，不会发送到浏览器。

## 代理配置

Node.js 默认不会自动使用 Windows 系统代理。本项目会尝试读取已启用的
Windows 代理，也可显式设置：

```dotenv
PROXY_URL=http://127.0.0.1:10808
```

v2rayN 的 `mixed` 端口可作为 HTTP 代理使用。也支持：

```text
HTTPS_PROXY
HTTP_PROXY
ALL_PROXY
```

启动日志会显示：

```text
Proxy enabled: http://127.0.0.1:10808
```

## 评分方法

RepoScope 2026.1 使用五个确定性维度：

| 维度 | 权重 | 主要指标 |
|---|---:|---|
| 影响力 | 15% | Stars、Forks、Watchers |
| 维护活跃度 | 25% | 最近推送、近 90 天提交、Release |
| 社区治理 | 20% | 贡献者、贡献指南、行为准则、Issue/PR 模板 |
| 工程与安全 | 25% | 测试、CI、依赖清单、许可证、OpenSSF |
| 文档完备度 | 15% | README、仓库描述、主页、README 信息量 |

```text
基准分 = Σ（维度分 × 维度权重）
最终分 = 基准分 + AI 修正
AI 修正范围 = -5 到 +5
```

AI 不能修改五维原始分数，只能根据 README 和公开指标提供透明的小范围修正。

指标设计参考：

- [CHAOSS Metrics](https://chaoss.community/kb-metrics-and-metrics-models/)
- [OpenSSF Scorecard](https://scorecard.dev/)
- [GitHub Community Profile](https://docs.github.com/en/rest/metrics/community)

RepoScope 的分数不是上述组织的官方认证分数。

## 项目结构

```text
github-repo-checkup/
├── lib/
│   ├── ai.js               # AI 平台适配
│   ├── github.js           # GitHub 数据采集
│   ├── http.js             # HTTP 与代理支持
│   └── scoring.js          # 确定性评分和 AI 提示词
├── public/
│   ├── app.js              # Web 页面交互和渲染
│   ├── index.html          # 页面结构
│   └── styles.css          # 页面样式
├── scripts/
│   └── browser-server.js   # 浏览器测试服务
├── test/                   # 自动化测试
├── .env.example            # 环境变量模板
├── package.json
├── package-lock.json
└── server.js               # HTTP 服务入口
```

## 测试

运行全部测试：

```bash
npm test
```

测试覆盖：

- GitHub URL 解析
- 评分计算和边界
- AI JSON 解析与降级
- DeepSeek、DashScope 等请求契约
- 代理地址解析
- HTTP API 集成
- Web 页面元素和响应式契约

检查依赖安全：

```bash
npm audit
```

## 常见问题

### `Cannot find module`

依赖尚未安装：

```bash
npm install
```

### GitHub API 超时

确认代理软件正在运行，并在 `.env` 中填写实际端口：

```dotenv
PROXY_URL=http://127.0.0.1:10808
```

### GitHub API 请求额度用完

配置 `GITHUB_TOKEN`，或等待匿名额度重置。

### AI 显示规则评分

检查：

1. `.env` 是否位于项目根目录
2. `AI_PROVIDER`、`AI_MODEL` 是否正确
3. API Key 是否有效
4. AI 平台地址是否可访问
5. 修改 `.env` 后是否重启了服务

即使 AI 请求失败，仓库指标和确定性评分仍然可用。

### 端口被占用

修改 `.env`：

```dotenv
PORT=3100
```

## 安全说明

- API Key 只在 Node.js 服务端读取
- `.env` 默认不会提交到 Git
- 前端不会接收或保存 API Key
- 仓库 URL 会经过 GitHub 域名和路径校验
- 页面启用了 Content Security Policy

## License

当前项目尚未附带开源许可证。若准备公开发布到 GitHub，建议根据预期用途添加
MIT、Apache-2.0 或其他适合的许可证文件。

## 开源与作者

本项目计划作为开源项目发布，欢迎提交 Issue、功能建议和 Pull Request。
正式发布前，请在仓库中补充明确的开源许可证文件。

- 作者：yehui
- 邮箱：[2911143358@qq.com](mailto:2911143358@qq.com)
