/**
 * 梅花易数插件（ShuPlugin 实现）
 */

import type { RawInput, RuleHit } from '../../types.js';
import type { ShuPlugin } from '../../plugins/contract.js';
import { makeBoard, type BoardSpec } from '../../board/schema.js';
import { WUXING_SHENG, WUXING_KE, type WuXing, type Zhi } from '../../calendar/ganzhi.js';
import { solarToLunar } from '../../calendar/lunar.js';
import { MEIHUA_DEFAULT_CONFIG, castMeihua, type MeihuaChart } from './engine.js';

/** 八卦五行（先天八卦方位五行） */
const GUA_WUXING: Record<string, WuXing> = {
  乾: '金', 兑: '金', 离: '火', 震: '木', 巽: '木', 坎: '水', 艮: '土', 坤: '土',
};

/** 十二地支 → 当令季五行（正月建寅：寅卯春木、巳午夏火、申酉秋金、亥子冬水、辰戌丑未四季土） */
const ZHI_SEASON: Record<Zhi, WuXing> = {
  寅: '木', 卯: '木',
  巳: '火', 午: '火',
  申: '金', 酉: '金',
  亥: '水', 子: '水',
  辰: '土', 戌: '土', 丑: '土', 未: '土',
};

/**
 * 旺相休囚死：
 * 当令者旺、令生者相、生令者休、克令者囚、令克者死。
 */
export function wangShuaiOf(wx: WuXing, season: WuXing): '旺' | '相' | '休' | '囚' | '死' {
  if (wx === season) return '旺';
  if (WUXING_SHENG[season] === wx) return '相';
  if (WUXING_SHENG[wx] === season) return '休';
  if (WUXING_KE[wx] === season) return '囚';
  return '死';
}

/** 八卦万物类象（速断取象，D 级流派提要） */
const GUA_LEIXIANG: Record<string, string> = {
  乾: '天·刚健·首领·父辈·金玉·头',
  兑: '泽·喜悦·口舌·少女·西',
  离: '火·光明·文书·中女·目',
  震: '雷·行动·长子·足·东',
  巽: '风·入伏·长女·股·绳直',
  坎: '水·险陷·中男·耳·北',
  艮: '山·止阻·少男·手·东北',
  坤: '地·柔顺·母辈·腹·包容',
};

/** 八卦先天数（乾一兑二离三震四巽五坎六艮七坤八） */
const GUA_XIAN_TIAN_NUM: Record<string, number> = {
  乾: 1, 兑: 2, 离: 3, 震: 4, 巽: 5, 坎: 6, 艮: 7, 坤: 8,
};

export const meihuaPlugin: ShuPlugin<RawInput, MeihuaChart> = {
  id: 'meihua',
  name: '梅花易数',
  version: '0.1.0',
  art: 'meihua',
  category: 'paipan',
  configSchema: {
    type: 'object',
    properties: {
      huGuaEnabled: { type: 'boolean', default: true },
      bianGuaEnabled: { type: 'boolean', default: true },
    },
  },
  async normalize(input, ctx) {
    const { normalizeMeihua } = await import('./engine.js');
    return normalizeMeihua(input, ctx, ctx.tzOffsetHours ?? 8);
  },
  async compute(input, ctx) {
    return castMeihua(input, ctx, MEIHUA_DEFAULT_CONFIG);
  },
  async rules(chart) {
    const rules: RuleHit[] = [
      {
        ruleId: 'meihua.tiyong',
        text: `体卦${chart.ti}（不动之卦），用卦${chart.yong}（动爻所在之卦），第${chart.movingIndex + 1}爻动。`,
        severity: '提示',
        confidenceLevel: 'D',
        citations: [],
      },
      {
        ruleId: `meihua.tiyong.${chart.tiYongRelation}`,
        text: chart.judgment,
        severity: chart.tiYongRelation === '用克体' ? '凶' : chart.tiYongRelation === '体克用' || chart.tiYongRelation === '体生用' ? '变数' : '吉',
        confidenceLevel: 'D',
        citations: [],
      },
      {
        ruleId: 'meihua.hubian',
        text: `互卦${chart.huName}，${chart.bianName ? `变卦${chart.bianName}` : '无动爻不变'}。`,
        severity: '提示',
        confidenceLevel: 'D',
        citations: [],
      },
      {
        ruleId: 'meihua.leixiang',
        text: `类象取事：体卦${chart.ti}象「${GUA_LEIXIANG[chart.ti]}」，主我方之姿态；用卦${chart.yong}象「${GUA_LEIXIANG[chart.yong]}」，主所测之事的环境与性质。`,
        severity: '提示',
        confidenceLevel: 'D',
        citations: [],
      },
    ];
    // 月令旺衰（节气月支取自 lunar-javascript 干支月令）
    try {
      const lunar = await solarToLunar(chart.normalized.year, chart.normalized.month, chart.normalized.day);
      const monthZhi = lunar.monthGanZhi[1] as Zhi;
      const season = ZHI_SEASON[monthZhi];
      const tiState = wangShuaiOf(GUA_WUXING[chart.ti]!, season);
      const yongState = wangShuaiOf(GUA_WUXING[chart.yong]!, season);
      const speed = tiState === '旺' ? '卦气盛，事体显而应速' : tiState === '死' ? '卦气衰，事缓难成' : '卦气中平，应期不疾不徐';
      rules.push({
        ruleId: 'meihua.wangshuai',
        text: `月令旺衰（${monthZhi}月）：体卦${chart.ti}五行${GUA_WUXING[chart.ti]}为「${tiState}」，用卦${chart.yong}五行${GUA_WUXING[chart.yong]}为「${yongState}」；${speed}。`,
        severity: tiState === '死' ? '变数' : '提示',
        confidenceLevel: 'D',
        citations: [],
      });
    } catch {
      /* lunar 加载失败时静默降级，不阻断规则集 */
    }
    // 应期参考：以体用先天卦数为参考基数，卦数间差定缓急
    const yongNum = GUA_XIAN_TIAN_NUM[chart.yong] ?? 0;
    const tiNum = GUA_XIAN_TIAN_NUM[chart.ti] ?? 0;
    const span = Math.abs(yongNum - tiNum);
    rules.push({
      ruleId: 'meihua.yingqi',
      text: `应期参考：用卦${chart.yong}先天数${yongNum}，体卦${chart.ti}先天数${tiNum}，卦数相距${span}（近主应速、远主应缓）；动爻在用卦，主事之变动已在眼前，宜以天数/月数为尺。`,
      severity: '提示',
      confidenceLevel: 'D',
      citations: [],
    });
    return rules;
  },
  board(chart: MeihuaChart): BoardSpec {
    return makeBoard('meihua', chart.benName, chart.configHash, [
      { title: '体用', layout: 'list', cells: [
        { key: 'ti', label: '体卦', content: chart.ti },
        { key: 'yong', label: '用卦', content: chart.yong },
        { key: 'rel', label: '体用关系', content: chart.tiYongRelation },
        { key: 'judgment', label: '吉凶', content: chart.judgment },
      ]},
      { title: '互变', layout: 'list', cells: [
        { key: 'hu', label: '互卦', content: chart.huName },
        { key: 'bian', label: '变卦', content: chart.bianName ?? '无动爻' },
        { key: 'dong', label: '动爻', content: `第 ${chart.movingIndex + 1} 爻` },
      ]},
    ]);
  },
  evidence() {
    return [{ ruleId: 'meihua.generic', keywords: ['梅花易数', '体用', '生克', '类象'] }];
  },
  warnings() {
    return [];
  },
  knowledgePack: { id: 'meihua', refs: ['meihuayishu'] },
  fixtures: [],
  intake: {
    categories: ['决策', '失物', '感情', '出行', '其他'],
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
        templateId: 'meihua.generic.v1',
        category: '其他',
        sections: [
          { id: 'conclusion', from: 'composer' },
          { id: 'signals', from: 'core.rules' },
          { id: 'disclaimer', from: 'answer.safety', always: true },
        ],
        forbidden: [],
        recordHint: '记录卦象与结果，事后回标应验情况',
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
