import { describe, expect, it } from 'vitest';
import { dayGanZhiFromJdn, ganZhiFromIndex, hourGanZhi, monthGanZhi, nayin, indexOfGanZhi } from './ganzhi.js';
import { Solar } from 'lunar-javascript';
import { dateToJd } from '../astronomy/jde.js';

function jdnOf(y: number, m: number, d: number): number {
  return Math.floor(dateToJd(y, m, d) + 0.5);
}

const SAMPLES: Array<[number, number, number, string]> = [
  [2000, 1, 1, '戊午'],
  [1984, 2, 2, '丙寅'],
  [2024, 2, 10, '甲辰'],
  [2026, 8, 29, '乙亥'],
  [1949, 10, 1, '甲子'],
  [2033, 1, 1, '壬子'],
  [1990, 5, 15, '庚辰'],
];

describe('日柱（锚点：1984-02-02 = 丙寅）', () => {
  for (const [y, m, d, expected] of SAMPLES) {
    it(`${y}-${m}-${d} 日柱应为 ${expected}`, () => {
      expect(dayGanZhiFromJdn(jdnOf(y, m, d)).gan + dayGanZhiFromJdn(jdnOf(y, m, d)).zhi).toBe(expected);
    });
  }

  it('与 lunar-javascript 交叉验证 500 天', () => {
    let day = 0;
    const start = new Date(1995, 0, 1);
    for (let i = 0; i < 500; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const dd = d.getDate();
      const ours = dayGanZhiFromJdn(jdnOf(y, m, dd));
      const theirs = Solar.fromYmd(y, m, dd).getLunar().getDayInGanZhi();
      if (ours.gan + ours.zhi !== theirs) {
        day += 1;
        console.error(`不一致 ${y}-${m}-${dd}: 自研=${ours.gan}${ours.zhi} lunar=${theirs}`);
      }
    }
    expect(day).toBe(0);
  });
});

describe('干支基础', () => {
  it('六十甲子索引', () => {
    expect(ganZhiFromIndex(0).gan + ganZhiFromIndex(0).zhi).toBe('甲子');
    expect(ganZhiFromIndex(59).gan + ganZhiFromIndex(59).zhi).toBe('癸亥');
    expect(indexOfGanZhi('甲', '子')).toBe(0);
    expect(indexOfGanZhi('癸', '亥')).toBe(59);
  });

  it('五鼠遁时柱', () => {
    expect(hourGanZhi(0, 0).gan + hourGanZhi(0, 0).zhi).toBe('甲子'); // 甲日子时
    expect(hourGanZhi(1, 0).gan + hourGanZhi(1, 0).zhi).toBe('丙子'); // 乙日子时
    expect(hourGanZhi(4, 6).gan + hourGanZhi(4, 6).zhi).toBe('戊午'); // 戊日午时（戊癸起壬子）
    expect(hourGanZhi(0, 6).gan + hourGanZhi(0, 6).zhi).toBe('庚午'); // 甲日午时
    expect(hourGanZhi(5, 0).gan + hourGanZhi(5, 0).zhi).toBe('甲子'); // 己日子时
  });

  it('五虎遁月柱', () => {
    expect(monthGanZhi(0, 0).gan + monthGanZhi(0, 0).zhi).toBe('丙寅'); // 甲年正月
    expect(monthGanZhi(1, 0).gan + monthGanZhi(1, 0).zhi).toBe('戊寅'); // 乙年正月
    expect(monthGanZhi(4, 0).gan + monthGanZhi(4, 0).zhi).toBe('甲寅'); // 戊年正月（戊癸起甲寅）
    expect(monthGanZhi(0, 10).gan + monthGanZhi(0, 10).zhi).toBe('丙子'); // 甲年子月
    expect(monthGanZhi(4, 10).gan + monthGanZhi(4, 10).zhi).toBe('甲子'); // 戊年子月
  });

  it('纳音', () => {
    expect(nayin(0)).toBe('海中金'); // 甲子
    expect(nayin(1)).toBe('海中金'); // 乙丑
    expect(nayin(2)).toBe('炉中火'); // 丙寅
    expect(nayin(40)).toBe('覆灯火'); // 甲辰
  });
});
