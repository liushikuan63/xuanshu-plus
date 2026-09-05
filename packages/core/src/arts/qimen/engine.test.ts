import { describe, expect, it } from 'vitest';
import {
  yuanOf,
  isYangDun,
  juOf,
  earthPalaces,
  earthStemOf,
  buildQimenChart,
  castQimen,
  riShiRelationOf,
  prevFuTouOf,
  zhiRunTriggered,
  zhiRunSegmentOf,
  SIX_QI_YI,
  FIXED_STAR,
  FIXED_DOOR,
  RUAN_THRESHOLD_DAYS,
  type QimenConfig,
} from './engine.js';
import { qimenPlugin } from './plugin.js';
import type { NormalizedMoment } from '../../types.js';

const CONFIG: QimenConfig = { engine: 'shijia', zishSplit: '23:00', ruanfa: 'chai' };

function norm(): NormalizedMoment {
  return {
    year: 2024, month: 2, day: 10, hour: 12, minute: 0, second: 0,
    jd: 2460351, jdn: 2460351, tzOffsetHours: 8,
    dayGanZhiIndex: 40, xunKong: '寅卯',
  };
}

function ctxOf(iso: string) {
  return { now: new Date(iso), random: () => 0.5, tzOffsetHours: 8 };
}

function build(p: Partial<Parameters<typeof buildQimenChart>[0]>) {
  return buildQimenChart({
    yearPillar: '甲辰', monthPillar: '丙寅', dayPillar: '甲辰', hourPillar: '甲子',
    dayIndex: 40, hourIndex: 0, term: '冬至', yangDun: true, ju: 1, yuan: '上',
    normalized: norm(), config: CONFIG, ...p,
  });
}

describe('定局', () => {
  it('符头定元：甲子/己卯/甲午/己酉 上元，隔五中元，隔十下元', () => {
    expect(yuanOf(0)).toBe('上');    // 甲子
    expect(yuanOf(4)).toBe('上');
    expect(yuanOf(5)).toBe('中');
    expect(yuanOf(15)).toBe('上');   // 己卯
    expect(yuanOf(19)).toBe('上');   // 距符头 4 天仍上元
    expect(yuanOf(24)).toBe('中');   // 距符头 9 天中元
    expect(yuanOf(29)).toBe('下');   // 距符头 14 天下元
    expect(yuanOf(30)).toBe('上');   // 甲午
    expect(yuanOf(45)).toBe('上');   // 己酉
    expect(yuanOf(59)).toBe('下');
  });

  it('阴阳遁分界：冬至→芒种为阳，夏至→大雪为阴', () => {
    expect(isYangDun('冬至')).toBe(true);
    expect(isYangDun('芒种')).toBe(true);
    expect(isYangDun('夏至')).toBe(false);
    expect(isYangDun('大雪')).toBe(false);
  });

  it('三元局数：立春（阳）8/5/2，夏至（阴）9/3/6，大雪（阴）4/7/1', () => {
    expect(juOf('立春', '上', true)).toBe(8);
    expect(juOf('立春', '中', true)).toBe(5);
    expect(juOf('立春', '下', true)).toBe(2);
    expect(juOf('夏至', '上', false)).toBe(9);
    expect(juOf('夏至', '下', false)).toBe(6);
    expect(juOf('大雪', '下', false)).toBe(1);
  });
});

describe('地盘三奇六仪', () => {
  it('阳遁3局：戊3 己4 庚5 辛6 壬7 癸8 丁9 丙1 乙2', () => {
    const e = earthPalaces(3, true);
    expect(['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'].map((s) => e[s])).toEqual([3, 4, 5, 6, 7, 8, 9, 1, 2]);
  });

  it('阴遁3局：戊3 己2 庚1 辛9 壬8 癸7 丁6 丙5 乙4', () => {
    const e = earthPalaces(3, false);
    expect(['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'].map((s) => e[s])).toEqual([3, 2, 1, 9, 8, 7, 6, 5, 4]);
  });

  it('九宫九干不重复（阳遁9局覆盖全部宫）', () => {
    const e = earthPalaces(9, true);
    const palaces = SIX_QI_YI.map((s) => e[s]);
    expect(new Set(palaces).size).toBe(9);
    expect([...palaces].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(earthStemOf(e, 5)).toBeTruthy();
  });
});

describe('阳遁1局 甲子时（伏吟）', () => {
  it('值符天蓬、值使休门，天盘伏吟（天盘干=地盘干）', () => {
    const c = build({ hourPillar: '甲子', hourIndex: 0, dayIndex: 40, ju: 1 });
    expect(c.valueStar).toBe('天蓬');
    expect(c.valueDoor).toBe('休');
    expect(c.hourGan).toBe('戊'); // 甲子时遁于戊
    expect(c.hourGanPalace).toBe(1);
    expect(c.fuyin).toBe(true);
    expect(c.fanyin).toBe(false);
    for (const p of c.palaces) {
      expect(p.star).toBe(FIXED_STAR[p.num]);
      expect(p.heavenStem).toBe(p.earthStem);
      expect(p.door).toBe(FIXED_DOOR[p.num]);
    }
  });

  it('八神顺布：值符1 螣蛇2 太阴3 六合4 白虎6 玄武7 九地8 九天9', () => {
    const c = build({ hourPillar: '甲子', hourIndex: 0, dayIndex: 40, ju: 1 });
    const god = Object.fromEntries(c.palaces.map((p) => [p.num, p.god]));
    expect(god[1]).toBe('值符');
    expect(god[2]).toBe('螣蛇');
    expect(god[4]).toBe('六合');
    expect(god[6]).toBe('白虎');
    expect(god[9]).toBe('九天');
  });
});

describe('阳遁1局 乙丑时（值符转）', () => {
  it('时干乙落9宫，天盘干在时干宫=旬首戊，值使休门进一步到2宫', () => {
    const c = build({ hourPillar: '乙丑', hourIndex: 1, dayIndex: 40, ju: 1 });
    expect(c.hourGan).toBe('乙');
    expect(c.hourGanPalace).toBe(9);
    expect(c.valueStar).toBe('天蓬');
    const p1 = c.palaces.find((x) => x.num === 1)!;
    const p9 = c.palaces.find((x) => x.num === 9)!;
    expect(p9.heavenStem).toBe('戊'); // 时干宫天盘干=旬首干
    expect(p1.heavenStem).toBe('己'); // 值符转动：蓬(1)→9，芮进1
    expect(p1.star).toBe('天芮');
    expect(p9.star).toBe('天蓬');
    expect(c.palaces.find((x) => x.num === 2)!.door).toBe('休'); // 值使进一步
    expect(c.palaces.find((x) => x.num === 1)!.door).toBe('景');
    // 值符宫9与旬首宫1对冲 → 反吟
    expect(c.fanyin).toBe(true);
  });
});

describe('阴遁1局 甲子时（逆行八神）', () => {
  it('地盘戊1己9庚8辛7壬6癸5丁4丙3乙2，八神逆布', () => {
    const c = build({ hourPillar: '甲子', hourIndex: 0, dayIndex: 40, yangDun: false, ju: 1 });
    const e = Object.fromEntries(c.palaces.map((p) => [p.num, p.earthStem]));
    expect(e[1]).toBe('戊');
    expect(e[9]).toBe('己');
    expect(e[2]).toBe('乙');
    const god = Object.fromEntries(c.palaces.map((p) => [p.num, p.god]));
    expect(god[9]).toBe('螣蛇'); // 逆行：1→9
    expect(god[7]).toBe('六合');
    expect(god[2]).toBe('九天');
  });
});

describe('日时宫五行关系', () => {
  it('事生我/克我/比和', () => {
    expect(riShiRelationOf('木', '火')).toBe('我生');
    expect(riShiRelationOf('木', '水')).toBe('生我');
    expect(riShiRelationOf('木', '金')).toBe('克我');
    expect(riShiRelationOf('木', '土')).toBe('我克');
    expect(riShiRelationOf('木', '木')).toBe('比和');
  });
});

describe('时间起局集成', () => {
  it('2026-08-29 12:00（处暑后）为阴遁 · 局数 ∈ {1,4,7}', async () => {
    const c = await castQimen({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    expect(c.art).toBe('qimen');
    expect(c.term).toBe('处暑');
    expect(c.yangDun).toBe(false);
    expect([1, 4, 7]).toContain(c.ju);
    expect(c.palaces.length).toBe(9);
    expect(c.configHash).toMatch(/^cfg_[0-9a-f]+$/);
  });

  it('同时刻起局确定（configHash 一致）', async () => {
    const a = await castQimen({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    const b = await castQimen({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    expect(a.ju).toBe(b.ju);
    expect(a.configHash).toBe(b.configHash);
  });

  it('非时间起局抛错', async () => {
    await expect(castQimen({ kind: 'numbers', numbers: [1, 2, 3] }, ctxOf('2026-08-29T12:00:00'))).rejects.toThrow('时间起局');
  });
});

describe('奇门断语规则', () => {
  it('规则集含定局/时干/日时/空亡/值使等关键断', async () => {
    const c = await castQimen({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    const rules = await qimenPlugin.rules(c, {});
    const ids = rules.map((r) => r.ruleId);
    expect(ids).toContain('qimen.dingju');
    expect(ids).toContain('qimen.shigan');
    expect(ids).toContain('qimen.xunkong');
    expect(ids.some((id) => id.startsWith('qimen.zhishi.'))).toBe(true);
    for (const r of rules) {
      expect(r.confidenceLevel).toBe('D');
      expect(r.citations.length).toBe(0);
    }
  });

  it('四柱出现在盘面（阴遁局内干支文案）', async () => {
    const c = await castQimen({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    expect(c.year).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    expect(c.hour).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
  });
});

describe('置闰法（超神接气）', () => {
  // 日柱锚点：DAY_ANCHOR_JDN=2445733 对应六十甲子序 2（丙寅）
  const jdnOf = (index: number) => 2445733 + (index - 2);

  it('上一符头回溯：甲辰日(40)距符头甲午(30) 10 天', () => {
    expect(prevFuTouOf(jdnOf(40) + 0.001).daysBefore).toBe(10);
    expect(prevFuTouOf(jdnOf(16) + 0.001).daysBefore).toBe(1); // 庚辰(16)距己卯(15) 1 天
  });

  it('触发判定：仅芒种/大雪且符差≥阈值（9 天）', () => {
    expect(RUAN_THRESHOLD_DAYS).toBe(9);
    expect(zhiRunTriggered('芒种', jdnOf(40) + 0.001)).toBe(true);   // 符差10
    expect(zhiRunTriggered('芒种', jdnOf(16) + 0.001)).toBe(false);  // 符差1
    expect(zhiRunTriggered('大雪', jdnOf(40) + 0.001)).toBe(true);
    expect(zhiRunTriggered('小满', jdnOf(40) + 0.001)).toBe(false);  // 非窗口
    expect(zhiRunTriggered('芒种', jdnOf(9) + 0.001)).toBe(true);    // 癸酉(9)距甲子(0) 正好 9 天
  });

  it('置闰节内分段：第1-5天上 / 6-10天闰上 / 11-15天中 / 16天起下', () => {
    expect(zhiRunSegmentOf(500, 500)).toBe('上');   // 第1天
    expect(zhiRunSegmentOf(504, 500)).toBe('上');   // 第5天
    expect(zhiRunSegmentOf(505, 500)).toBe('闰上'); // 第6天
    expect(zhiRunSegmentOf(509, 500)).toBe('闰上'); // 第10天
    expect(zhiRunSegmentOf(510, 500)).toBe('中');   // 第11天
    expect(zhiRunSegmentOf(514, 500)).toBe('中');   // 第15天
    expect(zhiRunSegmentOf(515, 500)).toBe('下');   // 第16天
  });

  it('闰上与上元同局：芒种 6 / 大雪 4（阴）', () => {
    expect(juOf('芒种', '闰上', true)).toBe(6);
    expect(juOf('大雪', '闰上', false)).toBe(4);
  });

  it('置闰盘面：yuan=闰上、ruan=true（阳1局等价上元）', () => {
    const c = build({ hourPillar: '甲子', hourIndex: 0, dayIndex: 40, ju: 1, yuan: '闰上', ruan: true });
    expect(c.yuan).toBe('闰上');
    expect(c.ruan).toBe(true);
    expect(c.ju).toBe(1);
    expect(c.valueStar).toBe('天蓬');
  });

  it('非置闰节回退拆补：处暑同时刻 置闰法=拆补法（ruan=false，局数一致）', async () => {
    const input = { kind: 'time' as const, time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } };
    const chai = await castQimen(input, ctxOf('2026-08-29T12:00:00'), { engine: 'shijia', zishSplit: '23:00', ruanfa: 'chai' });
    const zhi = await castQimen(input, ctxOf('2026-08-29T12:00:00'), { engine: 'shijia', zishSplit: '23:00', ruanfa: 'zhi' });
    expect(zhi.ruan).toBe(false);
    expect(zhi.yuan).toBe(chai.yuan);
    expect(zhi.ju).toBe(chai.ju);
    expect(chai.configHash).not.toBe(zhi.configHash); // ruanfa 参与 configHash
  });

  it('置闰断语：定局信息含置闰标记', async () => {
    const c = build({ hourPillar: '甲子', hourIndex: 0, dayIndex: 40, ju: 1, yuan: '闰上', ruan: true });
    const rules = await qimenPlugin.rules(c, {});
    const dj = rules.find((r) => r.ruleId === 'qimen.dingju')!;
    expect(dj.text).toContain('置闰');
  });
});