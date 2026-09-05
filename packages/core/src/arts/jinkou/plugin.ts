/**
 * 大六壬金口诀插件（ShuPlugin 实现）
 */

import type { RawInput, RuleHit } from '../../types.js';
import type { ShuPlugin } from '../../plugins/contract.js';
import { makeBoard } from '../../board/schema.js';
import { WUXING_SHENG, WUXING_KE, ZHI_WUXING, GAN_WUXING, ZHI_LIUHE, ZHI_SANHE, zhiChong, type Gan, type Zhi } from '../../calendar/ganzhi.js';
import { castJinKou, normalizeJinKou, GOD_WUXING, type JinKouChart } from './engine.js';

const SHENG: Record<string, string> = WUXING_SHENG;
const KE: Record<string, string> = WUXING_KE;
const ZHI_WX = ZHI_WUXING as Record<Zhi, string>;
const GAN_WX = GAN_WUXING as Record<Gan, string>;

/** 四位五行（人元-天 / 贵神-人 / 月将-事 / 地分-地） */
interface SiWeiWx {
  renYuan: string;
  guiShen: string;
  yueJiang: string;
  diFen: string;
}
function siWeiWxOf(c: JinKouChart): SiWeiWx {
  return {
    renYuan: GAN_WX[c.renYuan],
    guiShen: GOD_WUXING[c.guiShen] ?? '土',
    yueJiang: ZHI_WX[c.yueJiang],
    diFen: ZHI_WX[c.diFen],
  };
}

/** 生克断语（D 级）：A 对 B 的生克关系 */
function relationText(a: string, aName: string, b: string, bName: string): string {
  if (a === b) return `${aName}与${bName}五行比和（${a}），主平顺相当`;
  if (SHENG[a] === b) return `${aName}生${bName}（${a}生${b}），主生扶助力`;
  if (SHENG[b] === a) return `${aName}受${bName}之生（${b}生${a}），主有靠得助`;
  if (KE[a] === b) return `${aName}克${bName}（${a}克${b}），主公事相克、压力`;
  return `${aName}受${bName}之克（${b}克${a}），主受制受阻`;
}

const XIONG_GODS = ['白虎', '朱雀', '螣蛇', '玄武', '天空'];

export const jinkouPlugin: ShuPlugin<RawInput, JinKouChart> = {
  id: 'jinkou',
  name: '金口诀',
  version: '0.1.0',
  art: 'jinkou',
  category: 'paipan',
  configSchema: { type: 'object', properties: {} },
  async normalize(input, ctx) {
    return normalizeJinKou(input, ctx, ctx.tzOffsetHours ?? 8);
  },
  async compute(input, ctx) {
    return castJinKou(input, ctx, ctx.tzOffsetHours ?? 8);
  },
  async rules(chart): Promise<RuleHit[]> {
    const rules: RuleHit[] = [];
    const w = siWeiWxOf(chart);

    // 四位总览
    rules.push({
      ruleId: 'jinkou.siwei',
      text: `四位：人元${chart.renYuan}（${w.renYuan}）· 贵神${chart.guiShen}（${w.guiShen}）· 月将${chart.yueJiang}（${w.yueJiang}）· 地分${chart.diFen}（${w.diFen}）；地分${chart.diFen}为测事之方，月将${chart.yueJiang}为事体。`,
      severity: '提示',
      confidenceLevel: 'D',
      citations: [],
    });

    // 人元（天）克地分（地）：外克内，主来意急迫、外压
    {
      const t = relationText(w.renYuan, '人元（天）', w.diFen, '地分（地）');
      const sev = w.renYuan === w.diFen ? '提示' : KE[w.renYuan] === w.diFen ? '变数' : SHENG[w.renYuan] === w.diFen || SHENG[w.diFen] === w.renYuan ? '提示' : '变数';
      rules.push({
        ruleId: 'jinkou.tiandi',
        text: `${t}；人元为天时外应，地分为我方所问，天克地主事急而外压，地克天主内耗而缓。`,
        severity: sev,
        confidenceLevel: 'D',
        citations: [],
      });
    }

    // 贵神（人）与地分（我）
    {
      const isXiong = XIONG_GODS.includes(chart.guiShen);
      const t = relationText(w.guiShen, '贵神（人）', w.diFen, '地分（地）');
      rules.push({
        ruleId: 'jinkou.guishen',
        text: `${t}；贵神为贵人/对方/官宦，${isXiong ? `所乘${chart.guiShen}为凶将，主防惊忧口舌之争` : `所乘${chart.guiShen}为吉将，主有贵人助益`}。`,
        severity: isXiong || KE[w.guiShen] === w.diFen ? '变数' : '提示',
        confidenceLevel: 'D',
        citations: [],
      });
    }

    // 月将（事）与地分（我）
    {
      const t = relationText(w.yueJiang, '月将（事）', w.diFen, '地分（地）');
      rules.push({
        ruleId: 'jinkou.shidi',
        text: `${t}；月将为事体，生我主此事有开展，克我主此事有阻碍。`,
        severity: KE[w.yueJiang] === w.diFen ? '变数' : '提示',
        confidenceLevel: 'D',
        citations: [],
      });
    }

    // 空亡与驿马
    {
      const diKong = chart.xunKongBranches.includes(chart.diFen);
      rules.push({
        ruleId: 'jinkou.kongma',
        text: `日旬空亡「${chart.xunKong}」${diKong ? '（地分落空，主所问之事虚而未实、应期迟滞）' : '，地分不空、事体实在'}；驿马在${chart.yiMa}${chart.diFen === chart.yiMa ? '（地分临马，主事有走动）' : ''}。`,
        severity: diKong || chart.diFen === chart.yiMa ? '变数' : '提示',
        confidenceLevel: 'D',
        citations: [],
      });
    }

    // 三合：地分与月将构成三合局（聚势）
    {
      const group = ZHI_SANHE[chart.diFen] as readonly Zhi[] | undefined;
      const formed = group?.includes(chart.yueJiang) ?? false;
      if (formed) {
        rules.push({
          ruleId: `jinkou.sanhe.${chart.diFen}`,
          text: `地分${chart.diFen}与月将${chart.yueJiang}构成三合局（${group!.join('')}），主聚众力而就、事有成局之势。`,
          severity: '吉',
          confidenceLevel: 'D',
          citations: [],
        });
      }
    }

    // 六合：地分与月将六合（和气）
    {
      if (ZHI_LIUHE[chart.diFen] === chart.yueJiang) {
        rules.push({
          ruleId: 'jinkou.liuhe',
          text: `地分${chart.diFen}与月将${chart.yueJiang}六合，主事体与所问和合、易得助力。`,
          severity: '吉',
          confidenceLevel: 'D',
          citations: [],
        });
      }
    }

    // 对冲：地分与月将相冲（反复/走移）
    {
      if (zhiChong(chart.diFen) === chart.yueJiang) {
        rules.push({
          ruleId: 'jinkou.chong',
          text: `地分${chart.diFen}与月将${chart.yueJiang}对冲，主事有反复、去向两歧，宜快断而防变。`,
          severity: '变数',
          confidenceLevel: 'D',
          citations: [],
        });
      }
    }

    // 人元与贵神：天人格克贵人 → 外来之争/贵人失和
    {
      const t = relationText(w.renYuan, '人元（天）', w.guiShen, '贵神（人）');
      rules.push({
        ruleId: 'jinkou.renyuangui',
        text: `${t}；人元为天时外来，贵神为贵人官宦，天克贵神主外来与贵人相冲、格局多磨。`,
        severity: KE[w.renYuan] === w.guiShen ? '变数' : '提示',
        confidenceLevel: 'D',
        citations: [],
      });
    }

    return rules;
  },
  board(chart: JinKouChart) {
    const w = siWeiWxOf(chart);
    return makeBoard('jinkou', `金口诀 · 地分${chart.diFen}`, chart.configHash, [
      {
        title: '四位（人元·贵神·月将·地分）',
        layout: 'list',
        cells: [
          { key: 'ry', label: '人元（天·干）', content: `${chart.renYuan}（${w.renYuan}）` },
          { key: 'gs', label: '贵神（人·将）', content: `${chart.guiShen}（${w.guiShen}）`, sub: `${chart.isDayGui ? '昼' : '夜'}贵${chart.guiRen}` },
          { key: 'yj', label: '月将（事·支）', content: `${chart.yueJiang}（${w.yueJiang}）` },
          { key: 'df', label: '地分（地·支）', content: `${chart.diFen}（${w.diFen}）` },
        ],
      },
      {
        title: '天将与辅助信息',
        layout: 'list',
        cells: [
          { key: 'h', label: '月将加占时', content: `月将${chart.yueJiang}加占时${chart.heaven[chart.yueJiang] ?? ''}` },
          { key: 'df', label: '地分来源', content: chart.diFenSource === 'numbers' ? '报数取地分' : '时间起课（占时支）' },
          { key: 'k', label: '旬空', content: chart.xunKong },
          { key: 'm', label: '驿马', content: chart.yiMa },
        ],
      },
    ]);
  },
  evidence() {
    return [{ ruleId: 'jinkou.generic', keywords: ['金口诀', '人元', '贵神', '地分', '月将', '四位'] }];
  },
  warnings() {
    return [];
  },
  knowledgePack: { id: 'jinkou', refs: ['jinkou-shenke'] },
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
        templateId: 'jinkou.generic.v1',
        category: '其他',
        sections: [
          { id: 'conclusion', from: 'composer' },
          { id: 'signals', from: 'core.rules' },
          { id: 'disclaimer', from: 'answer.safety', always: true },
        ],
        forbidden: [],
        recordHint: '记录四位生克与实际应验（方位/时机），事后回标校准',
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