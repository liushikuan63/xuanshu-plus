import { describe, expect, it } from 'vitest';
import {
  renYuanOf,
  castJinKou,
  diFenFromNumber,
  GOD_WUXING,
  type JinKouChart,
} from './engine.js';
import { jinkouPlugin } from './plugin.js';
import { DIZHI, ZHI_WUXING, ZHI_LIUHE, ZHI_SANHE, zhiChong, type Zhi } from '../../calendar/ganzhi.js';

function ctxOf(iso: string) {
  return { now: new Date(iso), random: () => 0.5, tzOffsetHours: 8 };
}

describe('人元（将干）：五鼠遁数至月将', () => {
  it('甲日·午时·亥将：午庚 … 亥乙 → 人元乙', () => {
    // dayGanIndex: 甲=0；时支午=6
    expect(renYuanOf(0, 6, '亥')).toBe('乙');
  });

  it('乙日·子时·丑将：子丙(乙庚丙作初：乙日子时丙子)…丑丁 → 人元丁', () => {
    // 乙日干 index=1；子=0；丑将 index=1 → k=1 → gan=丙+1=丁
    expect(renYuanOf(1, 0, '丑')).toBe('丁');
  });

  it('月将为占时本身 → 人元=该时干支之干', () => {
    // 戊日(4)·午时(6)·月将=午 → k=0 → 时干（戊癸壬子...：戊日子时壬，午=壬+6=戊？）
    // 五鼠遁：戊日 → 子时壬；午时 = 壬+6 = 戊（戊午）；月将=午 → 人元=戊
    expect(renYuanOf(4, 6, '午')).toBe('戊');
  });
});

describe('十二天将五行', () => {
  it('贵人土 白虎金 青龙木 玄武水 朱雀火', () => {
    expect(GOD_WUXING['贵人']).toBe('土');
    expect(GOD_WUXING['白虎']).toBe('金');
    expect(GOD_WUXING['青龙']).toBe('木');
    expect(GOD_WUXING['玄武']).toBe('水');
    expect(GOD_WUXING['朱雀']).toBe('火');
  });
});

describe('金口诀起课（时间）', () => {
  it('排出四位且贵人/天将/人元齐备', async () => {
    const c: JinKouChart = await castJinKou({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    expect(c.art).toBe('jinkou');
    expect(DIZHI as readonly string[]).toContain(c.diFen);
    expect(DIZHI as readonly string[]).toContain(c.yueJiang);
    expect(c.guiShen.length).toBeGreaterThan(0);
    expect('甲乙丙丁戊己庚辛壬癸'.includes(c.renYuan)).toBe(true);
    expect(c.guiGods.length).toBe(12);
    expect(c.configHash).toMatch(/^cfg_[0-9a-f]+$/);
  });

  it('贵神 = 地分所乘之十二天将', async () => {
    const c = await castJinKou({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    const godAtDiFen = c.guiGods.find((g) => g.branch === c.diFen)?.god;
    expect(c.guiShen).toBe(godAtDiFen);
    expect(Object.keys(GOD_WUXING)).toContain(c.guiShen);
  });

  it('同时刻起课确定（configHash 一致）', async () => {
    const a = await castJinKou({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    const b = await castJinKou({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    expect(a.renYuan).toBe(b.renYuan);
    expect(a.guiShen).toBe(b.guiShen);
    expect(a.configHash).toBe(b.configHash);
  });

  it('时间起课可用（非时间输入仍拒绝）', async () => {
    await expect(castJinKou({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'))).resolves.toBeTruthy();
    await expect(castJinKou({ kind: 'manual', text: 'x' }, ctxOf('2026-08-29T12:00:00'))).rejects.toThrow('时间起课');
  });

  it('月将 = 节气月支之六合（与干支表一致）', async () => {
    const c = await castJinKou({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    // 2026-08-29 处暑节气（申月）→ 月将 = 申之六合 = 巳
    expect(c.yueJiang).toBe('巳');
  });
});

describe('报数取地分', () => {
  it('1→子 … 12→亥，13 循环回子', () => {
    expect(diFenFromNumber(1)).toBe('子');
    expect(diFenFromNumber(7)).toBe('午');
    expect(diFenFromNumber(12)).toBe('亥');
    expect(diFenFromNumber(13)).toBe('子');
    expect(diFenFromNumber(0)).toBe('亥');
  });

  it('报数起课：地分为数对应支，且与时间起课同刻 configHash 有区分', async () => {
    const c = await castJinKou({ kind: 'numbers', numbers: [7] }, ctxOf('2026-08-29T12:00:00'));
    expect(c.diFen).toBe('午');
    expect(c.diFenSource).toBe('numbers');
    const t = await castJinKou({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    expect(t.configHash).not.toBe(c.configHash);
  });
});

describe('金口诀断语规则', () => {
  it('规则集含四位/天地/贵神/事地/空亡驿马/缽盘断（均 D 级无引文）', async () => {
    const c = await castJinKou({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    const rules = await jinkouPlugin.rules(c, {});
    const ids = rules.map((r) => r.ruleId);
    expect(ids).toContain('jinkou.siwei');
    expect(ids).toContain('jinkou.tiandi');
    expect(ids).toContain('jinkou.guishen');
    expect(ids).toContain('jinkou.shidi');
    expect(ids).toContain('jinkou.kongma');
    expect(ids).toContain('jinkou.renyuangui');
    for (const r of rules) {
      expect(r.confidenceLevel).toBe('D');
      expect(r.citations.length).toBe(0);
    }
  });

  it('三合/六合/冲规则随地分-月将关系出现', async () => {
    // 构造月将=巳、地分=辰（巳酉丑合局 → 三合）、又 巳戌冲?：巳vs辰比，非六合非冲
    const h = await castJinKou({ kind: 'numbers', numbers: [1] }, ctxOf('2026-08-29T12:00:00'));
    const rules = await jinkouPlugin.rules(h, {});
    const ids = rules.map((r) => r.ruleId);
    // 地分=子，月将=巳：子-巳 无合无冲无三合；六合=子丑、冲=午 —— 断言此类规则不误报
    expect(ids.some((id) => id.startsWith('jinkou.sanhe'))).toBe(false);
    expect(ids.some((id) => id === 'jinkou.liuhe')).toBe(false);
    expect(ids.some((id) => id === 'jinkou.chong')).toBe(false);
    // 六合命中：报数 2 → 丑；月将=巳 ← 卯戌/辰酉/巳申/午未/子丑/寅亥：丑与子合非巳 → 仍无
    const c2 = await castJinKou({ kind: 'numbers', numbers: [2] }, ctxOf('2026-08-29T12:00:00'));
    expect(c2.diFen).toBe('丑');
    // 三合命中：巳酉丑 → 报数 10 → 酉
    const c3 = await castJinKou({ kind: 'numbers', numbers: [10] }, ctxOf('2026-08-29T12:00:00'));
    expect(c3.diFen).toBe('酉');
    expect(ZHI_SANHE[c3.diFen]).toContain(c3.yueJiang);
    const r3 = await jinkouPlugin.rules(c3, {});
    expect(r3.some((r) => r.ruleId.startsWith('jinkou.sanhe'))).toBe(true);
    // 对冲命中：报数 6 → 巳，月将=巳 → 自冲? 巳vs巳比非冲；报数 12 → 亥，巳亥冲 ✓
    const c4 = await castJinKou({ kind: 'numbers', numbers: [12] }, ctxOf('2026-08-29T12:00:00'));
    expect(c4.diFen).toBe('亥');
    expect(zhiChong(c4.diFen)).toBe(c4.yueJiang);
    const r4 = await jinkouPlugin.rules(c4, {});
    expect(r4.some((r) => r.ruleId === 'jinkou.chong')).toBe(true);
  });

  it('四位五行与地支一致', async () => {
    const c = await castJinKou({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    expect(ZHI_WUXING[c.diFen]).toBeDefined();
  });
});