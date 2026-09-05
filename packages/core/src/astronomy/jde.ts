/**
 * JDE / 儒略日转换与 ΔT（世界时→力学时）
 * 算法：Jean Meeus《Astronomical Algorithms》第 7、10 章
 */

/** 公历日期 → 儒略日（UT，浮点）。month 1-12；hour 含小数。 */
export function dateToJd(year: number, month: number, day: number, hour = 0): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    hour / 24 +
    b -
    1524.5
  );
}

/** JS Date（视为 UTC）→ JD */
export function dateToJdFromJsDate(d: Date): number {
  return dateToJd(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600,
  );
}

/** JD（浮点）→ 公历年月日时（UT）。返回 {year, month, day, hour} */
export function jdToDate(jd: number): { year: number; month: number; day: number; hour: number } {
  const jd0 = jd + 0.5;
  const z = Math.floor(jd0);
  let f = jd0 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const dayOfMonth = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  const dayInt = Math.floor(dayOfMonth);
  return { year, month, day: dayInt, hour: (dayOfMonth - dayInt) * 24 };
}

/**
 * ΔT（秒），Espenak & Meeus (2006) 多项式，覆盖 1900–2100。
 * 用于将 UT 时刻转换为 TT/ET（JDE = JDT + ΔT/86400）。
 */
export function deltaTSeconds(year: number): number {
  const y = year;
  let u: number;
  let t: number;
  if (y < 1900) {
    u = (y - 1860) / 100;
    return -2.79 + 1.494119 * u - 0.0598939 * u * u + 0.0061966 * u ** 3 - 0.000197 * u ** 4;
  }
  if (y >= 1900 && y < 1920) {
    t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (y >= 1920 && y < 1941) {
    t = y - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t * t + 0.0020936 * t ** 3;
  }
  if (y >= 1941 && y < 1961) {
    t = y - 1950;
    return 29.07 + 0.407 * t - (t * t) / 233 + t ** 3 / 2547;
  }
  if (y >= 1961 && y < 1986) {
    t = y - 1975;
    return 45.45 + 1.067 * t - (t * t) / 260 - t ** 3 / 718;
  }
  if (y >= 1986 && y < 2005) {
    t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (y >= 2005 && y < 2050) {
    t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }
  // 2050–2100
  u = (y - 1820) / 100;
  return -20 + 32 * u * u - 0.5628 * (2150 - y);
}

export function deltaT(jd: number): number {
  const { year } = jdToDate(jd);
  return deltaTSeconds(year);
}

/** 本地(标准时区) → JD。tzOffsetHours 为 UTC 偏移小时（东八区 = +8）。 */
export function localToJd(year: number, month: number, day: number, hour: number, tzOffsetHours: number): number {
  return dateToJd(year, month, day, hour) - tzOffsetHours / 24;
}
