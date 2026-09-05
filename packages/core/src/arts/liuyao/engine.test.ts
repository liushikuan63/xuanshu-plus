import { describe, expect, it } from 'vitest';
import { hexagramFromLines, xunKongOf, liuQin, liuShenOf, hexagramByName, GONG_WUXING } from './trigrams.js';
import { castFromNumbers, castFromTime, parseManualValues, bianValuesOf, huValuesOf, buildChart, castCoins } from './engine.js';
import { chartRules, isLiuChong, isLiuHe, xunKongLines, yuePoLines } from './rules.js';
import { yongShenRules, liuyaoWangShuaiOf, lineStrengths } from './yongshen.js';
import type { NormalizedMoment } from '../../types.js';

function norm(): NormalizedMoment {
  // 2024-02-10 12:00（甲辰日，甲辰年丙寅月）
  return {
    year: 2024, month: 2, day: 10, hour: 12, minute: 0, second: 0,
    jd: 2460351, jdn: 2460351, tzOffsetHours: 8,
    dayGanZhiIndex: 40, xunKong: '寅卯',
  };
}

describe('八宫生成与世应', () => {
  it('乾为天：乾宫八纯，世在上爻，应三爻', () => {
    const h = hexagramFromLines([7, 7, 7, 7, 7, 7]);
    expect(h.name).toBe('乾为天');
    expect(h.gong).toBe('乾');
    expect(h.shiClass).toBe('八纯');
    expect(h.shiIndex).toBe(5);
    expect(h.yingIndex).toBe(2);
  });

  it('火天大有：乾宫归魂，世三爻应六爻', () => {
    const byName = hexagramByName('火天大有')!;
    expect(byName.gong).toBe('乾');
    expect(byName.shiClass).toBe('归魂');
    expect(byName.shiIndex).toBe(2);
    expect(byName.yingIndex).toBe(5);
  });

  it('六十四卦全部可定位宫与世应', () => {
    for (let u = 0; u < 8; u++) {
      for (let l = 0; l < 8; l++) {
        const tri: Record<number, number[]> = { 0: [1, 1, 1], 1: [1, 1, 0], 2: [1, 0, 1], 3: [1, 0, 0], 4: [0, 1, 1], 5: [0, 1, 0], 6: [0, 0, 1], 7: [0, 0, 0] };
        const lines = [...tri[l]!, ...tri[u]!];
        const h = hexagramFromLines(lines);
        expect(h.gong.length).toBeGreaterThan(0);
        expect(h.name.length).toBeGreaterThan(0);
        expect(h.shiIndex).toBeGreaterThanOrEqual(0);
        expect(h.yingIndex).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('六亲：乾宫金，子水为子孙', () => {
    expect(liuQin('乾', '子')).toBe('子孙');
    expect(liuQin('乾', '寅')).toBe('妻财');
    expect(liuQin('乾', '辰')).toBe('父母');
    expect(liuQin('乾', '午')).toBe('官鬼');
    expect(liuQin('乾', '申')).toBe('兄弟');
  });
});

describe('纳甲与六神', () => {
  it('乾为天纳甲：子寅辰午申戌', async () => {
    const chart = await buildChart([7, 7, 7, 7, 7, 7], norm());
    expect(chart.lines.map((l) => l.branch).join('')).toBe('子寅辰午申戌');
    expect(chart.lines[0]!.stem).toBe('甲');
    expect(chart.lines[5]!.stem).toBe('壬');
  });

  it('六神：甲日起青龙于初爻', () => {
    expect(liuShenOf('甲', 0)).toBe('青龙');
    expect(liuShenOf('甲', 1)).toBe('朱雀');
    expect(liuShenOf('甲', 5)).toBe('玄武');
    expect(liuShenOf('庚', 0)).toBe('白虎');
  });

  it('旬空：甲辰日空寅卯', () => {
    expect(xunKongOf(40)).toEqual(['寅', '卯']);
    expect(xunKongOf(0)).toEqual(['戌', '亥']); // 甲子日
    expect(xunKongOf(30)).toEqual(['辰', '巳']); // 甲午日
  });
});

describe('起卦', () => {
  it('报数起卦：1,1,1 → 乾为天初爻动', () => {
    const v = castFromNumbers([1, 1, 1]);
    expect(v).toEqual([9, 1, 1, 1, 1, 1]);
  });

  it('报数起卦：1,3,5 → 上乾下离（天火同人），五爻动', () => {
    const v = castFromNumbers([1, 3, 5]);
    expect(v).toEqual([1, 0, 1, 1, 9, 1]);
    expect(hexagramFromLines(v).name).toBe('天火同人');
  });

  it('时间起卦：2024-02-10 12:00 → 天山遁四爻动', () => {
    const v = castFromTime(2024, 2, 10, 12);
    expect(hexagramFromLines(v).name).toBe('天山遁');
    expect(v[3]).toBe(9); // 四爻动
  });

  it('手动爻值解析', () => {
    expect(parseManualValues('787978')).toEqual([7, 8, 7, 9, 7, 8]);
    expect(() => parseManualValues('123')).toThrow();
  });

  it('摇卦确定性（注入随机源）', () => {
    const v = castCoins(() => 0.01); // 全背 → 老阳 9
    expect(v.every((x) => x === 9)).toBe(true);
    const v2 = castCoins(() => 0.99); // 全字 → 老阴 6
    expect(v2.every((x) => x === 6)).toBe(true);
  });

  it('变卦与互卦', () => {
    expect(bianValuesOf([7, 7, 7, 9, 7, 7])).toEqual([7, 7, 7, 8, 7, 7]);
    expect(bianValuesOf([7, 7, 7, 7, 7, 7])).toBeNull();
    const hu = huValuesOf([7, 7, 7, 7, 7, 7]);
    expect(hexagramFromLines(hu).name).toBe('乾为天'); // 纯卦互卦仍为纯卦
    const hu2 = huValuesOf([0, 0, 0, 1, 1, 1]); // 天地否（上乾下坤）
    expect(hexagramFromLines(hu2).name).toBe('风山渐'); // 否互卦为风山渐
  });
});

describe('六爻排盘黄金样本（2024-02-10 甲辰日 丙寅月）', () => {
  it('乾为天六爻静', async () => {
    const chart = await buildChart([7, 7, 7, 7, 7, 7], norm());
    expect(chart.benName).toBe('乾为天');
    expect(chart.bianName).toBeNull();
    expect(chart.monthPillar.gan + chart.monthPillar.zhi).toBe('丙寅');
    expect(chart.dayPillar.gan + chart.dayPillar.zhi).toBe('甲辰');
    expect(chart.xunKong.join('')).toBe('寅卯');
    expect(chart.lines[5]!.isShi).toBe(true);
    expect(chart.lines[2]!.isYing).toBe(true);
    expect(chart.lines[0]!.liuqin).toBe('子孙');
    expect(chart.lines[4]!.liuqin).toBe('兄弟');
  });

  it('乾为天为六冲卦', async () => {
    const chart = await buildChart([7, 7, 7, 7, 7, 7], norm());
    expect(isLiuChong(chart)).toBe(true);
    expect(isLiuHe(chart)).toBe(false);
  });

  it('五爻动 → 火天大有（乾九五变），有动爻辞', async () => {
    const chart = await buildChart([7, 7, 7, 7, 9, 7], norm());
    expect(chart.bianName).toBe('火天大有');
    expect(chart.movingIndices).toEqual([4]);
    const rules = chartRules(chart);
    expect(rules.some((r) => r.ruleId === 'liuyao.dong.yaoci' && r.confidenceLevel === 'A' && r.citations.length > 0)).toBe(true);
  });

  it('天地否为六合卦', async () => {
    const chart = await buildChart([0, 0, 0, 1, 1, 1], norm());
    expect(chart.benName).toBe('天地否');
    expect(isLiuHe(chart)).toBe(true);
  });

  it('旬空/月破爻标记', async () => {
    const chart = await buildChart([7, 7, 7, 7, 7, 7], norm());
    // 丙寅月：寅月破为申（寅申冲）；甲辰日空寅卯
    expect(xunKongLines(chart).map((l) => l.branch)).toContain('寅');
    expect(yuePoLines(chart).map((l) => l.branch)).toContain('申');
  });

  it('伏神：缺某六亲时从本宫取', async () => {
    const chart = await buildChart([7, 7, 7, 7, 7, 7], norm());
    // 乾为天六亲齐备，无伏神
    expect(chart.lines.every((l) => !l.fuShen)).toBe(true);
  });
});

describe('断卦规则', () => {
  it('规则均带 ruleId 与分级', async () => {
    const chart = await buildChart([7, 8, 7, 8, 7, 8], norm());
    const rules = chartRules(chart);
    expect(rules.length).toBeGreaterThan(3);
    for (const r of rules) {
      expect(r.ruleId.length).toBeGreaterThan(0);
      expect(['A', 'B', 'C', 'D', 'E']).toContain(r.confidenceLevel);
    }
  });

  it('旺相休囚死：甲辰日寅月 乾金死、木相?（月寅木：金囚、木旺）', () => {
    expect(liuyaoWangShuaiOf('金', '木')).toBe('囚');
    expect(liuyaoWangShuaiOf('木', '木')).toBe('旺');
    expect(liuyaoWangShuaiOf('火', '木')).toBe('相');
    expect(liuyaoWangShuaiOf('水', '木')).toBe('休');
    expect(liuyaoWangShuaiOf('土', '木')).toBe('死');
  });

  it('六爻用神断：世爻用神 + 月令 + 六亲一览 均出 D 级规则', async () => {
    const chart = await buildChart([7, 7, 7, 7, 7, 7], norm()); // 乾为天
    const rules = yongShenRules(chart);
    const ids = rules.map((r) => r.ruleId);
    expect(ids.some((id) => id.startsWith('liuyao.yongshen.shi.'))).toBe(true);
    expect(ids).toContain('liuyao.yueling');
    for (const r of rules) {
      expect(r.confidenceLevel).toBe('D');
      expect(r.citations.length).toBe(0);
    }
  });

  it('伏神规则仅在本卦缺六亲时出现', async () => {
    // 乾为天六亲齐备 → 无 liuyao.fushen
    const a = await buildChart([7, 7, 7, 7, 7, 7], norm());
    expect(yongShenRules(a).some((r) => r.ruleId === 'liuyao.fushen')).toBe(false);
    // 找个缺六亲的卦（如泽火革等），若引擎标出伏神则该规则出现
    const b = await buildChart([6, 8, 6, 8, 7, 8], norm());
    const rules = yongShenRules(b);
    expect(lineStrengths(b).length).toBe(6);
    const hasFu = b.lines.some((l) => l.fuShen);
    expect(rules.some((r) => r.ruleId === 'liuyao.fushen')).toBe(hasFu);
  });
});
