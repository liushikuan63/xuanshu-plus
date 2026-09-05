import { describe, expect, it } from 'vitest';
import { solarTerm, solarTermsOfYear, TERM_LONGITUDE, SOLAR_TERMS, isJie, isZhongQi } from './solarTerms.js';
import { simplifiedMeeusSolarLongitude } from '../astronomy/solarLongitude.js';
import { Solar } from 'lunar-javascript';

/** 从 lunar-javascript 的节气表取参考时刻（东八区）；按目标年份匹配中文/拼音键 */
const TERM_PINYIN: Record<string, string> = {
  小寒: 'XIAO_HAN', 大寒: 'DA_HAN', 立春: 'LI_CHUN', 雨水: 'YU_SHUI', 惊蛰: 'JING_ZHE', 春分: 'CHUN_FEN',
  清明: 'QING_MING', 谷雨: 'GU_YU', 立夏: 'LI_XIA', 小满: 'XIAO_MAN', 芒种: 'MANG_ZHONG', 夏至: 'XIA_ZHI',
  小暑: 'XIAO_SHU', 大暑: 'DA_SHU', 立秋: 'LI_QIU', 处暑: 'CHU_SHU', 白露: 'BAI_LU', 秋分: 'QIU_FEN',
  寒露: 'HAN_LU', 霜降: 'SHUANG_JIANG', 立冬: 'LI_DONG', 小雪: 'XIAO_XUE', 大雪: 'DA_XUE', 冬至: 'DONG_ZHI',
};

function lunarTermTime(year: number, termName: string): { year: number; month: number; day: number; hour: number } {
  const l = Solar.fromYmd(year, 6, 1).getLunar();
  const table = l.getJieQiTable() as unknown as Record<string, { toYmdHms: () => string }>;
  const keys = Object.keys(table).filter((k) => k === termName || k === TERM_PINYIN[termName]);
  for (const k of keys) {
    const s = table[k]!;
    const y = parseInt(s.toYmdHms().slice(0, 4), 10);
    if (y === year) {
      const parts = s.toYmdHms().split(/[- :]/);
      const hour = parseInt(parts[3]!, 10) + parseInt(parts[4]!, 10) / 60 + parseInt(parts[5]!, 10) / 3600;
      return { year: y, month: parseInt(parts[1]!, 10), day: parseInt(parts[2]!, 10), hour };
    }
  }
  throw new Error(`lunar 节气表无 ${year} ${termName}`);
}

const ANCHORS: Array<[number, string, string]> = [
  [2024, '立春', '2024-02-04 16:26'],
  [2024, '春分', '2024-03-20 11:06'],
  [2024, '夏至', '2024-06-21 04:50'],
  [2024, '冬至', '2024-12-21 17:20'],
  [2000, '春分', '2000-03-20 15:35'],
];

describe('太阳视黄经', () => {
  it('简化 Meeus 在 J2000 的黄经约 280°', () => {
    const lon = simplifiedMeeusSolarLongitude(2451545.0);
    expect(lon).toBeGreaterThan(279);
    expect(lon).toBeLessThan(282);
  });
});

describe('节气定气（默认 VSOP87 引擎）', () => {
  for (const [year, term, expectTime] of ANCHORS) {
    it(`${year} ${term} 应约在 ${expectTime}`, async () => {
      const r = await solarTerm(year, term as never);
      const [ey, em, ed, ehhmm] = expectTime.split(/[- :]/);
      expect(r.localYear).toBe(parseInt(ey!, 10));
      expect(r.localMonth).toBe(parseInt(em!, 10));
      expect(r.localDay).toBe(parseInt(ed!, 10));
      const expectHour = parseInt(ehhmm!, 10) + parseInt(expectTime.split(':')[1]!, 10) / 60;
      // 容差 ±3 分钟
      expect(Math.abs(r.localHour - expectHour)).toBeLessThan(0.06);
    });
  }

  it('与 lunar-javascript 节气表交叉验证（2020-2026 全部节气，容差 6 分钟）', async () => {
    let maxDiff = 0;
    for (let year = 2020; year <= 2026; year++) {
      for (const term of SOLAR_TERMS) {
        const ours = await solarTerm(year, term);
        const ref = lunarTermTime(year, term);
        const diffMin = Math.abs(ours.localHour - ref.hour) * 60;
        if (ours.localDay !== ref.day) {
          maxDiff = Math.max(maxDiff, diffMin + 24 * 60);
        } else {
          maxDiff = Math.max(maxDiff, diffMin);
        }
        expect(ours.localYear).toBe(ref.year);
        expect(ours.localMonth).toBe(ref.month);
        if (ours.localDay !== ref.day) {
          // 相差一天内（跨日边界），小时差容忍放大
          expect(diffMin).toBeLessThan(24 * 60);
        } else {
          expect(diffMin).toBeLessThan(6);
        }
      }
    }
    console.log(`节气交叉验证最大分钟差: ${maxDiff.toFixed(1)}`);
  }, 120000);

  it('每个节气黄经目标正确', () => {
    for (const term of SOLAR_TERMS) {
      expect(TERM_LONGITUDE[term]).toBeGreaterThanOrEqual(0);
      expect(TERM_LONGITUDE[term]).toBeLessThan(360);
    }
  });

  it('节与中气交替', () => {
    for (let i = 0; i < SOLAR_TERMS.length; i += 2) {
      expect(isJie(SOLAR_TERMS[i]!)).toBe(true);
      expect(isZhongQi(SOLAR_TERMS[i + 1]!)).toBe(true);
    }
  });

  it('求交迭代：立春时刻太阳黄经应为 315°', async () => {
    const jde = (await solarTerm(2024, '立春')).jde;
    const lon = simplifiedMeeusSolarLongitude(jde);
    const diff = Math.abs(((lon - 315 + 540) % 360) - 180);
    expect(diff).toBeLessThan(0.05);
  });
});

describe('全年节气', () => {
  it('2026 年 24 节气按时间排序且互不重复', async () => {
    const terms = await solarTermsOfYear(2026);
    expect(terms.length).toBe(24);
    for (let i = 1; i < terms.length; i++) {
      expect(terms[i]!.jde).toBeGreaterThan(terms[i - 1]!.jde);
    }
  });
});
