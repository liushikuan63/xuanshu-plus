import { describe, expect, it } from 'vitest';
import { castLiuyao } from './arts/liuyao/engine.js';
import { castQimen } from './arts/qimen/engine.js';
import { timelineForChart } from './timing.js';

const ctx = { now: new Date(2026, 8, 5, 12), random: () => 0.6, tzOffsetHours: 8 };

describe('带日期应期时间轴', () => {
  it('六爻只输出有盘面依据的未来日期', async () => {
    const chart = await castLiuyao({ kind: 'manual', text: '987678' }, ctx);
    const timeline = timelineForChart('liuyao', chart, 30)!;
    expect(timeline.from).toBe('2026-09-05');
    expect(timeline.entries.length).toBeGreaterThan(0);
    for (const entry of timeline.entries) {
      expect(entry.offsetDays).toBeGreaterThan(0);
      expect(entry.offsetDays).toBeLessThanOrEqual(30);
      expect(entry.basis.length).toBeGreaterThan(1);
      expect(entry.date).toMatch(/^2026-\d{2}-\d{2}$/);
    }
    expect(timeline.entries.some((entry) => entry.ruleId === 'liuyao.timeline.moving-value')).toBe(true);
    expect(timeline.entries.map((entry) => entry.date)).toEqual([...timeline.entries.map((entry) => entry.date)].sort());
  });

  it('奇门包含宫支和三奇窗口', async () => {
    const chart = await castQimen({ kind: 'time', time: { year: 2026, month: 9, day: 5, hour: 12, minute: 0 } }, ctx);
    const timeline = timelineForChart('qimen', chart, 30)!;
    expect(timeline.entries.some((entry) => entry.ruleId === 'qimen.timeline.sanqi-day')).toBe(true);
    if (chart.hourGanPalace !== 5) {
      expect(timeline.entries.some((entry) => entry.ruleId.startsWith('qimen.timeline.hour-palace'))).toBe(true);
    }
    expect(new Set(timeline.entries.map((entry) => `${entry.date}|${entry.ruleId}|${entry.label}`)).size).toBe(timeline.entries.length);
  });

  it('不为依据不足的术数编造日期，并校验范围', () => {
    expect(timelineForChart('bazi', {})).toBeNull();
    expect(() => timelineForChart('liuyao', {}, 0)).toThrow('1 至 366 天');
  });
});
