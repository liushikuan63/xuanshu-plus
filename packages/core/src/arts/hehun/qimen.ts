import { WUXING_KE, WUXING_SHENG, type WuXing } from '../../calendar/ganzhi.js';
import { castQimen, type QimenChart, type QimenPalace } from '../qimen/engine.js';

export interface QimenRelationshipMoment {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
}

export type QimenRelationshipVerdict = '相合' | '中性' | '注意';

export interface QimenRelationshipItem {
  id: 'yi' | 'geng' | 'relation' | 'liuhe' | 'leaders';
  label: string;
  verdict: QimenRelationshipVerdict;
  detail: string;
  explanation: string;
  scoreEffect: number;
  basis: string[];
}

export interface QimenRelationshipResult {
  chart: QimenChart;
  chartSummary: string;
  score: number;
  items: QimenRelationshipItem[];
  summary: string;
  disclaimer: string;
}

const PALACE_ELEMENT: Record<number, WuXing> = {
  1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火',
};
const FAVORABLE_DOORS = new Set(['开', '休', '生']);
const SUPPORTIVE_STARS = new Set(['天心', '天辅', '天任']);

interface PalaceHit {
  palace: QimenPalace;
  layer: '天盘' | '地盘' | '八神';
}

function palaceLabel(palace: QimenPalace): string {
  return `${palace.direction}·${palace.bagua}${palace.num}宫`;
}

function palaceOf(chart: QimenChart, target: string): PalaceHit | null {
  const heaven = chart.palaces.find((palace) => palace.heavenStem === target);
  if (heaven) return { palace: heaven, layer: '天盘' };
  const earth = chart.palaces.find((palace) => palace.earthStem === target);
  if (earth) return { palace: earth, layer: '地盘' };
  const god = chart.palaces.find((palace) => palace.god === target);
  return god ? { palace: god, layer: '八神' } : null;
}

function palaceFacts(hit: PalaceHit | null): string[] {
  if (!hit) return ['盘中未定位'];
  const palace = hit.palace;
  return [
    `${hit.layer}${hit.layer === '八神' ? '' : '干'}落${palaceLabel(palace)}`,
    `九星${palace.star}、八门${palace.door}、八神${palace.god}`,
    `宫位五行${PALACE_ELEMENT[palace.num]}`,
  ];
}

function positionVerdict(chart: QimenChart, hit: PalaceHit | null): { verdict: QimenRelationshipVerdict; effect: number; reason: string } {
  if (!hit) return { verdict: '中性', effect: 0, reason: '未定位，按中性处理' };
  const empty = chart.xunKongPalaces.includes(hit.palace.num);
  if (empty) return { verdict: '注意', effect: -4, reason: '所在宫逢旬空，传统上视为信息暂不落实' };
  if (FAVORABLE_DOORS.has(hit.palace.door) || SUPPORTIVE_STARS.has(hit.palace.star)) {
    return { verdict: '相合', effect: 4, reason: '所在宫见三吉门或支持性九星' };
  }
  return { verdict: '中性', effect: 0, reason: '所在宫未见本规则的明显加减项' };
}

function relationOf(first: QimenPalace, second: QimenPalace): { label: string; verdict: QimenRelationshipVerdict; effect: number } {
  const firstElement = PALACE_ELEMENT[first.num];
  const secondElement = PALACE_ELEMENT[second.num];
  if (!firstElement || !secondElement) return { label: '中性', verdict: '中性', effect: 0 };
  if (firstElement === secondElement) return { label: '比和', verdict: '相合', effect: 8 };
  if (WUXING_SHENG[firstElement] === secondElement || WUXING_SHENG[secondElement] === firstElement) {
    return { label: '相生', verdict: '相合', effect: 10 };
  }
  if (WUXING_KE[firstElement] === secondElement || WUXING_KE[secondElement] === firstElement) {
    return { label: '相克', verdict: '注意', effect: -10 };
  }
  return { label: '中性', verdict: '中性', effect: 0 };
}

/** 以问事时刻的奇门盘观察关系互动，不把乙庚强制映射为现实性别。 */
export function qimenRelationship(chart: QimenChart): QimenRelationshipResult {
  const yi = palaceOf(chart, '乙');
  const geng = palaceOf(chart, '庚');
  const liuhe = palaceOf(chart, '六合');
  const yiState = positionVerdict(chart, yi);
  const gengState = positionVerdict(chart, geng);
  const relationship = yi && geng ? relationOf(yi.palace, geng.palace) : null;
  const liuheState = positionVerdict(chart, liuhe);
  const leaderDoorGood = FAVORABLE_DOORS.has(chart.valueDoor);
  const leaderEffect = (leaderDoorGood ? 4 : 0) - (chart.fanyin || chart.fuyin ? 5 : 0);
  const leaderVerdict: QimenRelationshipVerdict = leaderEffect > 0 ? '相合' : leaderEffect < 0 ? '注意' : '中性';

  const items: QimenRelationshipItem[] = [
    {
      id: 'yi', label: '乙方象落宫', verdict: yiState.verdict,
      detail: yi ? `${palaceLabel(yi.palace)} · ${yi.layer}` : '盘中未定位乙奇',
      explanation: yiState.reason, scoreEffect: yiState.effect, basis: palaceFacts(yi),
    },
    {
      id: 'geng', label: '庚方象落宫', verdict: gengState.verdict,
      detail: geng ? `${palaceLabel(geng.palace)} · ${geng.layer}` : '盘中未定位庚',
      explanation: gengState.reason, scoreEffect: gengState.effect, basis: palaceFacts(geng),
    },
    {
      id: 'relation', label: '乙庚宫位关系', verdict: relationship?.verdict ?? '中性',
      detail: yi && geng && relationship
        ? `${PALACE_ELEMENT[yi.palace.num]}（乙）与${PALACE_ELEMENT[geng.palace.num]}（庚）${relationship.label}`
        : '乙或庚未定位，无法比较宫位五行',
      explanation: relationship?.verdict === '相合'
        ? '宫位五行相生或比和，可作为互动较协调的传统象意。'
        : relationship?.verdict === '注意'
          ? '宫位五行相克，只提示差异需要沟通，不代表关系结果。'
          : '当前盘面没有形成明确的生克判断。',
      scoreEffect: relationship?.effect ?? 0,
      basis: yi && geng ? [`乙在${yi.palace.num}宫，五行${PALACE_ELEMENT[yi.palace.num]}`, `庚在${geng.palace.num}宫，五行${PALACE_ELEMENT[geng.palace.num]}`] : ['宫位信息不足'],
    },
    {
      id: 'liuhe', label: '六合婚约象', verdict: liuheState.verdict,
      detail: liuhe ? `${palaceLabel(liuhe.palace)} · ${liuhe.palace.star}/${liuhe.palace.door}` : '盘中未定位六合',
      explanation: liuheState.reason, scoreEffect: liuheState.effect, basis: palaceFacts(liuhe),
    },
    {
      id: 'leaders', label: '值符值使与盘势', verdict: leaderVerdict,
      detail: `值符${chart.valueStar}、值使${chart.valueDoor}；${chart.fuyin ? '伏吟' : chart.fanyin ? '反吟' : '无伏吟反吟'}`,
      explanation: chart.fuyin || chart.fanyin
        ? '伏吟或反吟只提示事情可能停滞或反复，应结合现实沟通复核。'
        : leaderDoorGood ? '值使落三吉门之一，作为当前盘势的温和加分项。' : '值使不在本规则的三吉门内，按中性处理。',
      scoreEffect: leaderEffect,
      basis: [`${chart.term}·${chart.yangDun ? '阳遁' : '阴遁'}${chart.ju}局·${chart.yuan}元`, `旬首${chart.xunShou}，旬空${chart.xunKong}`],
    },
  ];
  const score = Math.max(20, Math.min(90, 50 + items.reduce((sum, item) => sum + item.scoreEffect, 0)));
  const positive = items.filter((item) => item.verdict === '相合').length;
  const caution = items.filter((item) => item.verdict === '注意').length;

  return {
    chart,
    chartSummary: `${chart.term}·${chart.yangDun ? '阳遁' : '阴遁'}${chart.ju}局·${chart.yuan}元（${chart.day}日 ${chart.hour}时）`,
    score,
    items,
    summary: `五项奇门关系维度综合参考 ${score} 分，其中 ${positive} 项相合、${caution} 项需留意；分值用于整理盘面差异，不是关系质量或结果的概率。`,
    disclaimer: '奇门关系分析属于问事时刻的传统文化参考，不映射现实性别，不判断第三方介入，也不应替代双方沟通或重大关系决定。',
  };
}

function validMoment(moment: QimenRelationshipMoment): boolean {
  const date = new Date(Date.UTC(moment.year, moment.month - 1, moment.day));
  return Number.isInteger(moment.year) && moment.year >= 1900 && moment.year <= 2100
    && Number.isInteger(moment.month) && Number.isInteger(moment.day)
    && date.getUTCFullYear() === moment.year && date.getUTCMonth() === moment.month - 1 && date.getUTCDate() === moment.day
    && Number.isInteger(moment.hour) && moment.hour >= 0 && moment.hour <= 23
    && Number.isInteger(moment.minute ?? 0) && (moment.minute ?? 0) >= 0 && (moment.minute ?? 0) <= 59;
}

export async function qimenRelationshipOf(moment: QimenRelationshipMoment): Promise<QimenRelationshipResult> {
  if (!validMoment(moment)) throw new RangeError(`无效问事时刻：${moment.year}-${moment.month}-${moment.day} ${moment.hour}:${moment.minute ?? 0}`);
  const date = new Date(moment.year, moment.month - 1, moment.day, moment.hour, moment.minute ?? 0, 0);
  const chart = await castQimen({
    kind: 'time',
    time: { ...moment, minute: moment.minute ?? 0, second: 0, tzOffsetHours: 8 },
  }, { now: date, random: () => 0.5, tzOffsetHours: 8 });
  return qimenRelationship(chart);
}
