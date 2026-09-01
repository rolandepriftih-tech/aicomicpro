# 生图/生视频链路代码审查报告（2026-08-27）

> 审查方式：Explore agent 深读链路代码 + vitest 全量回归（66/66 通过）。
> 结论：happy path 健康可跑通；但存在 1 个 P0、7 个 P1、10 个 P2 隐患。
> 修复优先级建议：#1（P0）→ #2/#4/#5（丢钱类）→ 其余按需。

---

## P0（必坏的逻辑矛盾）

### 1. 视频异步任务兜底超时(10min) < 服务端最坏耗时(~19min)，且超时后成功会把 error 翻回 success
- 位置：`lib/video-generation-jobs.ts:53`（默认 `timeoutMs = 10 * 60_000`）、`app/api/generate-video/route.ts:290`（enqueue 未传自定义超时）、`lib/video-gen.ts:397,640,729`（内部 deadline 15min）、`lib/video-save.ts:28,82-84`（产物下载+ffmpeg 再加 ≤240s）
- 关键缺陷：`video-generation-jobs.ts:77-88` 的 `.then` **无条件** `status: "success"`，与超时处理器（`:68` 有 `status === "pending"` 保护）不对称
- 后果：超 10 分钟的任务被误判失败、前端停止轮询；13–19 分钟后 `.then` 又把 error 记录改写成"僵尸成功"，白花钱无人认领
- 修法：enqueue 兜底超时提到 ≥20 分钟（或透传 `body.timeoutMs`）；`.then` 加 `if (stored.status !== "error")` 守卫

## P1（边界场景必坏 / 重要健壮性缺口）

### 2. 生图 Gemini 分支无超时控制，图片任务池没有看门狗
- `lib/image-gen.ts:138-172`（Gemini config 未接 abortSignal，SDK 支持 `genai.d.ts:4633`）；`lib/image-generation-jobs.ts:43-76` 无超时兜底（对比 `video-generation-jobs.ts:67-75` 有）
- 后果：Gemini 挂起 → 任务永久 pending
- 修法：`config.abortSignal` 接 timer 或 enqueue 补看门狗

### 3. Gemini 参考图参数是 SDK 不存在的字段
- `lib/image-gen.ts:151-159` 塞 `config.referenceImages`；SDK `GenerateImagesConfig`（genai.d.ts:4629-4691）无此字段；`lib/model-capabilities.ts:30-38` 却对所有 gemini 返回 `supportsReferenceImage: true`
- 后果：参考图被静默丢弃（角色一致性失效）或严格端点 400
- 修法：改用 SDK 真实入口（`editImage`/raw request）并如实标注 capability

### 4. 任务轮询零容错
- `app/hooks/useWorkspace.ts:663-668`、`components/plan4-canvas/Plan4Canvas.tsx:399-401`：一次 fetch 抛错/一次非 404 错误响应即判死整次生成
- 修法：可重试错误退避重试 N 次；仅 404 / status==="error" 终止

### 5. 生图 jobId 不持久化，刷新后失联
- `useWorkspace.ts:647-671`：jobId 从未写入节点/存储；视频侧已有（`Plan4Canvas.tsx:1180-1188` + `:492-502` 刷新恢复）
- 修法：照视频侧方案，jobId 写 canvas 状态并扫表续询

### 6. 批量生图用陈旧闭包快照取上游参考图
- `Plan4Canvas.tsx:1572-1667`：`handleBatchGenerate` deps（`:1667`）不含 `assetImageUrls/panelImageUrls`，循环体从旧 map 取图
- 后果：continues/references 链下游拿不到本轮新生成的上游图，一致性断裂
- 修法：ref 函数式读最新 state，或补 deps

### 7. 远程 URL 持久化后必然腐烂
- `lib/image-gen.ts:272,278,284,616,622,628`（下载失败原样返回 URL）、`useWorkspace.ts:679-685`（15s 下载失败静默保留远程 URL 进 IndexedDB）
- 修法：下载失败视为失败重试，或标记"临时链接"

### 8. output/ 清理会删掉已被项目引用的视频
- `lib/video-save.ts:134-137`（maxFiles=20/7天）vs `route.ts:155-161` 把 `/api/media/videos/...` 持久化进节点
- 修法：清理前对照 canvas 引用白名单

## P2（隐患）

9. **SSRF**：模型输出中的任意 URL 服务端直接 fetch（`image-gen.ts:270-284,614-628`、`video-save.ts:39`），无域白名单（本地单机风险可控；media 路由本身的路径穿越防护已验证有效）
10. **Media Range 解析崩溃**：`app/api/media/[...file]/route.ts:77-96` 后缀区间 `bytes=-500` → NaN 穿透校验 → 500；`end >= fileSize` 应 clamp 而非 416
11. **日志倾倒 base64**：`generate-video/route.ts:113-121`、`video-gen.ts:507` 全量打印参考图，单次几十 MB
12. **content 轮询全量 slurp**：`video-gen.ts:415-423` 每 3s GET content 端点并 `text()` 读入内存
13. **任务池裁剪可淘汰 pending**：`image-generation-jobs.ts:35-41`、`video-generation-jobs.ts:38-44` 只按 createdAt 裁剪
14. **handleCancelBatch 空操作**：`useWorkspace.ts:174` AbortController 从未赋值（休眠 bug）
15. **AutoDL resolution 口径不一**：服务端兜底 `"480p竖"` vs 画布恒传 `"720p"`，格式混用赌远端行为
16. **资产图双键冗余存储**：`useWorkspace.ts:851-857` 同图存两份 + IndexedDB 全量重写（`storage.ts:89-98`）
17. **大文件全量进内存**：`video-save.ts:44` arrayBuffer、`media/route.ts:94-116` 一次性 alloc，建议流式
18. **异步失败双 Toast 矛盾**：`Plan4Canvas.tsx:1195-1199,1461-1466` 内部已 toast error 并 return，外层仍无条件 toast "生成成功"

---

## 建议修复顺序

1. **立即**：#1（一行守卫 + 超时对齐，防止烧钱）
2. **复刻 UI 完成后**：#4、#5（轮询容错 + jobId 持久化，用户体验直接相关）
3. **按需**：#2、#3、#6、#7、#8 及 P2 清单
