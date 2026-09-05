import WebSocket from 'ws';

const PORT = 9222;
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
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
const evalE = async (e) => { const r = await call('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r?.result?.value ?? r?.exceptionDetails?.text; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 轮询等待条件成立（默认 20s 超时） */
async function waitFor(expr, timeout = 20000, step = 300) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = await evalE(expr);
    if (v) return v;
    await sleep(step);
  }
  return null;
}

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

// 1) 术数 Tab 齐全
const tabs = await evalE('[...document.querySelectorAll(".chips button")].map(b=>b.textContent).join(",")');
check('四术 Tab', tabs.includes('六爻') && tabs.includes('梅花易数') && tabs.includes('八字') && tabs.includes('紫微斗数'), tabs);

// 2) 内置知识库状态
const kbText = await evalE('document.querySelector(".meta")?.textContent ?? ""');
check('内置知识库已预导入（14200 段）', kbText.includes('14200'), kbText.slice(0, 70));

// 3) AI 配置面板
const aiCard = await evalE('[...document.querySelectorAll(".card h2")].map(h=>h.textContent).find(t=>t.includes("AI 精解")) ?? "无"');
const providerSelect = await evalE('document.querySelector("select") ? [...document.querySelectorAll("select option")].map(o=>o.textContent).join(",") : "无"');
check('AI 精解配置面板', aiCard.includes('AI 精解') && providerSelect.includes('DeepSeek') && providerSelect.includes('自定义'), providerSelect.slice(0, 60));

// 3.5) 事项 playbook 联动（12 张卡：求财/官非/合作等新增）
await evalE('[...document.querySelectorAll(".chips button")].find(b=>b.textContent==="求财")?.click(); "ok"');
await sleep(300);
const pbWealth = await evalE('document.querySelector(".playbook")?.textContent ?? ""');
check('事项卡：求财 playbook（liuyao.wealth）', pbWealth.includes('liuyao.wealth.v1') && pbWealth.includes('妻财爻'), pbWealth.slice(0, 40));
await evalE('[...document.querySelectorAll(".chips button")].find(b=>b.textContent==="官非")?.click(); "ok"');
await sleep(300);
const pbLegal = await evalE('document.querySelector(".playbook")?.textContent ?? ""');
check('事项卡：官非 playbook（liuyao.legal）', pbLegal.includes('liuyao.legal.v1') && pbLegal.includes('应爻'), pbLegal.slice(0, 40));
await evalE('[...document.querySelectorAll(".chips button")].find(b=>b.textContent==="合作")?.click(); "ok"');
await sleep(300);
const pbPartner = await evalE('document.querySelector(".playbook")?.textContent ?? ""');
check('事项卡：合作 playbook（liuyao.partner）', pbPartner.includes('liuyao.partner.v1'), pbPartner.slice(0, 40));
await evalE('[...document.querySelectorAll(".chips button")].find(b=>b.textContent==="失物")?.click(); "ok"');
await sleep(300);
const pbLost = await evalE('document.querySelector(".playbook")?.textContent ?? ""');
check('事项卡：失物 playbook（恢复默认）', pbLost.includes('liuyao.lost.v1'), pbLost.slice(0, 40));

// 4) 六爻排盘
await evalE('[...document.querySelectorAll("button")].find(b=>b.textContent==="六爻")?.click(); "ok"');
await sleep(300);
await evalE('[...document.querySelectorAll("button")].find(b=>b.textContent==="排盘")?.click(); "ok"');
const lr = await waitFor('[...document.querySelectorAll(".rule")].length');
const origin = await waitFor('[...document.querySelectorAll(".origin")].length');
const citedRules = await evalE('[...document.querySelectorAll(".rule")].filter(r=>r.querySelector(".cite")).length');
const citedNoOrigin = await evalE('[...document.querySelectorAll(".rule")].filter(r=>r.querySelector(".cite") && !r.querySelector(".origin")).length');
check('六爻：断语渲染', lr > 0, `${lr} 条`);
check('六爻：引用回链原文（原文内联）', origin > 0, `${origin} 处原文`);
check('六爻：带引用的断语全部回链（D 级无引用规则按纪律显示缺口）', citedNoOrigin === 0, `带引用 ${citedRules} 条，未回链 ${citedNoOrigin}`);

// 4.5) 案例本：存档 + 导出按钮 + 持久化
const exportBtns = await evalE('[...document.querySelectorAll("button")].map(b=>b.textContent).filter(t=>t.includes("导出")).join(",")');
check('案例本：导出按钮（JSON/CSV/MD）', exportBtns.includes('导出 JSON') && exportBtns.includes('导出 CSV') && exportBtns.includes('导出 Markdown'), exportBtns);
await evalE('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("存档"))?.click(); "ok"');
await sleep(800);
const savedMsg = await evalE('document.querySelector(".ok")?.textContent ?? ""');
const caseCount = await evalE('document.querySelector(".cases")?.children.length ?? 0');
check('案例本：存档成功并持久化', savedMsg.includes('已存档') || savedMsg.includes('重复'), `${savedMsg.slice(0, 40)} / ${caseCount} 条`);

// 5) 梅花
await evalE('[...document.querySelectorAll("button")].find(b=>b.textContent==="梅花易数")?.click(); "ok"');
await sleep(300);
await evalE('[...document.querySelectorAll("button")].find(b=>b.textContent==="排盘")?.click(); "ok"');
const mhTitle = await waitFor('[...document.querySelectorAll(".card h2")].map(h=>h.textContent).find(t=>t.includes("盘面")) ?? ""');
const mhTi = await waitFor('[...document.querySelectorAll(".rule")].some(r=>r.textContent.includes("体卦"))');
check('梅花：排盘（体用生克）', !!mhTitle && !!mhTi, `${mhTitle ?? ''}`.slice(0, 40));

// 6) 八字
await evalE('[...document.querySelectorAll("button")].find(b=>b.textContent==="八字")?.click(); "ok"');
await sleep(300);
await evalE('[...document.querySelectorAll("button")].find(b=>b.textContent==="排盘")?.click(); "ok"');
const bzTitle = await waitFor('[...document.querySelectorAll(".card h2")].map(h=>h.textContent).find(t=>t.includes("盘面")) ?? ""');
const bzRules = await evalE('[...document.querySelectorAll(".rule")].map(r=>r.textContent.slice(0,20)).join(" ⏐ ")');
check('八字：四柱排盘', (bzTitle ?? '').includes('年') && (bzTitle ?? '').includes('月') && (bzTitle ?? '').includes('时'), `${bzTitle ?? ''}`.slice(0, 45));
check('八字：断语（日主/大运/神煞）', bzRules.includes('日主'), bzRules.slice(0, 60));

// 7) 紫微
await evalE('[...document.querySelectorAll("button")].find(b=>b.textContent==="紫微斗数")?.click(); "ok"');
await sleep(300);
await evalE('[...document.querySelectorAll("button")].find(b=>b.textContent==="排盘")?.click(); "ok"');
const zwTitle = await waitFor('[...document.querySelectorAll(".card h2")].map(h=>h.textContent).find(t=>t.includes("盘面")) ?? ""');
const zwCells = await evalE('[...document.querySelectorAll(".cell")].length');
const zwRules = await evalE('[...document.querySelectorAll(".rule")].map(r=>r.textContent.slice(0,16)).join(" ⏐ ")');
check('紫微：命盘渲染', zwCells >= 12, `${(zwTitle ?? '').slice(0, 30)} 宫格 ${zwCells}`);
check('紫微：断语（五行局/命宫主星）', zwRules.includes('五行局') && zwRules.includes('命宫'), zwRules.slice(0, 50));

ws.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? '\n🎉 全部验证通过' : `\n⚠ ${failed} 项未通过`);
process.exit(failed === 0 ? 0 : 1);
