import { describe, expect, it } from 'vitest';
import { civilJdn } from '../astronomy/jde.js';
import { normalizeBazi } from '../arts/bazi/engine.js';
import { normalizeJinKou } from '../arts/jinkou/engine.js';
import { normalizeLiuRen } from '../arts/liuren/engine.js';
import { normalizeLiuyao } from '../arts/liuyao/engine.js';
import { normalizeMeihua } from '../arts/meihua/engine.js';
import { normalizeQimen } from '../arts/qimen/engine.js';
import { normalizeSmallLiuRen } from '../arts/xiaoliuren/engine.js';
import { normalizeZiwei } from '../arts/ziwei/adapter.js';
import { dayGanZhiFromJdn } from './ganzhi.js';

const ctx = { now: new Date(2024, 1, 10, 1, 30), random: () => 0.5, tzOffsetHours: 8 };
const input = {
  kind: 'time' as const,
  time: { year: 2024, month: 2, day: 10, hour: 1, minute: 30, tzOffsetHours: 8 },
};

describe('本地民用日期日界线', () => {
  it('东八区清晨仍以输入的 2 月 10 日定日柱', async () => {
    const expectedJdn = civilJdn(2024, 2, 10);
    const expectedIndex = dayGanZhiFromJdn(expectedJdn).index;
    const results = await Promise.all([
      normalizeBazi(input, ctx, 8),
      normalizeLiuyao(input, ctx, 8),
      normalizeMeihua(input, ctx, 8),
      normalizeSmallLiuRen(input, ctx, 8),
      normalizeQimen(input, ctx, 8),
      normalizeLiuRen(input, ctx, 8),
      normalizeJinKou(input, ctx, 8),
      normalizeZiwei(input, ctx, 8),
    ]);
    for (const result of results) {
      expect(result.jdn).toBe(expectedJdn);
      expect(result.dayGanZhiIndex).toBe(expectedIndex);
      expect(result.dayGanZhiIndex).toBe(40); // 甲辰
    }
  });

  it('时区影响绝对时刻 JD，但不改变明确输入的本地公历日', async () => {
    const east = await normalizeLiuyao(input, ctx, 8);
    const utc = await normalizeLiuyao({ ...input, time: { ...input.time, tzOffsetHours: 0 } }, ctx, 0);
    expect(east.jd).not.toBe(utc.jd);
    expect(east.jdn).toBe(utc.jdn);
    expect(east.dayGanZhiIndex).toBe(utc.dayGanZhiIndex);
  });
});
