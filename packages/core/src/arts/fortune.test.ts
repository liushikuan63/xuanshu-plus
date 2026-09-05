import { describe, expect, it } from 'vitest';
import { fortuneOf } from './fortune.js';

const birth = { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 'male' as const };

describe('个人每日文化参考', () => {
  it('输出四个透明评分维度与黄历依据', async () => {
    const result = await fortuneOf(birth, 2026, 9, 5);
    expect(result.date).toBe('2026-09-05');
    expect(result.dayPillar).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    expect(result.metrics.map((item) => item.label)).toEqual(['关系', '财务', '事业', '状态']);
    expect(result.metrics.every((item) => item.score >= 20 && item.score <= 90)).toBe(true);
    expect(result.metrics.every((item) => item.basis.length >= 2)).toBe(true);
    expect(result.luckyColors.length).toBeGreaterThanOrEqual(2);
    expect(result.luckyNumbers.length).toBeGreaterThanOrEqual(2);
    expect(result.disclaimer).toContain('不构成');
  });

  it('同输入结果完全确定', async () => {
    expect(await fortuneOf(birth, 2026, 9, 5)).toEqual(await fortuneOf(birth, 2026, 9, 5));
  });

  it('不同日期使用不同日柱与黄历依据', async () => {
    const first = await fortuneOf(birth, 2026, 9, 5);
    const next = await fortuneOf(birth, 2026, 9, 6);
    expect(first.dayPillar).not.toBe(next.dayPillar);
    expect(first.date).not.toBe(next.date);
  });

  it('出生日期与目标日期均执行严格校验', async () => {
    await expect(fortuneOf({ ...birth, day: 32 }, 2026, 9, 5)).rejects.toThrow(RangeError);
    await expect(fortuneOf(birth, 2026, 2, 30)).rejects.toThrow(RangeError);
  });
});
