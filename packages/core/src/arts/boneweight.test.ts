import { describe, expect, it } from 'vitest';
import { BONE_SONG, computeBoneWeight } from './boneweight.js';

describe('称骨文化参考', () => {
  it('1971 年正月初一子时为四两四钱', () => {
    const result = computeBoneWeight(1971, 1, 27, 0, 30);
    expect(result.yearGanzhi).toBe('辛亥');
    expect(result.lunarDate).toBe('正月初一');
    expect(result.totalLiang).toBe(4.4);
    expect(result.label).toBe('4两4钱');
    expect(result.poem).toBe(BONE_SONG['4.4']!.poem);
  });

  it('总重严格等于年月日时四项之和', () => {
    const result = computeBoneWeight(1990, 5, 15, 10, 30);
    const total = result.parts.reduce((sum, part) => sum + part.liang, 0);
    expect(result.parts).toHaveLength(4);
    expect(result.totalLiang).toBeCloseTo(total, 10);
    expect(result.disclaimer).toContain('不构成');
  });

  it('完整收录 2.1 至 7.2 两歌诀且每项有白话', () => {
    expect(Object.keys(BONE_SONG)).toHaveLength(52);
    expect(BONE_SONG['2.1']).toBeDefined();
    expect(BONE_SONG['7.2']).toBeDefined();
    for (const song of Object.values(BONE_SONG)) {
      expect(song.poem.length).toBeGreaterThan(20);
      expect(song.plain.length).toBeGreaterThan(8);
    }
  });

  it('拒绝无效公历日期与时间', () => {
    expect(() => computeBoneWeight(2026, 2, 30, 12)).toThrow(RangeError);
    expect(() => computeBoneWeight(2026, 9, 5, 24)).toThrow(RangeError);
    expect(() => computeBoneWeight(1899, 1, 1, 0)).toThrow(RangeError);
  });
});
