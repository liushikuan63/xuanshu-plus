/**
 * 小六壬引擎（v8 §P4：速断 · 最简术数）
 * 掌诀：大安→留连→速喜→赤口→小吉→空亡 六宫循环。
 * 推法：大安起正月 → 月上起日 → 日上起时，得「三宫」（起/中/末），末宫主断。
 * 农历月/日取自 lunar-javascript；时辰按十二地支。
 */

import type { EngineCtx, NormalizedMoment, RawInput } from '../../types.js';
import { dateToJd } from '../../astronomy/jde.js';
import { dayGanZhiFromJdn } from '../../calendar/ganzhi.js';
import { solarToLunar } from '../../calendar/lunar.js';
import { configHashOf } from '../../plugins/registry.js';
import { xunKongOf } from '../liuyao/trigrams.js';

/** 六宫掌诀（固定次序，index 1..6） */
export interface LiuShenPalm {
  index: number;
  name: string;
  element: string;
  direction: string;
  god: string;
  omen: '吉' | '凶' | '变数';
  numberNote: string;
  short: string;
  gist: string;
  verse: string;
  yingqi: string;
  advice: string;
}

export const LIU_SHEN_PALMS: LiuShenPalm[] = [
  {
    index: 1, name: '大安', element: '木', direction: '东方', god: '青龙', omen: '吉', numberNote: '主数一、五、七',
    short: '身未动，安稳',
    gist: '主静止、安定、事缓；谋事可成，失物近处，行人未动，病者无妨。',
    verse: '失物去不远，宅舍保安康；行人身未动，病者主无妨；将军回田野，仔细更推详。',
    yingqi: '事缓，近日内平静无大波澜',
    advice: '宜守正安常、稳扎稳打；谋事宜缓图，向东方/近草木处为吉。',
  },
  {
    index: 2, name: '留连', element: '水', direction: '北方', god: '玄武', omen: '变数', numberNote: '主数二、八、十',
    short: '卒未归，迟滞',
    gist: '主纠缠、拖拉、未决；谋事且缓，往返反复，出行阻滞，宜守不宜进。',
    verse: '卒未归时难求财，主事迟滞多阻碍；失物南方见，急讨方称心；行人未即归，病者无妨害。',
    yingqi: '纠缠拖延，短期内难了结',
    advice: '宜搁置缓办、勿反复催促；防水边、北方与牵连扯皮之事。',
  },
  {
    index: 3, name: '速喜', element: '火', direction: '南方', god: '朱雀', omen: '吉', numberNote: '主数三、六、九',
    short: '人便至，喜事速',
    gist: '主迅速、喜讯、有贵人；谋事速成，失物可寻，行人立至，消息将至。',
    verse: '人便至时求财喜，六时来可喜相扶；失物坤方寻，行人立便至；谋事须速成，病者逢吉庆。',
    yingqi: '三、六、九日内即有应',
    advice: '宜速断速行、抓住眼前良机；向南、近火或文书贵人相助。',
  },
  {
    index: 4, name: '赤口', element: '金', direction: '西方', god: '白虎', omen: '凶', numberNote: '主数四、七、十',
    short: '官事凶，口舌',
    gist: '主口舌、争讼、刑伤；谋事多阻，防盗防失，出行谨慎，防是非嗔怪。',
    verse: '官事凶时防口舌，道路宜防有阻隔；失物急去寻，行人惊不定；官事主妨害，病者恐有刑。',
    yingqi: '事急，数日内恐有口舌争执',
    advice: '宜谨言慎行、早作防范；避西方、金属器械与口舌争讼之地。',
  },
  {
    index: 5, name: '小吉', element: '水', direction: '东南', god: '六合', omen: '吉', numberNote: '主数一、五、七',
    short: '人来喜，和合',
    gist: '主喜庆、和合、顺遂；谋事有成，交易称心，行人立至，凡事皆宜。',
    verse: '人来喜时多和合，凡事通泰有喜讯；失物在坤方，交易讨人喜；行人立便至，教我来扶持。',
    yingqi: '月内喜事可验',
    advice: '宜主动促成和合，谈婚论财皆宜；向东南、利谦和圆融。',
  },
  {
    index: 6, name: '空亡', element: '土', direction: '中央', god: '勾陈', omen: '凶', numberNote: '主数三、六、九',
    short: '音信稀，落空',
    gist: '主落空、无着、有始无终；谋事不实，失物难寻，行人难见，病者宜安养。',
    verse: '音信稀时多落空，凡事谋为多不成；失物西南去，经过此方寻；行人难显现，久病恐有险。',
    yingqi: '难有应验，易落空',
    advice: '宜降低预期、勿再投入强求；宜安养身心，静待时机。',
  },
];

export function palmOf(index: number): LiuShenPalm {
  return LIU_SHEN_PALMS[((index - 1) % 6 + 6) % 6]!;
}

/** 时辰 → 地支序号 1..12（子=1） */
export function hourBranchNum(hour: number): number {
  return ((Math.floor((hour + 1) / 2)) % 12) + 1;
}

/** 三宫推得：giv起宫（月）、中宫（日）、末宫（时） */
export function xiaoliurenPositions(lunarMonth: number, lunarDay: number, hourBranch: number): { chu: number; zhong: number; mo: number } {
  const chu = ((lunarMonth - 1) % 6 + 6) % 6 + 1;
  const zhong = ((chu - 1 + lunarDay - 1) % 6 + 6) % 6 + 1;
  const mo = ((zhong - 1 + hourBranch - 1) % 6 + 6) % 6 + 1;
  return { chu, zhong, mo };
}

export const HOUR_BRANCH_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export interface XiaoliurenChart {
  art: 'xiaoliuren';
  method: string;
  lunarText: string;
  chu: LiuShenPalm;
  zhong: LiuShenPalm;
  mo: LiuShenPalm;
  result: LiuShenPalm; // 末宫主断
  omen: '吉' | '凶' | '变数';
  judgment: string;
  configHash: string;
  normalized: NormalizedMoment;
}

/** 报数起课：三个数（月、日、时）直接推三宫 */
export function xiaoliurenByNumbers(a: number, b: number, c: number): { chu: number; zhong: number; mo: number } {
  const month = ((a - 1) % 12 + 12) % 12 + 1;
  const day = ((b - 1) % 30 + 30) % 30 + 1;
  const hour = ((c - 1) % 12 + 12) % 12 + 1;
  return xiaoliurenPositions(month, day, hour);
}

export async function buildXiaoliurenChart(
  positions: { chu: number; zhong: number; mo: number },
  meta: { method: string; lunarText: string },
  normalized: NormalizedMoment,
): Promise<XiaoliurenChart> {
  const { chu, zhong, mo } = positions;
  const result = palmOf(mo);
  return {
    art: 'xiaoliuren',
    method: meta.method,
    lunarText: meta.lunarText,
    chu: palmOf(chu),
    zhong: palmOf(zhong),
    mo: result,
    result,
    omen: result.omen,
    judgment: `末宫${result.name}——${result.short}。${result.gist}`,
    configHash: configHashOf({
      art: 'xiaoliuren',
      v: 1,
      chu, zhong, mo,
      date: `${normalized.year}-${normalized.month}-${normalized.day}`,
    }),
    normalized,
  };
}

export async function normalizeSmallLiuRen(input: RawInput, ctx: EngineCtx, tzOffsetHours = 8): Promise<NormalizedMoment> {
  const t = input.time
    ? { year: input.time.year, month: input.time.month, day: input.time.day, hour: input.time.hour, minute: input.time.minute ?? 0, second: input.time.second ?? 0, tzOffsetHours: input.time.tzOffsetHours ?? tzOffsetHours }
    : { year: ctx.now.getFullYear(), month: ctx.now.getMonth() + 1, day: ctx.now.getDate(), hour: ctx.now.getHours(), minute: ctx.now.getMinutes(), second: ctx.now.getSeconds(), tzOffsetHours };
  const jd = dateToJd(t.year, t.month, t.day, t.hour + t.minute / 60 + t.second / 3600) - t.tzOffsetHours / 24;
  const jdn = Math.floor(jd + 0.5);
  return {
    year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second,
    jd, jdn, tzOffsetHours: t.tzOffsetHours,
    dayGanZhiIndex: dayGanZhiFromJdn(jdn).index,
    xunKong: xunKongOf(dayGanZhiFromJdn(jdn).index).join(''),
  };
}

export async function castXiaoliuren(input: RawInput, ctx: EngineCtx): Promise<XiaoliurenChart> {
  const hourNow = input.time?.hour ?? ctx.now.getHours();
  if (input.kind === 'numbers' && input.numbers && input.numbers.length >= 3) {
    const positions = xiaoliurenByNumbers(input.numbers[0]!, input.numbers[1]!, input.numbers[2]!);
    return buildXiaoliurenChart(
      positions,
      { method: `报数 ${input.numbers[0]}, ${input.numbers[1]}, ${input.numbers[2]}`, lunarText: '' },
      await normalizeSmallLiuRen(input, ctx, ctx.tzOffsetHours ?? 8),
    );
  }
  const t = input.time
    ? { year: input.time.year, month: input.time.month, day: input.time.day, hour: input.time.hour }
    : { year: ctx.now.getFullYear(), month: ctx.now.getMonth() + 1, day: ctx.now.getDate(), hour: hourNow };
  const lunar = await solarToLunar(t.year, t.month, t.day, t.hour);
  const hour = hourBranchNum(t.hour);
  const positions = xiaoliurenPositions(lunar.lunarMonth, lunar.lunarDay, hour);
  return buildXiaoliurenChart(
    positions,
    { method: `农历${lunar.lunarMonth}月${lunar.lunarDay}日 ${HOUR_BRANCH_NAMES[hour - 1]}时`, lunarText: lunar.lunarText },
    await normalizeSmallLiuRen(input, ctx, ctx.tzOffsetHours ?? 8),
  );
}