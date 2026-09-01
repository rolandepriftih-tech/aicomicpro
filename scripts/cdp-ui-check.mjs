#!/usr/bin/env node
/**
 * cdp-ui-check.mjs — 零依赖 CDP UI 自查脚本（AI Comic Pro）
 *
 * 三层组合拳：
 *   1. Chrome 自带 CDP 协议（--remote-debugging-port）— 能力来自浏览器
 *   2. 本脚本用 Node 内置 WebSocket 发 JSON 命令 — 能力来自 Agent 框架
 *   3. 截图 PNG 落盘后由多模态模型读图 — 能力来自模型
 *
 * 用法：
 *   先启动调试 Chrome（独立实例，不碰日常浏览器）：
 *     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *       --headless=new --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-cdp-profile \
 *       --disable-gpu --no-sandbox --window-size=1440,900 about:blank &
 *
 *   再跑脚本：
 *     node cdp-ui-check.mjs <url> <action> [args...]
 *
 *   action:
 *     shot <pngPath>              — 截图当前页
 *     eval <js>                   — 执行 JS 并打印返回（JSON.stringify）
 *     click <cssSelector>         — 点击元素（用 JS 触发）
 *     type <cssSelector> <text>   — 设输入框值（触发 input 事件）
 *     full <pngPath>              — 完整流程示例：打开页面→等加载→截图
 *
 * 示例：
 *   node cdp-ui-check.mjs http://127.0.0.1:3000 shot /tmp/ui.png
 *   node cdp-ui-check.mjs http://127.0.0.1:3000 eval 'document.querySelectorAll(".react-flow__node").length'
 *   node cdp-ui-check.mjs http://127.0.0.1:3000 full /tmp/ui-full.png
 */

const CDP_PORT = process.env.CDP_PORT || 9222;
const url = process.argv[2];
const action = process.argv[3];
const arg1 = process.argv[4];
const arg2 = process.argv[5];

if (!url || !action) {
  console.error("用法: node cdp-ui-check.mjs <url> <action> [args...]");
  process.exit(1);
}

let msgId = 0;
const pending = new Map();
let ws;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function connect() {
  // 获取调试目标
  const version = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`).then((r) => r.json());
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };
}

async function newPage() {
  // 优先复用已存在的页面 target（避免每次新建导致 session 堆积）
  const targets = await fetch(`http://127.0.0.1:${CDP_PORT}/json`).then((r) => r.json());
  const pageTarget = targets.find((t) => t.type === "page");
  const targetId = pageTarget?.id;
  if (!targetId) {
    const created = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
    return { targetId: created.targetId, sessionId };
  }
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  return { targetId, sessionId };
}

// 带 session 的 send：sessionId 是消息顶层字段，不是 params
let sessionId = null;
function ssend(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await connect();
  const page = await newPage();
  sessionId = page.sessionId;
  // 启用 Page / Runtime 域（session 建立后必须 enable 才能用域方法）
  try {
    await ssend("Page.enable");
    await ssend("Runtime.enable");
  } catch (e) {
    console.error("enable 失败:", e.message);
    process.exit(1);
  }

  if (action === "shot") {
    await ssend("Page.navigate", { url });
    await sleep(3000);
    const { data } = await ssend("Page.captureScreenshot", { format: "png" });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(arg1, Buffer.from(data, "base64"));
    console.log(`截图已保存: ${arg1}`);
  } else if (action === "full") {
    await ssend("Page.navigate", { url });
    await sleep(4000);
    const { data } = await ssend("Page.captureScreenshot", { format: "png" });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(arg1, Buffer.from(data, "base64"));
    console.log(`截图已保存: ${arg1}`);
  } else if (action === "eval") {
    await ssend("Page.navigate", { url });
    await sleep(3000);
    const { result } = await ssend("Runtime.evaluate", {
      expression: arg1,
      returnByValue: true,
    });
    console.log(JSON.stringify(result?.value ?? null, null, 2));
  } else if (action === "click") {
    await ssend("Page.navigate", { url });
    await sleep(3000);
    const expr = `(() => {
      const el = document.querySelector(${JSON.stringify(arg1)});
      if (!el) return "NOT_FOUND";
      el.click();
      return "CLICKED";
    })()`;
    const { result } = await ssend("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
    });
    console.log(JSON.stringify(result?.value ?? null));
  } else if (action === "type") {
    await ssend("Page.navigate", { url });
    await sleep(3000);
    const expr = `(() => {
      const el = document.querySelector(${JSON.stringify(arg1)});
      if (!el) return "NOT_FOUND";
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(arg2)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return "TYPED";
    })()`;
    const { result } = await ssend("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
    });
    console.log(JSON.stringify(result?.value ?? null));
  } else {
    console.error(`未知 action: ${action}`);
    process.exit(1);
  }

  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("CDP 错误:", e.message);
  process.exit(1);
});
