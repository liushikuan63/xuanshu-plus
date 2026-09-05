import WebSocket from 'ws';
const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('未找到 WebView 页面');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
let id = 0;
const call = (m, p) => new Promise((resolve) => {
  const i = ++id;
  const h = (raw) => { const msg = JSON.parse(raw.toString()); if (msg.id === i) { ws.off('message', h); resolve(msg.result); } };
  ws.on('message', h);
  ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const evalE = async (e) => { const r = await call('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const out = [];
const check = (n, ok, d = '') => { out.push([n, ok, d]); console.log(`${ok ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`); };

// KB 状态
const kbText = await evalE('document.querySelector(".meta")?.textContent ?? ""');
check('内置知识库载入完成（14200 段）', kbText.includes('14200'), kbText.slice(0, 70));

// 六爻排盘
await evalE('[...document.querySelectorAll("button")].find(b=>b.textContent==="六爻")?.click(); "ok"');
await sleep(300);
await evalE('[...document.querySelectorAll("button")].find(b=>b.textContent==="排盘")?.click(); "ok"');
await sleep(4500);
const rules = await evalE('[...document.querySelectorAll(".rule")].map(r=>r.textContent)');
const originCount = await evalE('[...document.querySelectorAll(".origin")].length');
const zsbyHits = rules.filter((t) => t.includes('如甲子至癸酉日为一旬') || t.includes('月建冲之为月破') || t.includes('静而逢值逢冲') || t.includes('动而逢合逢值')).length;
check('六爻：原文内联条数', originCount >= 4, `${originCount} 处`);
check('六爻：《增删卜易》原文回链（旬空/月破/应期）', zsbyHits >= 2, `${zsbyHits} 处`);
console.log('增删卜易原文样例：');
for (const t of rules) if (t.includes('静而逢值逢冲') || t.includes('如甲子至癸酉日为一旬')) console.log(`  ${t.slice(0, 70)}…`);

// 四术仍可用
for (const [tab, key] of [['八字', '日主'], ['紫微斗数', '五行局'], ['梅花易数', '体卦']]) {
  await evalE(`[...document.querySelectorAll("button")].find(b=>b.textContent==="${tab}")?.click(); "ok"`);
  await sleep(300);
  await evalE('[...document.querySelectorAll("button")].find(b=>b.textContent==="排盘")?.click(); "ok"');
  await sleep(tab === '紫微斗数' ? 6500 : 4000);
  const has = await evalE(`[...document.querySelectorAll(".rule")].some(r=>r.textContent.includes("${key}"))`);
  check(`${tab}：${key} 断语`, !!has);
}

ws.close();
const failed = out.filter((o) => !o[1]).length;
console.log(failed === 0 ? '\n🎉 知识库扩展验证全部通过' : `\n⚠ ${failed} 项未通过`);
process.exit(failed === 0 ? 0 : 1);
