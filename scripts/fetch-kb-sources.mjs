import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

async function getArrayBuffer(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
  clearTimeout(t);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.arrayBuffer();
}

function decode(buf) {
  // 先试 UTF-8；若替换符过多则用 GBK
  const utf8 = new TextDecoder('utf-8').decode(buf);
  const bad = (utf8.match(/\uFFFD/g) ?? []).length;
  if (bad < Math.max(5, utf8.length / 200)) return { text: utf8, enc: 'utf-8' };
  return { text: new TextDecoder('gbk').decode(buf), enc: 'gbk' };
}

const names = ['卜筮正宗-清-王洪绪.txt', '京氏易传-汉-京房.txt', '易冒-清-程良玉.txt', '易林补遗-明-张世宝.txt'];
for (const name of names) {
  const encoded = encodeURIComponent(name);
  const url = `https://cdn.jsdelivr.net/gh/bho1668/yibook@master/${encoded}`;
  try {
    const buf = await getArrayBuffer(url);
    const { text, enc } = decode(buf);
    const dirName = name.replace(/-.*$/, '');
    const dir = `data/.kb/books/${dirName}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/source.txt`, text, 'utf-8');
    console.log(`✓ ${dirName}（${enc}）: ${text.length} 字符`);
    console.log(`  开头: ${text.slice(0, 60).replace(/\s+/g, ' ')}`);
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`);
  }
}
