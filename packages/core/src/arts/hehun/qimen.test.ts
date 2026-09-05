import { describe, expect, it } from 'vitest';
import { qimenRelationshipOf } from './qimen.js';

const moment = { year: 2026, month: 9, day: 5, hour: 14, minute: 30 };

describe('奇门关系分析', () => {
  it('输出五个固定维度与透明分值影响', async () => {
    const result = await qimenRelationshipOf(moment);
    expect(result.items.map((item) => item.id)).toEqual(['yi', 'geng', 'relation', 'liuhe', 'leaders']);
    expect(result.items.every((item) => item.basis.length > 0)).toBe(true);
    expect(result.items.every((item) => Number.isFinite(item.scoreEffect))).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.score).toBeLessThanOrEqual(90);
  });

  it('保留完整奇门盘并定位乙庚六合', async () => {
    const result = await qimenRelationshipOf(moment);
    expect(result.chart.palaces).toHaveLength(9);
    expect(result.items.find((item) => item.id === 'yi')?.detail).not.toContain('未定位');
    expect(result.items.find((item) => item.id === 'geng')?.detail).not.toContain('未定位');
    expect(result.items.find((item) => item.id === 'liuhe')?.detail).not.toContain('未定位');
  });

  it('固定问事时刻时结果可复现', async () => {
    expect(await qimenRelationshipOf(moment)).toEqual(await qimenRelationshipOf(moment));
  });

  it('不输出性别绑定或第三方推断', async () => {
    const result = await qimenRelationshipOf(moment);
    expect(result.disclaimer).toContain('不映射现实性别');
    expect(JSON.stringify(result.items)).not.toMatch(/男方|女方|第三者|介入/);
  });

  it('拒绝无效日期与时间', async () => {
    await expect(qimenRelationshipOf({ ...moment, day: 31 })).rejects.toThrow(RangeError);
    await expect(qimenRelationshipOf({ ...moment, hour: 24 })).rejects.toThrow(RangeError);
  });
});
