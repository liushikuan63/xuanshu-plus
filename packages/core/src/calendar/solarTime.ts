/**
 * 真太阳时：真太阳时 = 平太阳时（当地标准时）+ 经度差修正 + 均时差。
 * 仅在用户提供经度时可用；默认关闭并提示不确定性（v5 §4）。
 */

import { equationOfTimeMinutes } from '../astronomy/equationOfTime.js';
import { dateToJd } from '../astronomy/jde.js';

export interface TrueSolarTimeResult {
  /** 真太阳时（小时，含小数），0–24 */
  trueSolarHour: number;
  /** 均时差（分钟） */
  equationOfTime: number;
  /** 经度差修正（分钟）：(经度 - 标准经度) × 4 */
  longitudeCorrectionMinutes: number;
  /** 与标准时之差（分钟） */
  diffMinutes: number;
}

/**
 * 计算真太阳时。
 * @param year/month/day/hour 标准时（北京时间）年月日时
 * @param longitude 用户经度（东经为正）
 * @param tzOffsetHours 标准时区偏移（东八区 = 8）
 * @param standardLongitude 标准子午线经度（东八区 = 120）
 */
export function trueSolarTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  longitude: number,
  tzOffsetHours = 8,
  standardLongitude = 120,
): TrueSolarTimeResult {
  // 经度差修正：每度 4 分钟
  const longitudeCorrection = (longitude - standardLongitude) * 4;
  // 均时差：需要先近似当地真太阳时；两次迭代收敛
  let approx = hour + longitudeCorrection / 60;
  let eot = equationOfTimeMinutes(dateToJd(year, month, day, approx));
  let trueHour = hour + (longitudeCorrection + eot) / 60;
  for (let i = 0; i < 3; i++) {
    eot = equationOfTimeMinutes(dateToJd(year, month, day, trueHour));
    trueHour = hour + (longitudeCorrection + eot) / 60;
  }
  const diff = (longitudeCorrection + eot) / 60;
  let h = trueHour % 24;
  if (h < 0) h += 24;
  return {
    trueSolarHour: h,
    equationOfTime: eot,
    longitudeCorrectionMinutes: longitudeCorrection,
    diffMinutes: diff * 60,
  };
}
