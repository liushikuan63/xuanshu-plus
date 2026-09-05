import { describe, expect, it } from 'vitest';
import {
  heavenPlate,
  isFuYin,
  isFanYin,
  chuChuanOf,
  zhongMoOf,
  sheHaiDepthOf,
  pickSheHai,
  guiRenOf,
  guiGodsOf,
  yiMaOf,
  castLiuRen,
  STEM_HOME,
  BRANCH_RING,
  TWELVE_GODS,
  type KeCell,
} from './engine.js';
import { liurenPlugin } from './plugin.js';
import { DIZHI, type Zhi } from '../../calendar/ganzhi.js';

type KeLike = Pick<KeCell, 'lower' | 'upper' | 'relation'>;

function ctxOf(iso: string) {
  return { now: new Date(iso), random: () => 0.5, tzOffsetHours: 8 };
}

describe('天盘：月将加占时', () => {
  it('月将亥加占时午：亥上为午，子顺布为未、丑为申…', () => {
    const h = heavenPlate('亥', '午');
    expect(h['亥']).toBe('午');
    expect(h['子']).toBe('未');
    expect(h['丑']).toBe('申');
    expect(h['戌']).toBe('巳');
  });

  it('占时即月将 → 伏吟（天盘=地盘）', () => {
    const h = heavenPlate('子', '子');
    expect(isFuYin(h)).toBe(true);
    expect(DIZHI.every((b) => h[b] === b)).toBe(true);
  });

  it('占时为月将之冲支 → 返吟', () => {
    const h = heavenPlate('子', '午');
    expect(isFanYin(h)).toBe(true);
    expect(h['子']).toBe('午');
    expect(h['午']).toBe('子');
  });
});

describe('四课与三传', () => {
  it('干寄宫表：甲寅 乙辰 丙巳 丁未 戊巳 己未 庚申 辛戌 壬亥 癸丑', () => {
    expect(STEM_HOME).toEqual({ 甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳', 己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑' });
  });

  it('唯一贼克取用神：一课上克下 → 贼克，初传=该课上神', () => {
    const ke: KeLike[] = [
      { lower: '寅', upper: '申', relation: '上克下' },
      { lower: '申', upper: '申', relation: '比和' },
      { lower: '辰', upper: '辰', relation: '比和' },
      { lower: '辰', upper: '辰', relation: '比和' },
    ];
    const r = chuChuanOf(ke, '甲', '辰', {} as never, false, false);
    expect(r.gate).toBe('贼克');
    expect(r.zhi).toBe('申');
  });

  it('比用：二课上克下，取与日干阴阳相同者', () => {
    const ke: KeLike[] = [
      { lower: '寅', upper: '申', relation: '上克下' },  // 申阳
      { lower: '未', upper: '亥', relation: '上克下' },  // 亥阴
      { lower: '辰', upper: '辰', relation: '比和' },
      { lower: '辰', upper: '辰', relation: '比和' },
    ];
    // 日干甲（阳）→ 取申
    const r = chuChuanOf(ke, '甲', '辰', {} as never, false, false);
    expect(r.gate).toBe('比用');
    expect(r.zhi).toBe('申');
    // 日干乙（阴）→ 取亥
    const r2 = chuChuanOf(ke, '乙', '辰', {} as never, false, false);
    expect(r2.zhi).toBe('亥');
  });

  it('伏吟优先；返吟在四课无克时取对冲支之上神', () => {
    const ke: KeLike[] = [{ lower: '子', upper: '午', relation: '上克下' }];
    expect(chuChuanOf(ke, '甲', '子', heavenPlate('子', '子'), true, false).gate).toBe('伏吟');
    const keNoKe: KeLike[] = [{ lower: '子', upper: '丑', relation: '比和' }];
    const r = chuChuanOf(keNoKe, '甲', '子', heavenPlate('子', '午'), false, true);
    expect(r.gate).toBe('返吟');
    expect(r.zhi).toBe('子'); // 返吟：heaven[冲(子)=午] = 子
  });

  it('返吟有贼克仍先审贼克', () => {
    const ke: KeLike[] = [
      { lower: '寅', upper: '申', relation: '上克下' },
      { lower: '申', upper: '申', relation: '比和' },
      { lower: '午', upper: '子', relation: '比和' },
      { lower: '子', upper: '午', relation: '比和' },
    ];
    const r = chuChuanOf(ke, '甲', '辰', heavenPlate('子', '午'), false, true);
    expect(r.gate).toBe('贼克');
    expect(r.zhi).toBe('申');
  });

  it('八专（干支同宫）：阳日顺数三辰起初传，标记八专', () => {
    // 甲寄寅，日支寅 → 四课课1与课3同下（寅）
    const h = heavenPlate('亥', '子');
    const ke: KeLike[] = [
      { lower: '寅', upper: h['寅'], relation: '比和' },
      { lower: h['寅'], upper: h[h['寅']], relation: '比和' },
      { lower: '寅', upper: h['寅'], relation: '比和' },
      { lower: h['寅'], upper: h[h['寅']], relation: '比和' },
    ];
    const r = chuChuanOf(ke, '甲', '寅', h, false, false);
    expect(r.gate).toBe('八专');
    // 阳日：干上神顺数三辰（含起点 → +2）
    const hi = DIZHI.indexOf(h['寅']);
    expect(r.zhi).toBe(DIZHI[(hi + 2) % 12]);
  });

  it('八专阴日：干上神逆数三辰（含起点 → −2）', () => {
    // 乙寄辰，日支辰
    const h = heavenPlate('亥', '子');
    const ke: KeLike[] = [
      { lower: '辰', upper: h['辰'], relation: '比和' },
      { lower: h['辰'], upper: h[h['辰']], relation: '比和' },
      { lower: '辰', upper: h['辰'], relation: '比和' },
      { lower: h['辰'], upper: h[h['辰']], relation: '比和' },
    ];
    const r = chuChuanOf(ke, '乙', '辰', h, false, false);
    expect(r.gate).toBe('八专');
    const hi = DIZHI.indexOf(h['辰']);
    expect(r.zhi).toBe(DIZHI[(hi - 2 + 12) % 12]);
  });

  it('八专中末传取干/支上神（集成：干支同宫日）', async () => {
    const base = Date.UTC(2026, 0, 1, 12, 0, 0);
    for (let i = 0; i < 300; i++) {
      const d = new Date(base + i * 86400000);
      const iso = d.toISOString();
      const c = await castLiuRen(
        { kind: 'time', time: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: 12, minute: 0 } },
        ctxOf(iso),
      );
      if (STEM_HOME[c.dayGan] === c.dayZhi) {
        expect(c.chuChuanGate).toBe('八专');
        expect(c.zhongChuan).toBe(c.heaven[STEM_HOME[c.dayGan]]);
        expect(c.moChuan).toBe(c.heaven[c.dayZhi]);
        return;
      }
    }
    throw new Error('未找到干支同宫的测试日期');
  });

  it('昴星阴日取天盘辰所临之地盘支（俯视）', () => {
    const h = heavenPlate('子', '卯'); // 子加卯
    // 四课上神全为卯（木），乙木与之比和 → 无贼克、无遥克，落入昴星
    const ke: KeLike[] = [
      { lower: '午', upper: '卯', relation: '比和' },
      { lower: '卯', upper: '卯', relation: '比和' },
      { lower: '未', upper: '卯', relation: '比和' },
      { lower: '卯', upper: '卯', relation: '比和' },
    ];
    const r = chuChuanOf(ke, '乙', '未', h, false, false);
    expect(r.gate).toBe('昴星(简化)');
    const b = DIZHI.find((x) => h[x] === '辰')!; // 天盘辰所临之地盘支
    expect(r.zhi).toBe(b);
  });

  it('三传三合环序：初子→中辰→末申；初辰→中申→末子', () => {
    expect(zhongMoOf('子')).toEqual({ zhong: '辰', mo: '申' });
    expect(zhongMoOf('辰')).toEqual({ zhong: '申', mo: '子' });
    expect(zhongMoOf('巳')).toEqual({ zhong: '酉', mo: '丑' });
  });

  it('涉害深度（《六壬粹言》丁卯日黄金例）：丑加卯历乙木一重、亥加丑历辰戊未己戌土五重', () => {
    // 候选丑（上神临于卯）、候选亥（上神临于丑）
    const h = { 卯: '丑', 丑: '亥' } as Record<Zhi, Zhi>;
    h['寅'] = '子'; h['辰'] = '子'; h['巳'] = '子'; h['午'] = '子'; h['未'] = '子'; h['申'] = '子'; h['酉'] = '子'; h['戌'] = '子'; h['亥'] = '子'; h['子'] = '子';
    expect(sheHaiDepthOf('丑', h)).toBe(1); // 自卯之下一宫辰起：辰位寄乙木克土 → 1 重
    expect(sheHaiDepthOf('亥', h)).toBe(5); // 辰(土)+巳寄戊(土)+未(土)+未寄己(土)+戌(土) = 5 重
  });

  it('涉害取深者：丁卯日 丑1 vs 亥5 → 亥', () => {
    const h = { 卯: '丑', 丑: '亥' } as Record<Zhi, Zhi>;
    for (const b of DIZHI) if (!h[b]) h[b] = '子';
    const r = pickSheHai([{ lower: '卯', upper: '丑' }, { lower: '丑', upper: '亥' }], h, '丁', '卯');
    expect(r.gate).toBe('涉害');
    expect(r.zhi).toBe('亥');
  });

  it('同深：见机取「四孟位上神」（临位申孟 > 临位卯仲）', () => {
    // 候选丑（临卯）涉害 1 重（辰位寄乙木克土）；候选亥（临申）涉害 1 重（戌位土克水）；临位一仲一孟 → 取孟位之亥
    const h = { 卯: '丑', 申: '亥' } as Record<Zhi, Zhi>;
    for (const b of DIZHI) if (!h[b]) h[b] = '子';
    expect(sheHaiDepthOf('丑', h)).toBe(1);
    expect(sheHaiDepthOf('亥', h)).toBe(1);
    const r = pickSheHai([{ lower: '卯', upper: '丑' }, { lower: '申', upper: '亥' }], h, '丁', '卯');
    expect(r.zhi).toBe('亥');
  });

  it('涉害按深取胜（亥加午盘：巳3 vs 午2 → 巳）', () => {
    const h = heavenPlate('亥', '午');
    const r = pickSheHai([{ lower: '寅', upper: '巳' }, { lower: '亥', upper: '午' }], h, '甲', '辰');
    expect(r.gate).toBe('涉害');
    expect(r.zhi).toBe('巳'); // depth(巳)=3 > depth(午)=2（受克深者为用）
  });

  it('遥克（无贼克）：日干甲木克课上神土', () => {
    const ke: KeLike[] = [
      { lower: '寅', upper: '辰', relation: '比和' },  // 辰土，甲木克之
      { lower: '辰', upper: '未', relation: '比和' },
      { lower: '申', upper: '子', relation: '比和' },
      { lower: '子', upper: '午', relation: '比和' },
    ];
    const r = chuChuanOf(ke, '甲', '申', {} as never, false, false);
    expect(r.gate).toBe('遥克');
    expect(r.zhi).toBe('辰');
  });
});

describe('贵人十二天将', () => {
  it('甲戊庚牛羊：昼丑夜未', () => {
    expect(guiRenOf('甲', '午')).toEqual({ branch: '丑', isDay: true });
    expect(guiRenOf('甲', '子')).toEqual({ branch: '未', isDay: false });
  });

  it('阳贵顺行：贵人丑 → 螣蛇寅 → 朱雀卯…', () => {
    const gods = guiGodsOf('丑', true);
    expect(gods[0]).toEqual({ branch: '丑', god: '贵人' });
    expect(gods[1]).toEqual({ branch: '寅', god: '螣蛇' });
    expect(gods[2]).toEqual({ branch: '卯', god: '朱雀' });
    expect(gods.length).toBe(12);
    expect(TWELVE_GODS).toContain('白虎');
  });

  it('阴贵逆行：贵人未 → 螣蛇午 → 朱雀巳…', () => {
    const gods = guiGodsOf('未', false);
    expect(gods[0]).toEqual({ branch: '未', god: '贵人' });
    expect(gods[1]).toEqual({ branch: '午', god: '螣蛇' });
    expect(gods[2]).toEqual({ branch: '巳', god: '朱雀' });
  });
});

describe('驿马', () => {
  it('申子辰马在寅，寅午戌马在申，巳酉丑马在亥，亥卯未马在巳', () => {
    expect(yiMaOf('子')).toBe('寅');
    expect(yiMaOf('午')).toBe('申');
    expect(yiMaOf('酉')).toBe('亥');
    expect(yiMaOf('卯')).toBe('巳');
  });
});

describe('时间起课集成', () => {
  it('2026-08-29 12:00 排出完整课体（四课三传天将齐备）', async () => {
    const c = await castLiuRen({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    expect(c.art).toBe('liuren');
    expect(c.ke.length).toBe(4);
    expect(c.heaven[c.monthJiang]).toBe(c.shiZhi);           // 月将加占时
    expect(BRANCH_RING as readonly string[]).toContain(c.chuChuan);
    expect(c.guiGods.length).toBe(12);
    expect(c.configHash).toMatch(/^cfg_[0-9a-f]+$/);
  });

  it('同时刻起课确定（configHash 一致）', async () => {
    const a = await castLiuRen({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    const b = await castLiuRen({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    expect(a.chuChuan).toBe(b.chuChuan);
    expect(a.configHash).toBe(b.configHash);
  });

  it('非时间起课抛错', async () => {
    await expect(castLiuRen({ kind: 'numbers', numbers: [1, 2, 3] }, ctxOf('2026-08-29T12:00:00'))).rejects.toThrow('时间起课');
  });

  it('月将 = 节气月支之六合（课体递推自洽）', async () => {
    const c = await castLiuRen({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    // 第二课下支=第一课上神；第四课下支=第三课上神
    const g1 = c.ke[0]!;
    const g2 = c.ke[1]!;
    expect(g2.lower).toBe(g1.upper);
    expect(g2.upper).toBe(c.heaven[g1.upper]);
    const g3 = c.ke[2]!;
    const g4 = c.ke[3]!;
    expect(g4.lower).toBe(g3.upper);
  });

  it('课体关系正值生克四类之一', async () => {
    const c = await castLiuRen({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, ctxOf('2026-08-29T12:00:00'));
    for (const k of c.ke) {
      expect(['上克下', '下贼上', '比和']).toContain(k.relation);
    }
  });
});

describe('大六壬断语规则', () => {
  it('规则集含定课/用神/贵人/空亡/驿马断（均 D 级无引文）', async () => {
    const c = await castLiuRen({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, { now: new Date('2026-08-29T12:00:00'), random: () => 0.5, tzOffsetHours: 8 });
    const rules = await liurenPlugin.rules(c, {});
    const ids = rules.map((r) => r.ruleId);
    expect(ids).toContain('liuren.dingke');
    expect(ids.some((id) => id.startsWith('liuren.yongshen.'))).toBe(true);
    expect(ids).toContain('liuren.guiren');
    expect(ids).toContain('liuren.kongwang');
    expect(ids).toContain('liuren.yima');
    for (const r of rules) {
      expect(r.confidenceLevel).toBe('D');
      expect(r.citations.length).toBe(0);
    }
  });

  it('用神空亡 → 断语标注', async () => {
    const c = await castLiuRen({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, { now: new Date('2026-08-29T12:00:00'), random: () => 0.5, tzOffsetHours: 8 });
    const rules = await liurenPlugin.rules(c, {});
    const kw = rules.find((r) => r.ruleId === 'liuren.kongwang')!;
    expect(kw.text).toContain('旬空');
    const yongKong = c.xunKongBranches.includes(c.chuChuan);
    expect(kw.severity).toBe(yongKong ? '变数' : '提示');
  });

  it('涉害课 → 补充白话讲解（深浅计法 + 见机/察微/复等分判，均 D 级无引文）', async () => {
    const c = await castLiuRen({ kind: 'time', time: { year: 2026, month: 8, day: 29, hour: 12, minute: 0 } }, { now: new Date('2026-08-29T12:00:00'), random: () => 0.5, tzOffsetHours: 8 });
    const chart = { ...c, chuChuanGate: '涉害' as const };
    const rules = await liurenPlugin.rules(chart, {});
    const shehai = rules.find((r) => r.ruleId === 'liuren.yongshen.shehai')!;
    expect(shehai).toBeDefined();
    expect(shehai.text).toContain('本家');
    expect(shehai.text).toContain('藏干');
    expect(shehai.text).toContain('历尽风霜');
    const tie = rules.find((r) => r.ruleId === 'liuren.yongshen.shehai.tie')!;
    expect(tie).toBeDefined();
    expect(tie.text).toContain('孟位');
    expect(tie.text).toContain('仲位');
    for (const r of rules.filter((x) => x.ruleId.startsWith('liuren.yongshen.shehai'))) {
      expect(r.confidenceLevel).toBe('D');
      expect(r.citations.length).toBe(0);
    }
  });
});