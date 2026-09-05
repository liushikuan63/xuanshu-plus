/**
 * 大六壬插件（ShuPlugin 实现）
 */

import type { RawInput, RuleHit } from '../../types.js';
import type { ShuPlugin } from '../../plugins/contract.js';
import { makeBoard } from '../../board/schema.js';
import { ZHI_WUXING, WUXING_SHENG, WUXING_KE, type Zhi } from '../../calendar/ganzhi.js';
import {
  castLiuRen,
  normalizeLiuRen,
  STEM_HOME,
  TWELVE_GODS,
  type LiuRenChart,
} from './engine.js';

const ZHI_WX = ZHI_WUXING as Record<Zhi, string>;
const SHENG: Record<string, string> = WUXING_SHENG;
const KE: Record<string, string> = WUXING_KE;

/** 课体关系 → 速断（D 级） */
function keBreif(ke: LiuRenChart['ke']): string {
  return ke.map((k) => `${k.index}课：${k.lower}上${k.upper}（${k.relation}）`).join('；');
}

/** 凶将集合（白虎/朱雀/螣蛇/玄武/天空） */
const XIONG_GODS = ['白虎', '朱雀', '螣蛇', '玄武', '天空'];

/** 用神与日干生克：用神支五行 vs 日干寄宫五行 */
function yongShenText(chart: LiuRenChart): { text: string; sev: '吉' | '变数' | '凶' } {
  const yongWx = chart.heaven[chart.chuChuan];
  const dWx = ZHI_WX[STEM_HOME[chart.dayGan] as Zhi];
  const sWx = ZHI_WX[yongWx as Zhi];
  if (SHENG[sWx] === dWx) return { text: `用神（${chart.chuChuan}）上神之力生助日干，主事来助我、进展顺遂`, sev: '吉' };
  if (SHENG[dWx] === sWx) return { text: `日干生用神，主我为事出力、耗费心力`, sev: '变数' };
  if (KE[sWx] === dWx) return { text: `用神克日干，主事压于我、防被动受阻`, sev: '凶' };
  if (KE[dWx] === sWx) return { text: `日干克用神，主我能制事、但费周折`, sev: '变数' };
  return { text: `用神与日干比和，主事体与我相当、不紧不慢`, sev: '吉' };
}

export const liurenPlugin: ShuPlugin<RawInput, LiuRenChart> = {
  id: 'liuren',
  name: '大六壬',
  version: '0.1.0',
  art: 'liuren',
  category: 'paipan',
  configSchema: { type: 'object', properties: {} },
  async normalize(input, ctx) {
    return normalizeLiuRen(input, ctx, ctx.tzOffsetHours ?? 8);
  },
  async compute(input, ctx) {
    return castLiuRen(input, ctx, ctx.tzOffsetHours ?? 8);
  },
  async rules(chart): Promise<RuleHit[]> {
    const rules: RuleHit[] = [];

    // 定课信息
    rules.push({
      ruleId: 'liuren.dingke',
      text: `月将${chart.monthJiang}加占时${chart.shiZhi}；${keBreif(chart.ke)}。${chart.fuYin ? '天地盘伏吟' : chart.fanYin ? '天地盘返吟' : ''}`,
      severity: chart.fuYin || chart.fanYin ? '变数' : '提示',
      confidenceLevel: 'D',
      citations: [],
    });

    // 用神（初传）与三传
    const ys = yongShenText(chart);
    rules.push({
      ruleId: `liuren.yongshen.${chart.chuChuanGate}`,
      text: `${chart.chuChuanGate}取用神${chart.chuChuan}（${chart.ke.find((k) => k.upper === chart.chuChuan)?.index ?? ''}课）；三传：${chart.chuChuan} → ${chart.zhongChuan} → ${chart.moChuan}；${ys.text}。`,
      severity: ys.sev,
      confidenceLevel: 'D',
      citations: [],
    });
    // 涉害课白话讲解（《六壬粹言》毕法补谈按语：涉害深浅以「前行历藏干重数」分计；文意：受克深者为用，主事须历风霜而后得）
    if (chart.chuChuanGate === '涉害') {
      rules.push({
        ruleId: 'liuren.yongshen.shehai',
        text: `涉害课白话：候选的用神不止一个、也分不出哪个和日干更配时，就走「涉害」这一关——从它现在所临的位置往回数，一路数回它的「地盘本家」（老巢，本家这一站也算），每一站都算一笔账：这一站的地支克不克它（支神克记 1 重），站里寄住的天干克不克它（寅藏甲、辰藏乙、巳藏丙戊、未藏丁己、申藏庚、戌藏辛、亥藏壬、丑藏癸），藏干克它每字各记 1 重。账算完，谁被克得最深（涉害深）谁就发用。意思是这事急不得，往往要先吃几重苦头、费一番周折（“历尽风霜而后能得”），磨过去了事才成。`,
        severity: '变数',
        confidenceLevel: 'D',
        citations: [],
      });
      rules.push({
        ruleId: 'liuren.yongshen.shehai.tie',
        text: `涉害同深时的分判：深度一样、谁也不服谁，就先看它落在哪个位——取「四孟位」（寅申巳亥）上的那个发用（见机，机不可失）；孟位没有，再取「四仲位」（子午卯酉）上的（察微，察其毫末）；还分不出，才退取日干上神（阳日）/日支上神（阴日），或课中先出现的那个（复等）。`,
        severity: '提示',
        confidenceLevel: 'D',
        citations: [],
      });
    }

    // 三合局提示（八专例外：中末取干/支上神）
    rules.push({
      ruleId: 'liuren.zhongmo',
      text: chart.chuChuanGate === '八专'
        ? `八专中传${chart.zhongChuan}（干上神）、末传${chart.moChuan}（支上神），主题专一、事体集中。`
        : `中传${chart.zhongChuan}、末传${chart.moChuan}，中末与初传构成三合局（存三合之象，聚众力而就）。`,
      severity: '提示',
      confidenceLevel: 'D',
      citations: [],
    });

    // 贵人
    const guiGodsByBranch = Object.fromEntries(chart.guiGods.map((g) => [g.branch, g.god]));
    const yongGod = guiGodsByBranch[chart.chuChuan] ?? '—';
    const isXiong = XIONG_GODS.includes(yongGod);
    rules.push({
      ruleId: 'liuren.guiren',
      text: `${chart.isDayGui ? '昼' : '夜'}贵${chart.guiRen}，十二天将布支；用神${chart.chuChuan}所乘之将${yongGod}${isXiong ? '（凶将，白虎/朱雀/螣蛇/玄武/天空主惊忧口舌、见事宜慎）' : '（吉将）'}。`,
      severity: isXiong ? '变数' : '提示',
      confidenceLevel: 'D',
      citations: [],
    });

    // 旬空
    const kongBranches = chart.xunKongBranches.map((b) => b);
    const yongKong = kongBranches.includes(chart.chuChuan);
    rules.push({
      ruleId: 'liuren.kongwang',
      text: `日旬空亡「${chart.xunKong}」${kongBranches.length ? `（${kongBranches.join('、')}）` : ''}；${yongKong ? '用神落空，主事虚而未实、应期迟滞，待出空填实再看' : '用神不落空，主事体实在。'}`,
      severity: yongKong ? '变数' : '提示',
      confidenceLevel: 'D',
      citations: [],
    });

    // 驿马
    rules.push({
      ruleId: 'liuren.yima',
      text: `驿马在${chart.yiMa}，主变动迁动之机；用神临马主事有走动、宜动不宜静。`,
      severity: chart.chuChuan === chart.yiMa ? '变数' : '提示',
      confidenceLevel: 'D',
      citations: [],
    });

    return rules;
  },
  board(chart: LiuRenChart) {
    const keMarks = chart.ke.map((k) => `${k.index}课 ${k.lower}→${k.upper}`);
    const cells = chart.guiGods.map((g) => ({
      key: g.branch,
      label: `地盘${g.branch}`,
      content: `天盘${chart.heaven[g.branch]}`,
      sub: g.god,
    }));
    return makeBoard('liuren', `大六壬 · 月将${chart.monthJiang}加占时${chart.shiZhi}`, chart.configHash, [
      { title: '天地盘与十二天将', layout: 'grid', cells },
      {
        title: '四课三传',
        layout: 'list',
        cells: [
          { key: 'ke', label: '四课', content: keMarks.join('；') },
          { key: 'san', label: '三传', content: `${chart.chuChuan}（${chart.chuChuanGate}）→ ${chart.zhongChuan} → ${chart.moChuan}` },
          { key: 'gui', label: '贵人', content: `${chart.isDayGui ? '昼' : '夜'}贵${chart.guiRen}` },
          { key: 'kong', label: '旬空', content: chart.xunKong },
          { key: 'yima', label: '驿马', content: chart.yiMa },
          { key: 'fy', label: '伏返吟', content: chart.fuYin ? '伏吟' : chart.fanYin ? '返吟' : '否' },
        ],
      },
    ]);
  },
  evidence() {
    return [{ ruleId: 'liuren.generic', keywords: ['大六壬', '月将', '四课', '三传', '天将', '贵人', '驿马'] }];
  },
  warnings() {
    return [];
  },
  knowledgePack: { id: 'liuren', refs: ['liuren-danjing'] },
  fixtures: [],
  intake: {
    categories: ['决策', '出行', '失物', '官非', '合作', '其他'],
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
        templateId: 'liuren.generic.v1',
        category: '其他',
        sections: [
          { id: 'conclusion', from: 'composer' },
          { id: 'signals', from: 'core.rules' },
          { id: 'disclaimer', from: 'answer.safety', always: true },
        ],
        forbidden: [],
        recordHint: '记录四课三传与实际应验（方位/时机），事后回标校准',
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

export { TWELVE_GODS };