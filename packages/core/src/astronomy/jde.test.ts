import { describe, expect, it } from 'vitest';
import { dateToJd, jdToDate, deltaT, localToJd } from './jde.js';

describe('儒略日转换', () => {
  it('J2000 历元：2000-01-01 12:00 UT = 2451545.0', () => {
    expect(dateToJd(2000, 1, 1, 12)).toBeCloseTo(2451545.0, 6);
  });

  it('1984-02-02 00:00 UT 的 JDN 为 2445733', () => {
    expect(Math.floor(dateToJd(1984, 2, 2) + 0.5)).toBe(2445733);
  });

  it('JD 反向转换', () => {
    const d = jdToDate(2451545.0);
    expect(d.year).toBe(2000);
    expect(d.month).toBe(1);
    expect(d.day).toBe(1);
    expect(d.hour).toBeCloseTo(12, 5);
  });

  it('本地时间（东八区）转 JD 再转回', () => {
    const jd = localToJd(2024, 2, 10, 12, 8);
    const d = jdToDate(jd + 8 / 24);
    expect(d.year).toBe(2024);
    expect(d.month).toBe(2);
    expect(d.day).toBe(10);
    expect(d.hour).toBeCloseTo(12, 5);
  });
});

describe('ΔT', () => {
  it('2000 年 ΔT 约 63.8 秒', () => {
    expect(deltaT(dateToJd(2000, 1, 1))).toBeGreaterThan(60);
    expect(deltaT(dateToJd(2000, 1, 1))).toBeLessThan(70);
  });

  it('2024 年 ΔT 约 69 秒', () => {
    const t = deltaT(dateToJd(2024, 1, 1));
    expect(t).toBeGreaterThan(65);
    expect(t).toBeLessThan(75);
  });
});
