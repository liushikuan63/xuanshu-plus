import { describe, expect, it } from 'vitest';
import { baziHehunOf } from './bazi.js';

const first = { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 'male' as const };
const second = { year: 1992, month: 8, day: 22, hour: 14, minute: 0, gender: 'female' as const };

describe('双人八字合婚', () => {
  it('输出七个独立维度和透明分值影响', async () => {
    const result = await baziHehunOf(first, second);
    expect(result.items.map((item) => item.id)).toEqual([
      'zodiac', 'nayin', 'dayStem', 'spousePalace', 'favorable', 'elements', 'markers',
    ]);
    expect(result.items.every((item) => Number.isFinite(item.scoreEffect))).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.score).toBeLessThanOrEqual(90);
    expect(result.disclaimer).toContain('不给出宜婚');
  });

  it('同输入结果完全确定', async () => {
    expect(await baziHehunOf(first, second)).toEqual(await baziHehunOf(first, second));
  });

  it('双方顺序调换不改变综合分', async () => {
    const normal = await baziHehunOf(first, second);
    const swapped = await baziHehunOf(second, first);
    expect(swapped.score).toBe(normal.score);
  });

  it('返回双方完整四柱摘要', async () => {
    const result = await baziHehunOf(first, second);
    expect(result.pair.first.split(' ')).toHaveLength(4);
    expect(result.pair.second.split(' ')).toHaveLength(4);
    expect(result.summary).toContain('七项');
  });
});
