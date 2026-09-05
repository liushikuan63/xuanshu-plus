/**
 * 六爻插件（ShuPlugin 实现）
 */

import type { EngineCtx, RawInput, RuleHit } from '../../types.js';
import type { ShuPlugin } from '../../plugins/contract.js';
import { makeBoard, type BoardSpec } from '../../board/schema.js';
import { LIUYAO_DEFAULT_CONFIG, castLiuyao, type LiuyaoChart } from './engine.js';
import { chartRules } from './rules.js';

export const liuyaoPlugin: ShuPlugin<RawInput, LiuyaoChart> = {
  id: 'liuyao',
  name: '六爻',
  version: '0.1.0',
  art: 'liuyao',
  category: 'paipan',
  configSchema: {
    type: 'object',
    properties: {
      zishiSplit: { type: 'string', enum: ['23:00', '0:00'], default: '23:00' },
      fushenEnabled: { type: 'boolean', default: true },
      sanheEnabled: { type: 'boolean', default: true },
    },
  },
  async normalize(input, ctx) {
    const { normalizeLiuyao } = await import('./engine.js');
    return normalizeLiuyao(input, ctx, ctx.tzOffsetHours ?? 8);
  },
  async compute(input, ctx) {
    return castLiuyao(input, ctx, LIUYAO_DEFAULT_CONFIG);
  },
  async rules(chart) {
    return chartRules(chart);
  },
  board(chart): BoardSpec {
    const rows: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const l = chart.lines[i]!;
      rows.push(`${l.liuShen} ${l.stem}${l.branch} ${l.liuqin}${l.isShi ? '【世】' : ''}${l.isYing ? '【应】' : ''}${l.moving ? '●' : ''}${l.xunKong ? ' 空' : ''}${l.yuePo ? ' 破' : ''}${l.fuShen ? `（伏:${l.fuShen.qin}${l.fuShen.branch}）` : ''}`);
    }
    return makeBoard('liuyao', `${chart.benName}${chart.bianName ? ` 之 ${chart.bianName}` : ''}`, chart.configHash, [
      { title: '卦象', layout: 'stack', cells: rows.map((r, i) => ({ key: `y${5 - i}`, label: `第${5 - i + 1}爻`, content: r })) },
      { title: '信息', layout: 'list', cells: [
        { key: 'month', label: '月建', content: `${chart.monthPillar.gan}${chart.monthPillar.zhi}` },
        { key: 'day', label: '日辰', content: `${chart.dayPillar.gan}${chart.dayPillar.zhi}` },
        { key: 'xk', label: '旬空', content: chart.xunKong.join('') },
        { key: 'hu', label: '互卦', content: chart.huName },
      ]},
    ]);
  },
  evidence() {
    return [
      { ruleId: 'liuyao.generic', keywords: ['六爻', '旬空', '月破', '六冲', '六合', '世应', '纳甲'] },
    ];
  },
  warnings() {
    return [];
  },
  knowledgePack: { id: 'liuyao', refs: ['bushizhengzong', 'zengshanbuyi'] },
  fixtures: [],
  intake: {
    categories: ['失物', '感情', '事业', '求财', '学业', '出行', '官非', '决策', '其他'],
    presetFor() {
      return {};
    },
    guidance() {
      return { whyAsk: '', goodExamples: [], badExamples: [], tips: [] };
    },
    keyFactors() {
      return [];
    },
  },
  answer: {
    templateFor() {
      return {
        templateId: 'liuyao.generic.v1',
        category: '其他',
        sections: [
          { id: 'conclusion', from: 'composer' },
          { id: 'signals', from: 'core.rules', rulePrefix: 'liuyao' },
          { id: 'timing', from: 'answer.timing', rulePrefix: 'liuyao.timing', fallback: '暂无内置应期推法' },
          { id: 'disclaimer', from: 'answer.safety', always: true },
        ],
        forbidden: [],
        recordHint: '记录卦象与结果，事后回标应验情况',
      };
    },
    timingRules(chart) {
      const rules = chartRules(chart).filter((r) => r.ruleId.startsWith('liuyao.timing'));
      return rules.map((r) => ({ ruleId: r.ruleId, text: r.text, citations: r.citations, confidenceLevel: r.confidenceLevel, window: '待值日/冲合之期' }));
    },
    extractFacts() {
      return [];
    },
  },
};
