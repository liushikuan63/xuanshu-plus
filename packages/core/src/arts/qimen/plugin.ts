/**
 * 奇门遁甲插件（ShuPlugin 实现，时家转盘法）
 */

import type { RawInput, RuleHit } from '../../types.js';
import type { Gan, WuXing } from '../../calendar/ganzhi.js';
import type { ShuPlugin } from '../../plugins/contract.js';
import { makeBoard } from '../../board/schema.js';
import { castQimen, normalizeQimen, riShiRelationOf, STEM_WUXING as stemWx, type QimenChart } from './engine.js';

/** 八门速断提要（D 级流派说法） */
const DOOR_MENING: Record<string, string> = {
  休: '休门，吉，主休息安养、谋事缓和',
  生: '生门，吉，主生机财源、事宜进取',
  开: '开门，吉，主开启通达、宜求职出行',
  景: '景门，平，主文书信息、宜策划宣传',
  杜: '杜门，平，主闭塞防患、宜防守隐忍',
  伤: '伤门，凶，主争斗损害、宜防破财',
  惊: '惊门，凶，主惊忧恐吓、宜防口舌',
  死: '死门，凶，主停滞死守、宜止损收束',
};

/** 三奇意象（D 级） */
const SAN_QI: Record<string, string> = {
  乙: '日奇（乙奇）主谋事得成、柔化纠纷',
  丙: '月奇（丙奇）主贵人相助、火照前程',
  丁: '星奇（丁奇）主解厄化险、文书消息',
};

const QUARTER_DIRECTION: Record<number, string> = {
  1: '北', 2: '西南', 3: '东', 4: '东南', 5: '中', 6: '西北', 7: '西', 8: '东北', 9: '南',
};

const RI_SHI_TEXT: Record<string, string> = {
  生我: '事体生你之日干落宫，主此事对你有利、进展顺遂',
  我生: '你之日干落宫生事体，主你为此事耗费心力财力，进展缓慢',
  克我: '事体克你之日干落宫，主此事对你构成压力，需防范被动',
  我克: '你之日干落宫克事体，主你能制此事，但需费一番工夫',
  比和: '事体与你日干比和，主此事与你平等相待、不易速成也顺遂',
};

export const qimenPlugin: ShuPlugin<RawInput, QimenChart> = {
  id: 'qimen',
  name: '奇门遁甲',
  version: '0.1.0',
  art: 'qimen',
  category: 'paipan',
  configSchema: {
    type: 'object',
    properties: {
      engine: { type: 'string', const: 'shijia' },
      zishSplit: { type: 'string', enum: ['23:00'], default: '23:00' },
      ruanfa: { type: 'string', enum: ['chai', 'zhi'], default: 'chai', description: '定局法：拆补法 / 置闰法' },
    },
  },
  async normalize(input, ctx) {
    return normalizeQimen(input, ctx, ctx.tzOffsetHours ?? 8);
  },
  async compute(input, ctx) {
    return castQimen(input, ctx);
  },
  async rules(chart): Promise<RuleHit[]> {
    const rules: RuleHit[] = [];
    const p = chart.palaces.find((x) => x.num === chart.hourGanPalace)!;
    const dayP = chart.palaces.find((x) => x.num === chart.dayGanPalace);

    // 定局信息
    rules.push({
      ruleId: 'qimen.dingju',
      text: `${chart.term}（${chart.yangDun ? '阳' : '阴'}遁${chart.ju}局，${chart.yuan}元${chart.ruan ? '·置闰' : ''}，${chart.ruanfa === 'zhi' ? '置闰法' : '拆补法'}）旬首${chart.xunShou}，值符${chart.valueStar}、值使${chart.valueDoor}；四柱：${chart.year}年 ${chart.month}月 ${chart.day}日 ${chart.hour}时。`,
      severity: '提示',
      confidenceLevel: 'D',
      citations: [],
    });

    // 时干落宫主断（所测之事）
    rules.push({
      ruleId: 'qimen.shigan',
      text: `时干${chart.hourGan}落${p.num}宫${p.direction}方（${p.bagua}·天盘${p.heavenStem}·${p.star}·${p.door}），主所测之事落于此方；${DOOR_MENING[p.door === '死(寄)' ? '死' : p.door]}。`,
      severity: p.door === '伤' || p.door === '惊' || p.door === '死(寄)' || p.door === '死' ? '变数' : '提示',
      confidenceLevel: 'D',
      citations: [],
    });

    // 日干与事体关系
    if (dayP && dayP.num !== 0) {
      const dayWx = stemWx[chart.day[0] as Gan];
      const shiWx = stemWx[chart.hourGan];
      if (dayWx && shiWx) {
        const rel = riShiRelationOf(dayWx, shiWx);
        rules.push({
          ruleId: `qimen.rishi.${rel}`,
          text: `日干落${dayP.num}宫，${RI_SHI_TEXT[rel]}。`,
          severity: rel === '克我' ? '凶' : rel === '生我' || rel === '比和' ? '吉' : '变数',
          confidenceLevel: 'D',
          citations: [],
        });
      }
    }

    // 三奇（乙丙丁）天盘落宫
    const qiQi = chart.palaces
      .map((x) => ({ stem: x.heavenStem, palace: x }))
      .filter((x) => x.stem === '乙' || x.stem === '丙' || x.stem === '丁');
    if (qiQi.length > 0) {
      for (const q of qiQi) {
        rules.push({
          ruleId: `qimen.sanqi.${q.stem}`,
          text: `${SAN_QI[q.stem]}，落${q.palace.num}宫${q.palace.direction}方（天盘${q.stem}）；宜择此方位行事。`,
          severity: '吉',
          confidenceLevel: 'D',
          citations: [],
        });
      }
    } else {
      rules.push({
        ruleId: 'qimen.sanqi.none',
        text: '天盘不见三奇（乙丙丁），主事多阻力、贵人难逢，宜缓图守正、事后回标校准。',
        severity: '变数',
        confidenceLevel: 'D',
        citations: [],
      });
    }

    // 反吟 / 伏吟
    if (chart.fuyin) {
      rules.push({
        ruleId: 'qimen.fuyin',
        text: '伏吟局（值符/值使未动），主事滞迟、重复，宜守不宜进，待时再起可再验。',
        severity: '变数',
        confidenceLevel: 'D',
        citations: [],
      });
    } else if (chart.fanyin) {
      rules.push({
        ruleId: 'qimen.fanyin',
        text: '反吟局（值符落宫与旬首宫对冲），主事反复多变、来去无常，宜快断慎行。',
        severity: '变数',
        confidenceLevel: 'D',
        citations: [],
      });
    }

    // 旬空
    if (chart.xunKongPalaces.length > 0) {
      rules.push({
        ruleId: 'qimen.xunkong',
        text: `时柱旬空「${chart.xunKong}」，对应${chart.xunKongPalaces.map((n) => `${n}宫${QUARTER_DIRECTION[n]}`).join('、')}宫空亡，主此方之事虚而未实，待出空填实再见。`,
        severity: '变数',
        confidenceLevel: 'D',
        citations: [],
      });
    }

    // 值使门主事推进
    rules.push({
      ruleId: `qimen.zhishi.${chart.valueDoor}`,
      text: `值使门${chart.valueDoor}为事之枢纽：${DOOR_MENING[chart.valueDoor === '死(寄)' ? '死' : chart.valueDoor]}；应期建议记录并事后回标实际发生时点以校准。`,
      severity: '提示',
      confidenceLevel: 'D',
      citations: [],
    });

    return rules;
  },
  board(chart: QimenChart) {
    // 洛书宫序布 3×3：上排 4 9 2，中排 3 5 7，下排 8 1 6
    const LUOSHU_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6];
    const cells = LUOSHU_ORDER.map((num) => {
      const p = chart.palaces.find((x) => x.num === num)!;
      return {
        key: `p${num}`,
        label: `${p.num}宫 · ${p.direction}${p.bagua === '中' ? '中宫' : p.bagua}`,
        content: `${p.star} · ${p.door}`,
        sub: `${p.heavenStem}/${p.earthStem} · 神${p.god === '—' ? '—' : p.god}`,
        state: p.num === chart.hourGanPalace ? ['变数'] : undefined,
      };
    });
    return makeBoard('qimen', `奇门 · ${chart.term} ${chart.yangDun ? '阳' : '阴'}遁${chart.ju}局`, chart.configHash, [
      { title: `九宫盘（时干${chart.hourGan}落${QUARTER_DIRECTION[chart.hourGanPalace]} / 日干落${QUARTER_DIRECTION[chart.dayGanPalace] ?? '—'}）`, layout: 'grid', cells },
      {
        title: '定局信息',
        layout: 'list',
        cells: [
          { key: 'term', label: '节气', content: `${chart.term} · ${chart.yangDun ? '阳' : '阴'}遁${chart.ju}局 · ${chart.yuan}元${chart.ruan ? '（置闰）' : ''}` },
          { key: 'ruanfa', label: '定局法', content: chart.ruanfa === 'zhi' ? '置闰法' : '拆补法' },
          { key: 'xun', label: '旬首', content: `${chart.xunShou}（${chart.xunShouYun}）` },
          { key: 'zf', label: '值符/值使', content: `${chart.valueStar} ${chart.valueDoor}` },
          { key: 'xz', label: '旬空', content: `${chart.xunKong}（${chart.xunKongPalaces.map((n) => `${n}宫`).join('、')}）` },
          { key: 'fy', label: '反伏吟', content: chart.fuyin ? '伏吟' : chart.fanyin ? '反吟' : '否' },
        ],
      },
    ]);
  },
  evidence() {
    return [{ ruleId: 'qimen.generic', keywords: ['奇门遁甲', '九宫', '八门', '九星', '八神', '三奇', '六仪', '值符', '值使'] }];
  },
  warnings() {
    return [
      { code: 'time-only', message: '奇门遁甲仅支持时间起局；错过时辰需重新起局', level: 'info' },
    ];
  },
  knowledgePack: { id: 'qimen', refs: ['qimen-dunjia'] },
  fixtures: [],
  intake: {
    categories: ['决策', '出行', '失物', '官非', '其他'],
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
        templateId: 'qimen.generic.v1',
        category: '其他',
        sections: [
          { id: 'conclusion', from: 'composer' },
          { id: 'signals', from: 'core.rules' },
          { id: 'disclaimer', from: 'answer.safety', always: true },
        ],
        forbidden: [],
        recordHint: '记录局数与实际应验（方位/时辰），事后回标校准',
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