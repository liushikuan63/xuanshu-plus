/**
 * 八字插件（ShuPlugin 实现）
 */

import type { RawInput, RuleHit } from '../../types.js';
import type { ShuPlugin } from '../../plugins/contract.js';
import { makeBoard, type BoardSpec } from '../../board/schema.js';
import { GAN_WUXING, ZHI_WUXING, shiShenYinYang, type Gan, type WuXing } from '../../calendar/ganzhi.js';
import { BAZI_DEFAULT_CONFIG, buildBazi, pillarText, type BaziChart, type Pillar } from './engine.js';

/** 五行 → 十神大类（身旺/身弱的喜忌另有细分，此处只做结构提要） */
const SHI_SHEN_CLASS: Record<string, '比劫' | '印星' | '食伤' | '财星' | '官杀'> = {
  比肩: '比劫', 劫财: '比劫',
  正印: '印星', 偏印: '印星',
  食神: '食伤', 伤官: '食伤',
  正财: '财星', 偏财: '财星',
  正官: '官杀', 七杀: '官杀',
};

const CLASS_JUDGMENTS: Record<string, string> = {
  官杀: '官杀星显，主事业与责任压力、多竞争与约束，身旺可任、身弱需印星化杀',
  印星: '印星重，主好学有靠、长辈荫庇，但身旺多印则偏保守被动',
  食伤: '食伤旺，主才华表达与创造求变，身弱泄气者宜先培身',
  财星: '财星旺，主财缘与求财之心，身弱财多防「财多身弱」难承',
  比劫: '比劫多，主自主争强、竞争意识，合作与感情上防纷争分利',
};

function pillarGans(p: Pillar): Gan[] {
  return [p.gan, ...p.cangGan];
}

/** 五行分布（四干 + 四支本气，共 8 权重） */
export function wuxingDistribution(chart: BaziChart): Record<WuXing, number> {
  const counts: Record<WuXing, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const p of [chart.year, chart.month, chart.day, chart.hour]) {
    counts[GAN_WUXING[p.gan]] += 1;
    counts[ZHI_WUXING[p.zhi]] += 1;
  }
  return counts;
}

/** 十神大类计数（四干十神 + 全部藏干十神，相对日主） */
export function shiShenClassCounts(chart: BaziChart): Array<{ cls: keyof typeof SHI_SHEN_CLASS; count: number }> {
  const counts: Record<string, number> = { 比劫: 0, 印星: 0, 食伤: 0, 财星: 0, 官杀: 0 };
  for (const p of [chart.year, chart.month, chart.day, chart.hour]) {
    for (const g of pillarGans(p)) {
      const ss = shiShenYinYang(chart.dayMaster, g);
      const cls = SHI_SHEN_CLASS[ss];
      if (cls) counts[cls] = (counts[cls] ?? 0) + 1;
    }
  }
  return (Object.keys(counts) as Array<keyof typeof SHI_SHEN_CLASS>)
    .map((cls) => ({ cls, count: counts[cls]! }))
    .sort((a, b) => b.count - a.count);
}

export const baziPlugin: ShuPlugin<RawInput, BaziChart> = {
  id: 'bazi',
  name: '八字',
  version: '0.1.0',
  art: 'bazi',
  category: 'paipan',
  configSchema: {
    type: 'object',
    properties: {
      yearSwitch: { type: 'string', enum: ['lichun', 'zhengyue'], default: 'lichun' },
      monthSwitch: { type: 'string', enum: ['jieqi', 'chuyi'], default: 'jieqi' },
      zishiSplit: { type: 'string', enum: ['23:00', '0:00'], default: '23:00' },
      trueSolarTime: { type: 'boolean', default: false },
    },
  },
  async normalize(input, ctx) {
    const { normalizeBazi } = await import('./engine.js');
    return normalizeBazi(input, ctx, ctx.tzOffsetHours ?? 8);
  },
  async compute(input, ctx) {
    const t = input.time
      ? { year: input.time.year, month: input.time.month, day: input.time.day, hour: input.time.hour, minute: input.time.minute ?? 0, second: input.time.second ?? 0, gender: 'male' as const }
      : { year: ctx.now.getFullYear(), month: ctx.now.getMonth() + 1, day: ctx.now.getDate(), hour: ctx.now.getHours(), minute: ctx.now.getMinutes(), second: ctx.now.getSeconds(), gender: 'male' as const };
    return buildBazi(t, BAZI_DEFAULT_CONFIG, ctx.tzOffsetHours ?? 8);
  },
  async rules(chart) {
    const rules: RuleHit[] = [
      {
        ruleId: 'bazi.daymaster.strength',
        text: `日主${chart.dayMaster}，整体${chart.dayMasterStrength}（得令/失令的简化判断）。`,
        severity: '提示',
        confidenceLevel: 'D',
        citations: [],
      },
      {
        ruleId: 'bazi.dayun.direction',
        text: `${chart.gender === 'male' ? '男' : '女'}命${chart.qiyun.direction}行大运，约 ${chart.qiyun.age} 岁起运（约 ${chart.qiyun.startYear} 年），首步大运${chart.dayun[0] ? `${chart.dayun[0].ganZhi.gan}${chart.dayun[0].ganZhi.zhi}` : ''}。`,
        severity: '提示',
        confidenceLevel: 'D',
        citations: [],
      },
    ];
    for (const [name, zhis] of Object.entries(chart.shensha)) {
      rules.push({
        ruleId: `bazi.shensha.${name}`,
        text: `命带「${name}」：${zhis.join('、')}。`,
        severity: '变数',
        confidenceLevel: 'D',
        citations: [],
      });
    }
    // 五行分布与偏枯提示
    const wx = wuxingDistribution(chart);
    const missing = (Object.keys(wx) as WuXing[]).filter((k) => wx[k] === 0);
    const strongest = (Object.entries(wx).sort((a, b) => b[1] - a[1])[0]?.[0] as WuXing) ?? '无';
    rules.push({
      ruleId: 'bazi.wuxing.distribution',
      text: `五行分布（干+支本气）：木${wx['木']} 火${wx['火']} 土${wx['土']} 金${wx['金']} 水${wx['水']}；命中最强五行「${strongest}」${missing.length > 0 ? `，四柱缺「${missing.join('、')}」` : '，五行俱全'}。`,
      severity: missing.length > 0 ? '变数' : '提示',
      confidenceLevel: 'D',
      citations: [],
    });
    // 十神格局提要
    const cls = shiShenClassCounts(chart);
    const top = cls[0]!;
    if (top.count > 0) {
      const sub = cls.slice(0, 3).map((c) => `${c.cls}${c.count}`).join('、');
      rules.push({
        ruleId: `bazi.shishen.${top.cls}`,
        text: `十神结构（干+藏干）：${sub}；${CLASS_JUDGMENTS[top.cls]!}（${chart.dayMasterStrength}之日主宜结合喜忌再断）。`,
        severity: '变数',
        confidenceLevel: 'D',
        citations: [],
      });
    }
    return rules;
  },
  board(chart: BaziChart): BoardSpec {
    return makeBoard('bazi', `八字 · ${chart.dayMaster}日主`, chart.configHash, [
      {
        title: '四柱',
        layout: 'table',
        cells: [
          { key: 'year', label: '年柱', content: pillarText(chart.year), sub: `${chart.year.nayin}` },
          { key: 'month', label: '月柱', content: pillarText(chart.month), sub: `${chart.month.nayin}` },
          { key: 'day', label: '日柱', content: pillarText(chart.day), sub: `${chart.day.nayin}` },
          { key: 'hour', label: '时柱', content: pillarText(chart.hour), sub: `${chart.hour.nayin}` },
        ],
      },
      {
        title: '藏干十神',
        layout: 'table',
        cells: chart.day.cangGan.map((c, i) => ({ key: `c${i}`, label: `${chart.day.zhi}藏干`, content: c, sub: chart.day.shiShen[i] })),
      },
      {
        title: '大运',
        layout: 'list',
        cells: chart.dayun.map((d) => ({ key: `dy${d.startAge}`, label: `${d.startAge}岁起`, content: `${d.ganZhi.gan}${d.ganZhi.zhi}（${d.nayin}）`, sub: `约 ${d.startYear} 年` })),
      },
    ]);
  },
  evidence() {
    return [{ ruleId: 'bazi.generic', keywords: ['八字', '十神', '纳音', '大运', '神煞', '用神'] }];
  },
  warnings() {
    return [];
  },
  knowledgePack: { id: 'bazi', refs: ['ditiansui', 'zipingzhenquan', 'sanmingtonghui'] },
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
        templateId: 'bazi.generic.v1',
        category: '其他',
        sections: [
          { id: 'conclusion', from: 'composer' },
          { id: 'signals', from: 'core.rules' },
          { id: 'disclaimer', from: 'answer.safety', always: true },
        ],
        forbidden: [],
        recordHint: '记录命局与运势走势，事后回标趋势判断',
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
