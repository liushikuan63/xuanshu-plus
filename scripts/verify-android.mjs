#!/usr/bin/env node
/**
 * 通过 CDP（WebView 调试）对模拟器中的玄枢 App 做端到端功能验证：
 * 1) 确认 React 已渲染标题
 * 2) 模拟点击「起卦并排盘」（默认摇卦），等待后读取盘面是否出现
 */
import WebSocket from 'ws';

const PORT = 9222;
const TIMEOUT = 15000;

function rpc(ws, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${method} 超时`)), TIMEOUT);
    const onMsg = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id === id) {
        clearTimeout(timer);
        ws.off('message', onMsg);
        resolve(msg.result);
      }
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('未找到 WebView 页面');
  console.log('目标页面:', page.title, '|', page.url);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  let id = 0;
  const call = (m, p) => rpc(ws, ++id, m, p);

  await call('Runtime.enable');

  // 1) 渲染检查
  const evalExpr = async (expression) => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true });
    return r?.result?.value;
  };

  const title = await evalExpr('document.title');
  const headerText = await evalExpr('document.querySelector("header h1")?.textContent ?? "未找到"');
  const stepTexts = await evalExpr('[...document.querySelectorAll(".card h2")].map(e=>e.textContent).join(" | ")');
  console.log('页面标题:', title);
  console.log('Header:', headerText);
  console.log('步骤卡片:', stepTexts);

  // 2) 模拟点击「起卦并排盘」（默认摇卦方式）
  const btns = await evalExpr('[...document.querySelectorAll("button")].map(b=>b.textContent).join(",")');
  console.log('按钮列表:', btns);
  await evalExpr('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("起卦并排盘"))?.click(); "clicked"');
  console.log('已点击起卦，等待排盘…');
  await new Promise((r) => setTimeout(r, 5000));

  // 3) 读取盘面
  const boardTitle = await evalExpr('document.querySelector(".card h2")?.textContent ?? "无"');
  const lines = await evalExpr('[...document.querySelectorAll(".line")].length');
  const rules = await evalExpr('[...document.querySelectorAll(".rule")].map(r=>r.textContent.slice(0,40)).join(" ⏐ ")');
  console.log('排盘后标题:', boardTitle);
  console.log('卦爻行数:', lines);
  console.log('断语条数与内容:', rules.slice(0, 400));

  ws.close();
  const ok = lines > 0 && rules.length > 0;
  console.log(ok ? '\n✅ 端到端功能验证通过：排盘与断语均渲染成功' : '\n❌ 验证失败：盘面或断语未渲染');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('验证失败:', e.message); process.exit(1); });
