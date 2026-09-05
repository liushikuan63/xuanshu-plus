#!/usr/bin/env node
/**
 * 黄金样本生成/校验（§7.2）：六爻与八字核心样本。
 * 用法：node --experimental-strip-types scripts/golden.mjs [--art=liuyao]
 */
import { buildChart } from '../src/arts/liuyao/engine.ts';
import { buildBazi } from '../src/arts/bazi/engine.ts';

const LIUYAO_SAMPLES = [
  { date: '2024-02-10T12:00:00+08:00', values: '777777', expect: '乾为天', expectBian: null },
  { date: '2024-02-10T12:00:00+08:00', values: '000111', expect: '天地否', expectBian: null },
  { date: '2024-02-10T12:00:00+08:00', values: '777797', expect: '乾为天', expectBian: '火天大有' },
];

const BAZI_SAMPLES = [
  { date: '2024-02-10T12:00:00+08:00', gender: 'male', expect: '甲辰年 丙寅月 甲辰日 庚午时' },
  { date: '2000-01-01T12:00:00+08:00', gender: 'male', expect: '己卯年 丙子月 戊午日 戊午时' },
  { date: '1984-02-02T12:00:00+08:00', gender: 'male', expect: '癸亥年 乙丑月 丙寅日 甲午时' },
];

function parse(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):00\+08:00$/.exec(dateStr);
  return { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5] };
}

const art = process.argv.find((a) => a.startsWith('--art='))?.slice(6) ?? 'all';
let failed = 0;

if (art === 'liuyao' || art === 'all') {
  for (const s of LIUYAO_SAMPLES) {
    const { year, month, day, hour, minute } = parse(s.date);
    const normalized = { year, month, day, hour, minute, second: 0, jd: 0, jdn: 0, tzOffsetHours: 8, dayGanZhiIndex: 0, xunKong: '' };
    const chart = await buildChart([...s.values].map(Number), normalized);
    const ok = chart.benName === s.expect && (s.expectBian === undefined || chart.bianName === s.expectBian);
    if (!ok) {
      failed += 1;
      console.error(`✗ liuyao ${s.date} ${s.values} → ${chart.benName}${chart.bianName ? ` 之 ${chart.bianName}` : ''}（期望 ${s.expect}${s.expectBian ? ` 之 ${s.expectBian}` : ''}）`);
    } else {
      console.log(`✓ liuyao ${s.date} ${s.values} → ${chart.benName}${chart.bianName ? ` 之 ${chart.bianName}` : ''}`);
    }
  }
}

if (art === 'bazi' || art === 'all') {
  for (const s of BAZI_SAMPLES) {
    const { year, month, day, hour, minute } = parse(s.date);
    const chart = await buildBazi({ year, month, day, hour, minute, gender: s.gender });
    const got = `${chart.year.gan}${chart.year.zhi}年 ${chart.month.gan}${chart.month.zhi}月 ${chart.day.gan}${chart.day.zhi}日 ${chart.hour.gan}${chart.hour.zhi}时`;
    const ok = got === s.expect;
    if (!ok) {
      failed += 1;
      console.error(`✗ bazi ${s.date} → ${got}（期望 ${s.expect}）`);
    } else {
      console.log(`✓ bazi ${s.date} → ${got}`);
    }
  }
}

if (failed > 0) {
  console.error(`golden 校验失败：${failed} 条`);
  process.exit(1);
}
console.log('✓ golden 全部通过');
