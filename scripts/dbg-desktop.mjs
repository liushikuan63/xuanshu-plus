import WebSocket from 'ws';
const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('未找到页面');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
let id = 0;
const call = (m, p) => new Promise((resolve) => {
  const i = ++id;
  const h = (raw) => { const msg = JSON.parse(raw.toString()); if (msg.id === i) { ws.off('message', h); resolve(msg.result); } };
  ws.on('message', h);
  ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const evalE = async (e) => { const r = await call('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r?.result?.value ?? r?.exceptionDetails?.text; };
await evalE('window.xuanshuDesktop.keychain.set("qwen", "sk-明文测试密钥-12345")');
console.log('已写入 qwen key');
ws.close();
