import { describe, expect, it } from 'vitest';
import { almanacMonth, almanacOf, almanacSummary } from './almanac.js';

describe('离线黄历', () => {
  it('输出可稳定展示的完整日字段', () => {
    const day = almanacOf(2026, 9, 5);
    expect(day.date).toBe('2026-09-05');
    expect(day.week).toBe('星期六');
    expect(day.lunarDate).toMatch(/月/);
    expect(day.dayGanzhi).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    expect(day.constellation).toBe('处女座');
    expect(day.yi.length).toBeGreaterThan(0);
    expect(day.ji.length).toBeGreaterThan(0);
    expect(almanacSummary(day)).toContain('宜');
    expect(almanacSummary(day)).toContain('忌');
  });

  it('闰年与平年月份天数正确', () => {
    expect(almanacMonth(2024, 2)).toHaveLength(29);
    expect(almanacMonth(2025, 2)).toHaveLength(28);
    expect(almanacMonth(2026, 9).map((day) => day.date)).toEqual(
      Array.from({ length: 30 }, (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`),
    );
  });

  it('拒绝无效日期而不是交给底层静默归一化', () => {
    expect(() => almanacOf(2026, 2, 30)).toThrow('无效公历日期');
    expect(() => almanacMonth(2026, 13)).toThrow('无效公历月份');
  });
});
