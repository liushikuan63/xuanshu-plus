import { mkdirSync, writeFileSync } from 'node:fs';
async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36', Referer: 'https://www.diancang.xyz/' } });
  clearTimeout(t);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
function toText(html) {
  // 提取文章正文：常见于 <div class="content"> 或 <div id="zoom"> 等
  let body = html;
  const m = html.match(/<(?:div|article)[^>]*(?:class|id)="[^"]*(?:content|zoom|article|nr|text)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article)>/i);
  if (m) body = m[1];
  return body
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/&hellip;/g, '…')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
const ids = [
  ['卜筮正宗凡例', 38408],
  ['卜筮正宗目录', 38409],
  ['卜筮正宗一', 38411],
  ['卜筮正宗二', 38412],
  ['卜筮正宗三', 38413],
  ['卜筮正宗四', 38414],
  ['卜筮正宗五', 38415],
];
let full = '';
for (const [name, id] of ids) {
  try {
    const html = await get(`https://www.diancang.xyz/xuanxuewushu/boshizhengzong/${id}.html`);
    const text = toText(html);
    // 去掉开头导航
    const start = text.indexOf('卜筮正宗');
    const body = start >= 0 ? text.slice(start) : text;
    full += `\n\n【${name}】\n${body}`;
    console.log(`✓ ${name}: ${body.length} 字`);
  } catch (e) { console.log(`✗ ${name}: ${e.message}`); }
}
console.log('合计:', full.length, '字');
if (full.length > 30000) {
  mkdirSync('data/.kb/books/卜筮正宗', { recursive: true });
  writeFileSync('data/.kb/books/卜筮正宗/source.txt', full, 'utf-8');
  console.log('已写入 source.txt');
  console.log('开头 160 字:', full.slice(0, 160).replace(/\s+/g, ' '));
}
