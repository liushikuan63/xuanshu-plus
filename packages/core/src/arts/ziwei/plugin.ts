/**
 * 紫微斗数插件（ShuPlugin 实现，安星委托 iztro）
 */

import type { RawInput, RuleHit } from '../../types.js';
import type { ShuPlugin } from '../../plugins/contract.js';
import { makeBoard, type BoardSpec } from '../../board/schema.js';
import { ZIWEI_DEFAULT_CONFIG, castZiweiFromRaw, type ZiweiChart } from './adapter.js';

export const ziweiPlugin: ShuPlugin<RawInput, ZiweiChart> = {
  id: 'ziwei',
  name: '紫微斗数',
  version: '0.1.0',
  art: 'ziwei',
  category: 'paipan',
  configSchema: {
    type: 'object',
    properties: {
      fixLeap: { type: 'boolean', default: true },
      language: { type: 'string', default: 'zh-CN' },
    },
  },
  async normalize(input, ctx) {
    const { normalizeZiwei } = await import('./adapter.js');
    return normalizeZiwei(input, ctx, ctx.tzOffsetHours ?? 8);
  },
  async compute(input, ctx) {
    return castZiweiFromRaw(input, ctx);
  },
  async rules(chart) {
    const ming = chart.palaces.find((p) => p.name === '命宫');
    const rules: RuleHit[] = [
      {
        ruleId: 'ziwei.fiveelements',
        text: `五行局：${chart.fiveElementsClass}。`,
        severity: '提示',
        confidenceLevel: 'D',
        citations: [],
      },
      {
        ruleId: 'ziwei.soulbody',
        text: `命主${chart.soul}，身主${chart.body}。`,
        severity: '提示',
        confidenceLevel: 'D',
        citations: [],
      },
    ];
    if (ming && ming.stars.length > 0) {
      rules.push({
        ruleId: 'ziwei.mingpalace.stars',
        text: `命宫（${ming.heavenlyStem}${ming.earthlyBranch}）主星：${ming.stars.slice(0, 6).join('、')}。`,
        severity: '变数',
        confidenceLevel: 'D',
        citations: [],
      });
    }
    if (chart.decadal.length > 0) {
      const d = chart.decadal[0]!;
      rules.push({
        ruleId: 'ziwei.decadal.first',
        text: `大限：${d.range}。`,
        severity: '提示',
        confidenceLevel: 'D',
        citations: [],
      });
    }
    return rules;
  },
  board(chart: ZiweiChart): BoardSpec {
    return makeBoard('ziwei', `紫微斗数 · ${chart.fiveElementsClass}`, chart.configHash, [
      {
        title: '十二宫',
        layout: 'grid',
        cells: chart.palaces.map((p) => ({
          key: p.name,
          label: `${p.name}（${p.heavenlyStem}${p.earthlyBranch}）`,
          content: p.stars.slice(0, 6).join(' '),
          sub: p.mutagen.length ? `四化：${p.mutagen.join(' ')}` : undefined,
        })),
      },
      {
        title: '信息',
        layout: 'list',
        cells: [
          { key: 'soul', label: '命主', content: chart.soul },
          { key: 'body', label: '身主', content: chart.body },
          { key: 'five', label: '五行局', content: chart.fiveElementsClass },
        ],
      },
    ]);
  },
  evidence() {
    return [{ ruleId: 'ziwei.generic', keywords: ['紫微斗数', '十四主星', '四化', '大限', '命宫'] }];
  },
  warnings() {
    return [];
  },
  knowledgePack: { id: 'ziwei', refs: ['ziweidoushu'] },
  fixtures: [],
  intake: {
    categories: ['事业', '感情', '学业', '决策', '其他'],
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
        templateId: 'ziwei.generic.v1',
        category: '其他',
        sections: [
          { id: 'conclusion', from: 'composer' },
          { id: 'signals', from: 'core.rules' },
          { id: 'disclaimer', from: 'answer.safety', always: true },
        ],
        forbidden: [],
        recordHint: '记录命盘与运势走势，事后回标趋势判断',
      };
    },
    timingRules() {
      return [];
    },
    extractFacts() {
      return [];
    },
  },
};
