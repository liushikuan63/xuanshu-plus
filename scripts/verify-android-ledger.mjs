import WebSocket from 'ws';

const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('未找到 WebView 页面');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
let id = 0;
const call = (m, p) => new Promise((resolve) => {
  const i = ++id;
  const h = (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id === i) { ws.off('message', h); resolve(msg.result); }
  };
  ws.on('message', h);
  ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const evalE = async (e) => { const r = await call('Runtime.evaluate', { expression: e, returnByValue: true }); return r?.result?.value; };

const btnText = await evalE('[...document.querySelectorAll("button")].map(b=>b.textContent).join(",")');
console.log('存档按钮存在:', btnText.includes('存档到案例本'));
await evalE('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("存档到案例本"))?.click(); "ok"');
await new Promise((r) => setTimeout(r, 1500));
const okMsg = await evalE('document.querySelector(".ok")?.textContent ?? "未出现"');
console.log('存档提示:', okMsg);
const casesCount = await evalE('document.querySelectorAll(".cases li").length');
console.log('案例本列表条目:', casesCount);
ws.close();
const savedOrDuplicate = okMsg.includes('已存档') || okMsg.includes('重复存档');
console.log((savedOrDuplicate && casesCount >= 1) ? '\n✅ 存档链路验证通过' : '\n❌ 存档验证失败');
process.exit(savedOrDuplicate && casesCount >= 1 ? 0 : 1);
