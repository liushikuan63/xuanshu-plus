/**
 * 抓取 diancang.xyz 书籍全文章节 → data/.kb/books/<dir>/source.txt
 * 用法：node scripts/fetch-diancang.mjs <dir> <书名> <起始id> <结束id>
 *   - 黄金策：node scripts/fetch-diancang.mjs huangjince 黄金策 41083 41116
 *   - 易冒：  node scripts/fetch-diancang.mjs yimao 易冒 62630 62640
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const [dir, book, startStr, endStr] = process.argv.slice(2);
if (!dir || !book || !startStr || !endStr) { console.log('用法见文件头'); process.exit(1); }
const start = Number(startStr);
const end = Number(endStr);

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36', Referer: 'https://www.diancang.xyz/' } });
  clearTimeout(t);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
function toText(html) {
  let body = html;
  const m = html.match(/<(?:div|article)[^>]*(?:class|id)="[^"]*(?:content|zoom|article|nr|text)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article)>/i);
  if (m) body = m[1];
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const title = h1 ? h1[1].replace(/<[^>]+>/g, '').trim() : '';
  const text = body
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
  return { title, text };
}

let full = '';
let okCount = 0;
for (let id = start; id <= end; id++) {
  try {
    const html = await get(`https://www.diancang.xyz/xuanxuewushu/${dir}/${id}.html`);
    const { title, text } = toText(html);
    const startIdx = text.indexOf(book);
    const body = (startIdx >= 0 ? text.slice(startIdx) : text).trim();
    full += `\n\n【${title || book}】\n${body}`;
    okCount += 1;
    console.log(`✓ ${title}: ${body.length} 字`);
  } catch (e) {
    console.log(`✗ id=${id}: ${e.message}`);
  }
}
console.log(`合计 ${okCount} 章, ${full.length} 字`);
if (full.length > 10000) {
  mkdirSync(`data/.kb/books/${dir}`, { recursive: true });
  writeFileSync(`data/.kb/books/${dir}/source.txt`, full, 'utf-8');
  console.log(`已写入 data/.kb/books/${dir}/source.txt`);
}
