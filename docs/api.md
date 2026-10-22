# 本地 API

JSON 请求与响应。仅允许本机 Host；跨站写入和非 JSON 写入会被拒绝。M1 没有登录和多租户授权，不应公开暴露。

|方法|路径|输入 / 结果|
|---|---|---|
|GET|`/api/state`|工作区聚合状态，版本不含 HTML，来源不含正文|
|POST|`/api/spaces`|topic 必填，goal/background/depth/version/references 可选|
|PATCH|`/api/spaces/:id`|修改设定；不覆盖已有讲稿|
|DELETE|`/api/spaces/:id`|删除关联产物；活动任务时 409|
|POST|`/api/spaces/:id/outline-jobs`|requestId；202 返回异步任务|
|PATCH|`/api/outlines/:id`|chapters、confirmed；确认后不可覆盖|
|POST|`/api/outlines/:id/chapters/:chapterId/lesson-jobs`|requestId；需确认大纲|
|GET|`/api/versions/:id`|规格、完整 HTML、来源 ID、父版本与该版本验证|
|POST|`/api/versions/:id/revision-jobs`|requestId、request；创建新版本|
|GET|`/api/jobs/:id`|状态、阶段、用量、错误、修复证据及结果 ID|
|POST|`/api/jobs/:id/cancel`|停止可取消步骤|
|POST|`/api/jobs/:id/retry`|新 requestId；关联原任务|
|GET|`/api/sources/:id`|正文快照、哈希、读取状态|
|GET|`/api/versions/:id/artifacts/desktop.png`|桌面截图|
|GET|`/api/versions/:id/artifacts/mobile.png`|移动截图|

讲稿与任务历史通过 `/api/state` 的 lessonId/spaceId 筛选。相同 kind、spaceId、requestId 及输入去重；同一标识配不同输入会拒绝。修复属于同一任务内部阶段。取消与重试请求均使用 JSON body。错误返回 `{error: string}`；Schema 错误为 422。

预览端口仅提供 `/render/:versionId?token=随机标识`，不持有数据库 API 或模型能力。其内容先经过清洗，再在 Worker 内执行脚本，不能将原 HTML 当作可信主站页面嵌入。
