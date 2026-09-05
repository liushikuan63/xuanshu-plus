/**
 * 小六壬插件（ShuPlugin 实现）
 */

import type { RawInput, RuleHit } from '../../types.js';
import type { ShuPlugin } from '../../plugins/contract.js';
import { makeBoard } from '../../board/schema.js';
import { castXiaoliuren, normalizeSmallLiuRen, type XiaoliurenChart } from './engine.js';

export const xiaoliurenPlugin: ShuPlugin<RawInput, XiaoliurenChart> = {
  id: 'xiaoliuren',
  name: '小六壬',
  version: '0.1.0',
  art: 'xiaoliuren',
  category: 'paipan',
  configSchema: { type: 'object', properties: {} },
  async normalize(input, ctx) {
    return normalizeSmallLiuRen(input, ctx, ctx.tzOffsetHours ?? 8);
  },
  async compute(input, ctx) {
    return castXiaoliuren(input, ctx);
  },
  async rules(chart): Promise<RuleHit[]> {
    const p = (c: XiaoliurenChart['chu'], label: string, pos: string): RuleHit => ({
      ruleId: `xiaoliuren.${pos}`,
      text: `${pos}宫（${label}）落${c.name}（五行属${c.element}，${c.direction}），主${c.short}。${c.gist}`,
      severity: c.omen,
      confidenceLevel: 'D',
      citations: [],
    });
    return [
      { ...p(chart.chu, '月', 'chu'), ruleId: 'xiaoliuren.chu' },
      { ...p(chart.zhong, '日', 'zhong'), ruleId: 'xiaoliuren.zhong' },
      {
        ruleId: `xiaoliuren.mo.${chart.mo.name}`,
        text: `末宫${chart.mo.name}（${chart.mo.god}）主断：${chart.result.gist}「${chart.mo.verse}」应期${chart.mo.yingqi}；趋避：${chart.mo.advice}`,
        severity: chart.result.omen,
        confidenceLevel: 'D',
        citations: [],
      },
    ];
  },
  board(chart: XiaoliurenChart) {
    return makeBoard('xiaoliuren', `${chart.result.name} · 末宫主断`, chart.configHash, [
      { title: '六宫三山', layout: 'list', cells: [
        { key: 'chu', label: '起宫（月）', content: `${chart.chu.name} · ${chart.chu.element} ${chart.chu.direction}`, sub: chart.chu.gist, state: [chart.chu.omen] },
        { key: 'zhong', label: '中宫（日）', content: `${chart.zhong.name} · ${chart.zhong.element} ${chart.zhong.direction}`, sub: chart.zhong.gist, state: [chart.zhong.omen] },
        { key: 'mo', label: '末宫（时）', content: `${chart.mo.name} · ${chart.mo.element} ${chart.mo.direction}`, sub: chart.mo.gist, state: [chart.mo.omen] },
      ]},
      { title: '掌诀细断', layout: 'list', cells: [
        { key: 'omen', label: '吉凶', content: chart.result.omen },
        { key: 'god', label: '神煞', content: `${chart.result.god} · ${chart.result.numberNote}` },
        { key: 'yingqi', label: '应期', content: chart.result.yingqi },
        { key: 'advice', label: '趋避', content: chart.result.advice },
        { key: 'verse', label: '口诀', content: chart.mo.verse },
      ]},
    ]);
  },
  evidence() {
    return [{ ruleId: 'xiaoliuren.generic', keywords: ['小六壬', '大安', '留连', '速喜', '赤口', '小吉', '空亡'] }];
  },
  warnings() {
    return [];
  },
  knowledgePack: { id: 'xiaoliuren', refs: [] },
  fixtures: [],
  intake: {
    categories: ['失物', '出行', '决策', '其他'],
    presetFor() { return {}; },
    guidance() { return { whyAsk: '', goodExamples: [], badExamples: [], tips: [] }; },
    keyFactors() { return []; },
  },
  answer: {
    templateFor() {
      return {
        templateId: 'xiaoliuren.generic.v1',
        category: '其他',
        sections: [
          { id: 'conclusion', from: 'composer' },
          { id: 'signals', from: 'core.rules' },
          { id: 'disclaimer', from: 'answer.safety', always: true },
        ],
        forbidden: [],
        recordHint: '记录掌诀与应验，事后再校验',
      };
    },
    timingRules() { return []; },
    extractFacts() { return []; },
  },
};