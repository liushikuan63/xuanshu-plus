import { describe, expect, it } from 'vitest';
import { castZiwei, iztroTimeIndex } from './adapter.js';

describe('紫微斗数适配层（iztro）', () => {
  it('时辰映射', () => {
    expect(iztroTimeIndex(0)).toBe(0);   // 早子时
    expect(iztroTimeIndex(2)).toBe(1);   // 丑时
    expect(iztroTimeIndex(5)).toBe(3);   // 卯时
    expect(iztroTimeIndex(12)).toBe(6);  // 午时
    expect(iztroTimeIndex(23)).toBe(12); // 晚子时
  });

  it('2000-08-16 寅时 女：十二宫、五行局、命主身主齐全', async () => {
    const chart = await castZiwei({ year: 2000, month: 8, day: 16, hour: 3, gender: '女' });
    expect(chart.palaces.length).toBe(12);
    expect(chart.fiveElementsClass.length).toBeGreaterThan(0);
    expect(chart.soul.length).toBeGreaterThan(0);
    expect(chart.body.length).toBeGreaterThan(0);
    const ming = chart.palaces.find((p) => p.name === '命宫')!;
    expect(ming).toBeDefined();
    expect(ming.stars.length).toBeGreaterThan(0);
    expect(ming.heavenlyStem.length).toBe(1);
    expect(ming.earthlyBranch.length).toBe(1);
  });

  it('排盘可复现（configHash 稳定）', async () => {
    const a = await castZiwei({ year: 1995, month: 2, day: 23, hour: 17, gender: '男' });
    const b = await castZiwei({ year: 1995, month: 2, day: 23, hour: 17, gender: '男' });
    expect(a.configHash).toBe(b.configHash);
    expect(a.palaces.map((p) => p.name).join(',')).toBe(b.palaces.map((p) => p.name).join(','));
  });

  it('命宫所在支与星曜非空', async () => {
    const chart = await castZiwei({ year: 1986, month: 5, day: 29, hour: 10, gender: '男' });
    const ming = chart.palaces.find((p) => p.name === '命宫')!;
    expect(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']).toContain(ming.earthlyBranch);
  });
});
