import { describe, expect, it } from 'vitest';
import { buildBazi } from '../bazi/engine.js';
import { baziJingPi } from './bazi.js';

async function sampleChart() {
  return buildBazi({ year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 'male' });
}

describe('八字分层解读', () => {
  it('输出六个有依据的解读层级', async () => {
    const result = baziJingPi(await sampleChart(), 2026);
    expect(result.sections.map((section) => section.id)).toEqual([
      'pillars', 'elements', 'tenGods', 'markers', 'periods', 'boneWeight',
    ]);
    expect(result.sections.every((section) => section.basis.length > 0)).toBe(true);
    expect(result.sections.every((section) => ['C', 'D'].includes(section.evidenceLevel))).toBe(true);
    expect(result.disclaimer).toContain('不构成');
  });

  it('五行基础计数严格对应四柱八个字', async () => {
    const result = baziJingPi(await sampleChart(), 2026);
    expect(Object.values(result.elementCounts).reduce((sum, count) => sum + count, 0)).toBe(8);
    expect(result.stemRoles).toHaveLength(4);
    expect(result.stemRoles[2]?.role).toBe('比肩');
  });

  it('合并称骨与当前大运但不输出确定性恐吓措辞', async () => {
    const result = baziJingPi(await sampleChart(), 2026);
    expect(result.boneWeight.parts).toHaveLength(4);
    expect(result.activePeriod).not.toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/必然|一定会|大灾|大病年/);
  });

  it('固定输入与参考年份时结果可复现', async () => {
    const chart = await sampleChart();
    expect(baziJingPi(chart, 2026)).toEqual(baziJingPi(chart, 2026));
  });

  it('拒绝无效参考年份', async () => {
    const chart = await sampleChart();
    expect(() => baziJingPi(chart, 1899)).toThrow(RangeError);
    expect(() => baziJingPi(chart, 2026.5)).toThrow(RangeError);
  });
});
