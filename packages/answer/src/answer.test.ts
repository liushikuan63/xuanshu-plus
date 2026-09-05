import { describe, expect, it } from 'vitest';
import { composeAnswer } from './composer.js';
import { safetyCheck, antiInferenceCheck, DISCLAIMER } from './safety.js';
import { templateFor } from './templates.js';
import { timingCandidatesOf } from './timing.js';
import type { CitationRef } from '@xuanshu/core';

const cite: CitationRef = {
  canonicalId: 'zengshanbuyi',
  book: '增删卜易',
  edition: '通行整理本',
  chapter: '失物章',
  segId: 'zsby.3.12',
  quote: '用神宜旺，不宜空破',
  license: '公有领域',
  confidenceLevel: 'A',
};

describe('四层答复装配', () => {
  it('模板 + 规则 + 应期 + 证据 + 免责', () => {
    const tpl = templateFor('liuyao.generic.v1')!;
    const answer = composeAnswer({
      template: tpl,
      facts: [],
      ruleHits: [
        { ruleId: 'liuyao.xunkong', text: '财爻旬空，待出空填实', confidenceLevel: 'D', citations: [], severity: '变数' },
      ],
      timingCandidates: [
        { ruleId: 'liuyao.timing', text: '财爻出空之日可见', citations: [cite], confidenceLevel: 'B', window: '待出空' },
      ],
      evidence: [{ segment: '用神宜旺，不宜空破。', citation: cite, score: 3.2 }],
      questionText: '我的钱包丢了',
    });
    expect(answer.sections.some((s) => s.id === 'signals')).toBe(true);
    expect(answer.sections.some((s) => s.id === 'timing')).toBe(true);
    expect(answer.sections.some((s) => s.id === 'evidence')).toBe(true);
    expect(answer.sections.some((s) => s.id === 'disclaimer')).toBe(true);
    expect(answer.disclaimer).toContain('不构成');
  });

  it('无证据报缺口', () => {
    const tpl = templateFor('liuyao.generic.v1')!;
    const answer = composeAnswer({
      template: tpl,
      facts: [],
      ruleHits: [],
      timingCandidates: [],
      evidence: [],
      questionText: '随便问问',
    });
    expect(answer.gaps.some((g) => g.includes('暂无内置依据'))).toBe(true);
  });
});

describe('应期推法（ruleId 化）', () => {
  it('六爻：动爻/旬空/月破均出候选', () => {
    const out = timingCandidatesOf('liuyao', {
      lines: [
        { branch: '子', moving: true, xunKong: true, yuePo: false },
        { branch: '午', moving: false, xunKong: false, yuePo: true },
      ],
    });
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.some((c) => c.ruleId === 'liuyao.timing.dong')).toBe(true);
    expect(out.some((c) => c.ruleId === 'liuyao.timing.xunkong')).toBe(true);
    expect(out.some((c) => c.ruleId === 'liuyao.timing.yuepo')).toBe(true);
    for (const c of out) {
      expect(c.confidenceLevel).toBe('D');
      expect(c.citations.length).toBe(0);
    }
  });

  it('六爻可从既有 timing ruleHits 透出', () => {
    const out = timingCandidatesOf('liuyao', { lines: [] }, [
      { ruleId: 'liuyao.timing', text: '应期参考：财爻出空', confidenceLevel: 'A', citations: [], severity: '提示' },
    ]);
    expect(out.some((c) => c.text.includes('财爻出空'))).toBe(true);
  });

  it('梅花/小六壬/奇门/六壬/金口诀均产生 D 级窗口提示', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['meihua', { yong: '乾', ti: '艮', movingIndex: 3 }],
      ['xiaoliuren', { mo: { index: 4, name: '赤口' } }],
      ['qimen', { hourGanPalace: 7, xunKong: '午未', term: '处暑' }],
      ['liuren', { yiMa: '寅', chuChuan: '寅', xunKongBranches: ['寅', '卯'] }],
      ['jinkou', { diFen: '午', yueJiang: '巳' }],
    ];
    for (const [art, chart] of cases) {
      const out = timingCandidatesOf(art, chart);
      expect(out.length).toBeGreaterThan(0);
      for (const c of out) {
        expect(c.window.length).toBeGreaterThan(0);
        expect(c.confidenceLevel).toBe('D');
      }
    }
  });

  it('八字/紫微提供运限窗口', () => {
    const b = timingCandidatesOf('bazi', { dayun: [{ startYear: 2036, ganZhi: { gan: '甲', zhi: '子' } }] });
    expect(b.some((c) => c.ruleId === 'bazi.timing.dayun')).toBe(true);
    const z = timingCandidatesOf('ziwei', { decadal: [{ range: '36-45岁' }] });
    expect(z.some((c) => c.ruleId === 'ziwei.timing.day')).toBe(true);
  });
});

describe('安全拦截', () => {
  it('医疗/投资/法律关键词', () => {
    expect(safetyCheck('我这个病能不能好').blocked).toBe(true);
    expect(safetyCheck('股票投资会涨吗').blocked).toBe(true);
    expect(safetyCheck('这场官司能赢吗').blocked).toBe(true);
    expect(safetyCheck('我的钱包在哪').blocked).toBe(false);
  });

  it('反推拦截（D26）', () => {
    expect(antiInferenceCheck({ text: '根据结果反推我的时辰' })).toContain('不支持');
    expect(antiInferenceCheck({ text: '钱包丢了' })).toBeNull();
  });
});
