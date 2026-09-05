/**
 * 太阳视黄经计算
 *
 * 两个实现，统一接口：
 *  - simplifiedMeeus：自研简化版（《Astronomical Algorithms》ch.25 低精度太阳坐标）
 *  - vsop87（research）：astronomy-engine 的 VSOP87 真黄经（精度 ~0.5 角秒），默认主线用
 *
 * 精度表述：简化 Meeus 误差约 0.01°（对应节气时刻约 ±15 分钟），仅用于快速估算与均时差；
 * 节气定气一律以 vsop87 为主（满足「瞬时差 ≤2 分钟」的设计阈值）。
 */

export interface SolarLongitudeFn {
  /** 给定 JDE（力学时），返回视黄经（0–360°，含岁差归算后的视位置）。 */
  (jde: number): number;
}

import { jdToDate, deltaTSeconds } from './jde.js';

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/**
 * 自研简化 Meeus 太阳视黄经。
 * T 为儒略世纪；返回视黄经（度），已含光行差与章动修正。
 */
export function simplifiedMeeusSolarLongitude(jde: number): number {
  const T = (jde - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mr = M * DEG;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
    0.000289 * Math.sin(3 * Mr);
  const trueLong = norm360(L0 + C);
  const omega = 125.04 - 1934.136 * T;
  // 光行差 -0.00569 + 章动 -0.00478·sin(Ω)
  return norm360(trueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG));
}

let vsopFn: SolarLongitudeFn | null = null;

/**
 * VSOP87 视黄经（astronomy-engine，惰性加载）。
 * 纯 TS、离线、三壳可用；作为节气定气主引擎与校准源。
 * 注意：① 太阳以地心黄经（SunPosition）计算，不能用 EclipticLongitude（日心无定义）；
 *      ② AstroTime 构造参数是「J2000 起算天数」（UT），需先将 JDE 换算为 UT 再传入。
 */
export async function loadVsop87(): Promise<SolarLongitudeFn> {
  if (vsopFn) return vsopFn;
  const mod = await import('astronomy-engine');
  vsopFn = (jde: number) => {
    const { year } = jdToDate(jde);
    const ut = jde - deltaTSeconds(year) / 86400 - 2451545.0;
    const time = new mod.AstroTime(ut);
    const pos = mod.SunPosition(time);
    return norm360(pos.elon);
  };
  return vsopFn;
}

/** 默认太阳黄经实现：异步就绪后使用 VSOP87；同步场景回退简化 Meeus。 */
let ready: Promise<SolarLongitudeFn> | null = null;
export function solarLongitude(): Promise<SolarLongitudeFn> {
  if (!ready) {
    ready = loadVsop87().catch(() => simplifiedMeeusSolarLongitude as SolarLongitudeFn);
  }
  return ready;
}

/**
 * 用牛顿迭代求太阳黄经等于 target 的时刻（JDE）。
 * 太阳日行约 0.9856°，在 seed 前后扫描 ±40 天再二分收敛。
 */
export async function solarTermJde(targetLongitude: number, seedJde: number, fn?: SolarLongitudeFn): Promise<number> {
  const f = fn ?? (await solarLongitude());
  const target = norm360(targetLongitude);
  let lo = seedJde - 40;
  let hi = seedJde + 40;
  let loV = norm360(f(lo) - target);
  let hiV = norm360(f(hi) - target);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const midV = norm360(f(mid) - target);
    if (Math.abs(midV) < 1e-7) return mid;
    const signLo = loV < 180 ? 0 : 1;
    const signMid = midV < 180 ? 0 : 1;
    if (signLo === signMid) {
      lo = mid;
      loV = midV;
    } else {
      hi = mid;
      hiV = midV;
    }
  }
  return (lo + hi) / 2;
}
