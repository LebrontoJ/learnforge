# model 真实模型验收

时间：2026年10月22日 GMT-4 20:04:49（America/New_York）；模型：gemini-3.1-flash-lite；批次：3a9a1d5c-b153-4d1a-85c6-ad6131cca096。

状态 **completed**，完成 20/20 案例。

固定开发者资料摘要与初始大纲，真实模型生成教学规格、HTML 与修复代码；不冒充实时检索，也不代表真实大纲生成 UI 已验收。A 和 B 使用同一教学规格和同一份初始产物，最多两轮反馈修复。限流暂停时保留规格、初始代码、验证与用量；未运行案例不计为通过或失败。

|指标|结果|
|---|---|
|首次运行|20/20 (100%)|
|失败 HTTP 尝试|35|
|未形成初始产物|0|
|首次行为|0/16 (0%)|
|最终行为|12/16 (75%)|
|条件修复成功|8/16 (50%)|
|修复回归|0/16 (0%)|
|独立语义规则|8/16 (50%)|
|首版代码生成 中位/P95|16526/37733 ms|
|案例活跃耗时 中位/P95|86465/139299 ms|
|HTTP 调用尝试 / 已报告 Token|100 / 147589|
|费用|未知；本地无法确认账号是否处于供应商 Free tier|

## 案例

- binary-1: completed; A=false / B=true; 5 次调用；
- binary-2: completed; A=false / B=true; 7 次调用；
- binary-3: completed; A=false / B=false; 8 次调用；达到两轮修复上限，保留失败
- binary-4: completed; A=false / B=false; 7 次调用；达到两轮修复上限，保留失败
- binary-5: completed; A=false / B=false; 6 次调用；达到两轮修复上限，保留失败
- lru-6: completed; A=false / B=false; 4 次调用；达到两轮修复上限，保留失败
- lru-7: completed; A=false / B=true; 5 次调用；
- lru-8: completed; A=false / B=true; 4 次调用；
- lru-9: failed; A=false / B=false; 8 次调用；模型调用或 Token 预算已达到上限
- lru-10: completed; A=false / B=false; 4 次调用；达到两轮修复上限，保留失败
- rate-11: completed; A=false / B=false; 5 次调用；达到两轮修复上限，保留失败
- rate-12: completed; A=false / B=true; 6 次调用；
- rate-13: completed; A=false / B=true; 3 次调用；
- rate-14: completed; A=false / B=false; 4 次调用；达到两轮修复上限，保留失败
- rate-15: completed; A=false / B=true; 3 次调用；
- event-16: completed; A=false / B=true; 6 次调用；
- plain-concept: completed; A=true / B=true; 3 次调用；
- plain-version: completed; A=true / B=true; 2 次调用；
- missing-source: completed; A=true / B=true; 4 次调用；
- unsupported-cluster: completed; A=true / B=true; 6 次调用；

## 限制

报告的技术规则只覆盖对应简化演示，不能代表全部讲稿语义。人工引用支持抽样 0 条，未完成独立人工审查；无盲测保留集。小样本 P95 不代表服务容量。耗时包含节流、有限重试及浏览器检查，不包含批次暂停期间的等待。全部代码、快照、步骤与截图在 artifacts/model-evaluation。

继续本批：npm run eval:live -- --resume。去掉 --resume 开启新批次（旧产物保留）。
