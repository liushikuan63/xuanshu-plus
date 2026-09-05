import { describe, expect, it } from 'vitest';
import { baziLifeTrends, baziCurrentYearNote } from './lifetrend.js';
import { buildBazi } from './engine.js';

async function chartOf(y: number, mo: number, d: number, h: number, gender: 'male' | 'female') {
  return buildBazi({ year: y, month: mo, day: d, hour: h, gender });
}

describe('八字一生趋势', () => {
  it('甲辰 2024-02-10 男：8 步大运逐段白话，旺/平/弱标注', async () => {
    const c = await chartOf(2024, 2, 10, 12, 'male');
    const { trends, summary } = baziLifeTrends(c);
    expect(trends.length).toBe(8);
    for (const t of trends) {
      expect(['旺', '平', '弱']).toContain(t.trend);
      expect(t.note.length).toBeGreaterThan(4); // 白话说明非空
      expect(t.ganZhi).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    }
    expect(summary).toContain('这一生');
    expect(summary).toContain('校准');
    // 首步大运应衔接起运年龄（显示取整）
    expect(trends[0]!.startAge).toBe(Math.round(c.qiyun.age));
  });

  it('当前流年一句白话（取激活大运）', async () => {
    const c = await chartOf(2024, 2, 10, 12, 'male');
    const note = baziCurrentYearNote(c, c.dayun[0]!.startYear + 3);
    expect(note).toContain('大运');
    expect(note).toContain('：');
  });

  it('身弱日主喜印比：大运取喜忌方向与身强相反', async () => {
    const strong = await chartOf(2024, 2, 10, 12, 'male');
    const weak = await chartOf(2000, 1, 1, 12, 'male');
    const { summary: s1 } = baziLifeTrends(strong);
    const { summary: s2 } = baziLifeTrends(weak);
    expect(s1).toContain('日主偏强');
    expect(s2).toContain('日主偏弱');
  });
});