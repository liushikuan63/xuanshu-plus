import {
  DIZHI,
  GAN_WUXING,
  WUXING_KE,
  WUXING_SHENG,
  ZHI_LIUHE,
  ZHI_SANHE,
  ZHI_WUXING,
  zhiChong,
  type WuXing,
  type Zhi,
} from '../../calendar/ganzhi.js';
import { buildBazi, type BaziChart, type BaziConfig } from '../bazi/engine.js';

export interface HehunBirth {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  gender: 'male' | 'female';
}

export type HehunVerdict = '相合' | '中性' | '注意';

export interface HehunItem {
  id: 'zodiac' | 'nayin' | 'dayStem' | 'spousePalace' | 'favorable' | 'elements' | 'markers';
  label: string;
  verdict: HehunVerdict;
  detail: string;
  explanation: string;
  scoreEffect: number;
}

export interface BaziHehunResult {
  pair: { first: string; second: string };
  score: number;
  items: HehunItem[];
  strengths: string[];
  cautions: string[];
  summary: string;
  disclaimer: string;
}

const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'] as const;
const SIX_HARMS: ReadonlyArray<readonly [Zhi, Zhi]> = [
  ['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌'],
];
const STEM_COMBINATIONS: ReadonlyArray<readonly [string, string, WuXing]> = [
  ['甲', '己', '土'], ['乙', '庚', '金'], ['丙', '辛', '水'], ['丁', '壬', '木'], ['戊', '癸', '火'],
];
const YIN_YANG_ERROR_DAYS = new Set(['丙子', '丙午', '丁丑', '丁未', '戊寅', '戊申', '辛卯', '辛酉', '壬辰', '壬戌', '癸巳', '癸亥']);

type BranchRelation = '六合' | '同三合局' | '六冲' | '六害' | '比和' | '普通';

function branchRelation(first: Zhi, second: Zhi): BranchRelation {
  if (first === second) return '比和';
  if (ZHI_LIUHE[first] === second) return '六合';
  if (zhiChong(first) === second) return '六冲';
  if (SIX_HARMS.some(([a, b]) => (a === first && b === second) || (a === second && b === first))) return '六害';
  if (ZHI_SANHE[first].includes(second)) return '同三合局';
  return '普通';
}

function relationVerdict(relation: BranchRelation): HehunVerdict {
  if (['六合', '同三合局', '比和'].includes(relation)) return '相合';
  if (['六冲', '六害'].includes(relation)) return '注意';
  return '中性';
}

function effectFor(verdict: HehunVerdict, positive: number, negative: number): number {
  return verdict === '相合' ? positive : verdict === '注意' ? -negative : 0;
}

function elementFromNayin(value: string): WuXing {
  return (['木', '火', '土', '金', '水'] as WuXing[]).find((element) => value.includes(element)) ?? '土';
}

function elementRelation(first: WuXing, second: WuXing): '相生' | '比和' | '相克' {
  if (first === second) return '比和';
  if (WUXING_SHENG[first] === second || WUXING_SHENG[second] === first) return '相生';
  return '相克';
}

function distribution(chart: BaziChart): Record<WuXing, number> {
  const result: Record<WuXing, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const pillar of [chart.year, chart.month, chart.day, chart.hour]) {
    result[GAN_WUXING[pillar.gan]] += 1;
    result[ZHI_WUXING[pillar.zhi]] += 1;
  }
  return result;
}

function favorable(chart: BaziChart): WuXing[] {
  const master = GAN_WUXING[chart.dayMaster];
  const generatedBy = (Object.keys(WUXING_SHENG) as WuXing[]).find((element) => WUXING_SHENG[element] === master)!;
  if (chart.dayMasterStrength === '强') return [WUXING_SHENG[master], WUXING_KE[master]];
  if (chart.dayMasterStrength === '弱') return [master, generatedBy];
  return [master, WUXING_SHENG[master]];
}

function pillars(chart: BaziChart): string {
  return [chart.year, chart.month, chart.day, chart.hour].map((pillar) => `${pillar.gan}${pillar.zhi}`).join(' ');
}

export function compareBaziCharts(first: BaziChart, second: BaziChart): BaziHehunResult {
  const items: HehunItem[] = [];

  const yearRelation = branchRelation(first.year.zhi, second.year.zhi);
  const yearVerdict = relationVerdict(yearRelation);
  items.push({
    id: 'zodiac', label: '生肖与年支', verdict: yearVerdict,
    detail: `${ZODIAC[DIZHI.indexOf(first.year.zhi)]}（${first.year.zhi}）与${ZODIAC[DIZHI.indexOf(second.year.zhi)]}（${second.year.zhi}）：${yearRelation}`,
    explanation: yearVerdict === '相合' ? '传统地支关系较协调。' : yearVerdict === '注意' ? '传统地支关系存在冲害，适合把差异落实到具体沟通习惯。' : '没有明显合冲，按普通关系看待。',
    scoreEffect: effectFor(yearVerdict, 9, 7),
  });

  const firstNayin = elementFromNayin(first.year.nayin);
  const secondNayin = elementFromNayin(second.year.nayin);
  const nayinRelation = elementRelation(firstNayin, secondNayin);
  const nayinVerdict: HehunVerdict = nayinRelation === '相克' ? '注意' : '相合';
  items.push({
    id: 'nayin', label: '年柱纳音', verdict: nayinVerdict,
    detail: `${first.year.nayin}与${second.year.nayin}：${nayinRelation}`,
    explanation: '纳音只作为传统辅助维度，权重低于双方真实相处与夫妻宫。',
    scoreEffect: effectFor(nayinVerdict, 4, 3),
  });

  const stemCombination = STEM_COMBINATIONS.find(([a, b]) =>
    (a === first.day.gan && b === second.day.gan) || (a === second.day.gan && b === first.day.gan),
  );
  items.push({
    id: 'dayStem', label: '日干五合', verdict: stemCombination ? '相合' : '中性',
    detail: stemCombination ? `${first.day.gan}${second.day.gan}相合，合化${stemCombination[2]}` : `${first.day.gan}与${second.day.gan}无日干五合`,
    explanation: stemCombination ? '传统上视为表达方式或取向有相吸之处。' : '没有日干五合并不代表关系不合。',
    scoreEffect: stemCombination ? 7 : 0,
  });

  const spouseRelation = branchRelation(first.day.zhi, second.day.zhi);
  const spouseVerdict = relationVerdict(spouseRelation);
  items.push({
    id: 'spousePalace', label: '夫妻宫（日支）', verdict: spouseVerdict,
    detail: `${first.day.zhi}与${second.day.zhi}：${spouseRelation}`,
    explanation: spouseVerdict === '相合' ? '夫妻宫关系较协调，可继续观察现实生活节奏。' : spouseVerdict === '注意' ? '夫妻宫有冲害，适合提前讨论边界、财务和生活分工。' : '夫妻宫关系中性，需要结合实际互动。',
    scoreEffect: effectFor(spouseVerdict, 12, 10),
  });

  const firstMaster = GAN_WUXING[first.dayMaster];
  const secondMaster = GAN_WUXING[second.dayMaster];
  const firstFav = favorable(first);
  const secondFav = favorable(second);
  const firstHelped = firstFav.includes(secondMaster);
  const secondHelped = secondFav.includes(firstMaster);
  const favorableVerdict: HehunVerdict = firstHelped || secondHelped ? '相合' : '中性';
  items.push({
    id: 'favorable', label: '喜用互补', verdict: favorableVerdict,
    detail: `甲方参考喜${firstFav.join('、')}，乙方参考喜${secondFav.join('、')}；${firstHelped ? '乙方日主补甲方' : ''}${firstHelped && secondHelped ? '，' : ''}${secondHelped ? '甲方日主补乙方' : ''}${!firstHelped && !secondHelped ? '未形成直接互补' : ''}`,
    explanation: favorableVerdict === '相合' ? '一方日主五行落在另一方简化喜用范围内。' : '简化喜用没有直接互补，仍应以完整命局和现实关系为准。',
    scoreEffect: favorableVerdict === '相合' ? 8 : 0,
  });

  const firstDistribution = distribution(first);
  const secondDistribution = distribution(second);
  const elements = Object.keys(firstDistribution) as WuXing[];
  const firstMissing = elements.filter((element) => firstDistribution[element] === 0);
  const secondMissing = elements.filter((element) => secondDistribution[element] === 0);
  const firstSupplied = firstMissing.filter((element) => secondDistribution[element] > 0);
  const secondSupplied = secondMissing.filter((element) => firstDistribution[element] > 0);
  const elementVerdict: HehunVerdict = firstSupplied.length + secondSupplied.length > 0 ? '相合' : '中性';
  items.push({
    id: 'elements', label: '五行分布互补', verdict: elementVerdict,
    detail: `甲方木${firstDistribution.木}火${firstDistribution.火}土${firstDistribution.土}金${firstDistribution.金}水${firstDistribution.水}；乙方木${secondDistribution.木}火${secondDistribution.火}土${secondDistribution.土}金${secondDistribution.金}水${secondDistribution.水}`,
    explanation: elementVerdict === '相合' ? `对方分布可覆盖的缺项：${[...firstSupplied, ...secondSupplied].join('、')}。` : '双方均无可由对方直接补足的零值项，按中性处理。',
    scoreEffect: elementVerdict === '相合' ? 6 : 0,
  });

  const firstDay = `${first.day.gan}${first.day.zhi}`;
  const secondDay = `${second.day.gan}${second.day.zhi}`;
  const markers = [
    ...Object.keys(first.shensha).map((name) => `甲方${name}`),
    ...Object.keys(second.shensha).map((name) => `乙方${name}`),
    ...(YIN_YANG_ERROR_DAYS.has(firstDay) ? ['甲方阴差阳错日'] : []),
    ...(YIN_YANG_ERROR_DAYS.has(secondDay) ? ['乙方阴差阳错日'] : []),
  ];
  const hasCautionMarker = markers.some((value) => value.includes('阴差阳错'));
  items.push({
    id: 'markers', label: '辅助神煞', verdict: hasCautionMarker ? '注意' : '中性',
    detail: markers.join('、') || '双方当前规则未检出相关标记',
    explanation: '神煞只作低权重提示，不可单独作为关系决定依据。',
    scoreEffect: hasCautionMarker ? -3 : 0,
  });

  const score = Math.max(20, Math.min(90, 50 + items.reduce((sum, item) => sum + item.scoreEffect, 0)));
  const strengths = items.filter((item) => item.verdict === '相合').map((item) => `${item.label}：${item.detail}`);
  const cautions = items.filter((item) => item.verdict === '注意').map((item) => `${item.label}：${item.detail}`);

  return {
    pair: { first: pillars(first), second: pillars(second) },
    score,
    items,
    strengths,
    cautions,
    summary: `七项传统维度综合参考 ${score} 分，其中 ${strengths.length} 项相合、${cautions.length} 项需留意；结果用于整理差异，不替代双方沟通与现实判断。`,
    disclaimer: '合婚属于传统文化比较，不给出宜婚、忌婚或关系成败结论，也不应作为重大关系决定的唯一依据。',
  };
}

export async function baziHehunOf(
  first: HehunBirth,
  second: HehunBirth,
  config?: BaziConfig,
): Promise<BaziHehunResult> {
  const [firstChart, secondChart] = await Promise.all([
    buildBazi(first, config),
    buildBazi(second, config),
  ]);
  return compareBaziCharts(firstChart, secondChart);
}
