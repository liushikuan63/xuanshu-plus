/**
 * 均时差（Equation of Time）——真太阳时与平太阳时之差
 * 采用简化 Meeus 太阳坐标 + 日赤经近似，误差在分钟级，满足真太阳时校正用途。
 */

import { simplifiedMeeusSolarLongitude } from './solarLongitude.js';

const DEG = Math.PI / 180;

const OBLIQUITY = 23.4397; // 平均黄赤交角（简化）

/**
 * 均时差（分钟）。正 = 真太阳时快于平太阳时。
 * @param jde 力学时
 */
export function equationOfTimeMinutes(jde: number): number {
  const T = (jde - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T; // 平黄经
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG; // 平近点角
  const lambda = simplifiedMeeusSolarLongitude(jde) * DEG; // 视黄经
  const alpha = Math.atan2(Math.cos(OBLIQUITY * DEG) * Math.sin(lambda), Math.cos(lambda)); // 视赤经
  let eot = (L0 * DEG - 0.0057183 - alpha + Math.PI) % (2 * Math.PI) - Math.PI; // 度
  eot = (eot / DEG) * 4; // 分钟
  return eot;
}
