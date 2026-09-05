import { describe, expect, it } from 'vitest';
import { castMeihuaByTime, castMeihuaByNumbers, castMeihuaByWords, tiYongRelation, buildMeihuaChart } from './engine.js';
import { wangShuaiOf, meihuaPlugin } from './plugin.js';
import { hexagramFromLines } from '../liuyao/trigrams.js';
import type { NormalizedMoment } from '../../types.js';

function norm(): NormalizedMoment {
  return {
    year: 2024, month: 2, day: 10, hour: 12, minute: 0, second: 0,
    jd: 2460351, jdn: 2460351, tzOffsetHours: 8,
    dayGanZhiIndex: 40, xunKong: '寅卯',
  };
}

describe('梅花易数起卦', () => {
  it('时间起卦 2024-02-10 12:00 → 天山遁四爻动', () => {
    const v = castMeihuaByTime(2024, 2, 10, 12);
    const h = hexagramFromLines(v);
    expect(h.name).toBe('天山遁');
    expect(v[3]).toBe(9);
  });

  it('报数起卦 1,3 → 上乾下离（天火同人）', () => {
    const v = castMeihuaByNumbers(1, 3);
    expect(hexagramFromLines(v).name).toBe('天火同人');
  });

  it('字占起卦不抛错', () => {
    const v = castMeihuaByWords('玄枢');
    expect(v.length).toBe(6);
  });
});

describe('体用生克', () => {
  it('体生用泄（体艮土生用乾金）', () => {
    expect(tiYongRelation('艮', '乾')).toBe('体生用');
  });

  it('比和吉', () => {
    expect(tiYongRelation('乾', '乾')).toBe('比和');
  });

  it('用克体凶（乾金克震木）', () => {
    expect(tiYongRelation('震', '乾')).toBe('用克体');
  });

  it('用生体吉（用艮土生体乾金）', () => {
    expect(tiYongRelation('乾', '艮')).toBe('用生体');
  });

  it('时间卦体用：天山遁四爻动 → 动在上卦，用=上卦乾，体=下卦艮，体生用泄', async () => {
    const v = castMeihuaByTime(2024, 2, 10, 12);
    const chart = await buildMeihuaChart(v, norm());
    expect(chart.benName).toBe('天山遁');
    expect(chart.ti).toBe('艮');
    expect(chart.yong).toBe('乾');
    expect(chart.tiYongRelation).toBe('体生用');
    expect(chart.judgment).toContain('泄');
  });
});

describe('旺相休囚死', () => {
  it('春木当令：木旺、火相、水休、金囚、土死', () => {
    expect(wangShuaiOf('木', '木')).toBe('旺');
    expect(wangShuaiOf('火', '木')).toBe('相');
    expect(wangShuaiOf('水', '木')).toBe('休');
    expect(wangShuaiOf('金', '木')).toBe('囚');
    expect(wangShuaiOf('土', '木')).toBe('死');
  });

  it('夏火当令：火旺、土相', () => {
    expect(wangShuaiOf('火', '火')).toBe('旺');
    expect(wangShuaiOf('土', '火')).toBe('相');
  });
});

describe('梅花断语规则', () => {
  it('规则集含类象/旺衰/应期三条新断', async () => {
    const v = castMeihuaByTime(2024, 2, 10, 12);
    const chart = await buildMeihuaChart(v, norm());
    const rules = await meihuaPlugin.rules(chart, {});
    const ids = rules.map((r) => r.ruleId);
    expect(ids).toContain('meihua.leixiang');
    expect(ids).toContain('meihua.wangshuai');
    expect(ids).toContain('meihua.yingqi');
    expect(ids).toContain(`meihua.tiyong.${chart.tiYongRelation}`);
  });

  it('旺衰断引用农历月令（节气月支）', async () => {
    const v = castMeihuaByTime(2024, 2, 10, 12);
    const chart = await buildMeihuaChart(v, norm());
    const rules = await meihuaPlugin.rules(chart, {});
    const ws = rules.find((r) => r.ruleId === 'meihua.wangshuai')!;
    expect(ws.text).toMatch(/月令旺衰（.月）/);
    expect(ws.text).toContain('体卦');
    expect(ws.text).toContain('用卦');
  });

  it('新断均为 D 级流派说法、无伪引文', async () => {
    const v = castMeihuaByTime(2024, 2, 10, 12);
    const chart = await buildMeihuaChart(v, norm());
    const rules = await meihuaPlugin.rules(chart, {});
    for (const id of ['meihua.leixiang', 'meihua.wangshuai', 'meihua.yingqi']) {
      const r = rules.find((x) => x.ruleId === id)!;
      expect(r.confidenceLevel).toBe('D');
      expect(r.citations.length).toBe(0);
    }
  });
});
