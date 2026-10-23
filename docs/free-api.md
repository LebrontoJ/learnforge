# 免费 API 联调与断点验收

Gemini 提供 OpenAI 兼容接口。以下配置使用 Gemini 3.1 Flash-Lite；是否处于免费层由 Google 项目决定，应用不能根据 API Key 判断账单层级。请在 Google AI Studio 确认项目是 **Free tier**，不要为本轮验收启用付费账单。

`PROVIDER=openai` 表示兼容接口协议，模型服务仍是 Google Gemini。

在 Git 忽略的本地 `.env` 中设置：

```dotenv
PROVIDER=openai
API_KEY=只在本地填写
MODEL=gemini-3.1-flash-lite
MODEL_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
MODEL_TOKEN_FIELD=max_tokens
MODEL_MAX_OUTPUT_TOKENS=8192
MODEL_MIN_INTERVAL_MS=15000
MODEL_HTTP_RETRIES=1
JOB_TIMEOUT_MS=300000
MAX_MODEL_CALLS=8
MAX_REPAIRS=2
```

创建密钥：[Google AI Studio](https://aistudio.google.com/api-keys)。不要把密钥写入源码、命令行参数、文档或 Git。当前实现通过服务端 Authorization 请求头发送密钥；日志只记录状态码、用量与时间。

```sh
npm run model:check                  # 一次最小 JSON 请求
npm run model:check -- --models      # 只查询账号可见模型
npm run eval:live -- --resume        # 20 个固定资料案例，真实模型与浏览器
npm run accept:free                 # 同批次有限续跑；不自动恢复配额/未知网络错误
npm run eval:export                 # 导出可提交的代码、报告和代表性截图
```

评测在每次调用、规格生成、版本创建与验证完成后保存 `artifacts/model-evaluation/checkpoint.json`。持续 429/503 会暂停；401/403 会停止后续案例。网络请求结果未知时不会自动重放。恢复时复用已保存的规格、初始 HTML 与验证报告；模型、案例或独立规则发生变化则拒绝混入旧批次。

供应商明确拒绝的 429/503 可有限重试；超过 30 秒的 Retry-After 不在当前调用内等待。每个 HTTP 尝试都计入调用预算，节流和等待支持取消。默认不自动重试，只有上面的免费配置启用一次重试。永远不会为完成验收自动换用另一个付费模型或创建付费账号。

`docs/evaluation-model.md` 记录本轮实际状态、分子分母、代码版本和耗时；未完成的案例不冒充已验收。固定资料模型验收不包含真实搜索：`eval:e2e` 仍需搜索服务配置；人工内容审查、引用支持与保留集评测也需另行完成。

官方依据：[Gemini 免费层价格](https://ai.google.dev/gemini-api/docs/pricing)、[OpenAI 兼容接口](https://ai.google.dev/gemini-api/docs/openai)、[账号限额](https://ai.google.dev/gemini-api/docs/rate-limits)。额度与可用性会变化，当前账号控制台的实际限额优先。
