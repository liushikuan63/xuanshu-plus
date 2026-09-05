#!/usr/bin/env node
/**
 * 历法校准报告（§4.1）：1900–2100 节气与 lunar-javascript 交叉比对，输出差异报告。
 * 用法：node --experimental-strip-types scripts/cal-report.mjs
 */
import { SOLAR_TERMS, solarTerm } from '../src/calendar/solarTerms.ts';
import { Solar } from 'lunar-javascript';

const TERM_PINYIN = {
  小寒: 'XIAO_HAN', 大寒: 'DA_HAN', 立春: 'LI_CHUN', 雨水: 'YU_SHUI', 惊蛰: 'JING_ZHE', 春分: 'CHUN_FEN',
  清明: 'QING_MING', 谷雨: 'GU_YU', 立夏: 'LI_XIA', 小满: 'XIAO_MAN', 芒种: 'MANG_ZHONG', 夏至: 'XIA_ZHI',
  小暑: 'XIAO_SHU', 大暑: 'DA_SHU', 立秋: 'LI_QIU', 处暑: 'CHU_SHU', 白露: 'BAI_LU', 秋分: 'QIU_FEN',
  寒露: 'HAN_LU', 霜降: 'SHUANG_JIANG', 立冬: 'LI_DONG', 小雪: 'XIAO_XUE', 大雪: 'DA_XUE', 冬至: 'DONG_ZHI',
};

function lunarRef(year, termName) {
  const l = Solar.fromYmd(year, 6, 1).getLunar();
  const table = l.getJieQiTable();
  const keys = Object.keys(table).filter((k) => k === termName || k === TERM_PINYIN[termName]);
  for (const k of keys) {
    const s = table[k];
    const y = parseInt(s.toYmdHms().slice(0, 4), 10);
    if (y === year) {
      const parts = s.toYmdHms().split(/[- :]/);
      return parseInt(parts[3], 10) + parseInt(parts[4], 10) / 60 + parseInt(parts[5], 10) / 3600;
    }
  }
  return null;
}

const [fromYear = 1900, toYear = 2100] = process.argv.slice(2).map(Number);

let maxDiff = 0;
let worst = null;
let degraded = 0;
let total = 0;

for (let year = fromYear; year <= toYear; year++) {
  for (const term of SOLAR_TERMS) {
    const ours = await solarTerm(year, term);
    const refHour = lunarRef(year, term);
    if (refHour === null) continue;
    total += 1;
    const diff = Math.abs(ours.localHour - refHour) * 60;
    if (diff > maxDiff) {
      maxDiff = diff;
      worst = { year, term, ours: ours.localHour, ref: refHour };
    }
    if (diff > 2) {
      degraded += 1;
      console.log(`⚠ ${year} ${term} 差 ${diff.toFixed(1)} 分钟（自研 ${ours.localHour.toFixed(2)} vs lunar ${refHour.toFixed(2)}）`);
    }
  }
}

console.log(`\n校准报告：${fromYear}–${toYear} 共 ${total} 条节气比对`);
console.log(`最大分钟差：${maxDiff.toFixed(2)}${worst ? `（${worst.year} ${worst.term}）` : ''}`);
console.log(`超过 2 分钟阈值的条数：${degraded}`);
if (degraded > 0) {
  console.log('→ 建议进入分歧台账并优先采用外部库值（§4.2）');
  process.exit(1);
}
console.log('✓ 全部在 2 分钟阈值内');
