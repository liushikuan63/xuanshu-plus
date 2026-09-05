import { describe, expect, it } from 'vitest';
import { hourBranchNum, palmOf, xiaoliurenByNumbers, xiaoliurenPositions, castXiaoliuren, LIU_SHEN_PALMS } from './engine.js';

const ctxOf = (iso: string) => ({ now: new Date(iso), random: () => 0.5, tzOffsetHours: 8 });

describe('小六壬 · 掌诀推宫', () => {
  it('正月·初一·子时 → 三宫皆大安（经典基准）', () => {
    const p = xiaoliurenPositions(1, 1, 1);
    expect([p.chu, p.zhong, p.mo]).toEqual([1, 1, 1]);
    expect(palmOf(p.mo).name).toBe('大安');
  });

  it('六宫名固定有序且六煞俱在', () => {
    expect(LIU_SHEN_PALMS.map((x) => x.name)).toEqual(['大安', '留连', '速喜', '赤口', '小吉', '空亡']);
    expect(new Set(LIU_SHEN_PALMS.map((x) => x.omen))).toEqual(new Set(['吉', '凶', '变数']));
  });

  it('按月日时递推可复算（确定性）', () => {
    // 3 月 8 日 午时：chu=(3-1)%6+1=3(速喜)；zhong=(3-1+8-1)%6+1=(9)%6+1=4(赤口)；mo=(4-1+7-1)%6+1=(9)%6+1=4(赤口)
    const p = xiaoliurenPositions(3, 8, 7);
    expect([p.chu, p.zhong, p.mo]).toEqual([3, 4, 4]);
    expect(palmOf(p.mo).name).toBe('赤口');
  });

  it('报数起课（1,1,1）与手动推一致', () => {
    expect(xiaoliurenByNumbers(1, 1, 1)).toEqual({ chu: 1, zhong: 1, mo: 1 });
  });

  it('时辰转地支序号：子=1、丑=2、午=7、23≈子', () => {
    expect(hourBranchNum(0)).toBe(1);  // 子
    expect(hourBranchNum(1)).toBe(2);  // 丑
    expect(hourBranchNum(12)).toBe(7); // 午
    expect(hourBranchNum(23)).toBe(1); // 子时跨日
  });
});

describe('小六壬 · 起课', () => {
  it('按时间起课产出完整盘面（结果必为六宫之一）', async () => {
    const chart = await castXiaoliuren({ kind: 'time', time: { year: 2026, month: 8, day: 26, hour: 10, minute: 30 } }, ctxOf('2026-08-26T10:30:00'));
    expect(chart.art).toBe('xiaoliuren');
    expect(chart.lunarText).toContain('月');
    expect(LIU_SHEN_PALMS.map((x) => x.name)).toContain(chart.result.name);
    expect(chart.omen).toBe(chart.result.omen);
    expect(chart.configHash).toMatch(/^cfg_[0-9a-f]+$/);
  });

  it('同时刻起课结果确定（configHash 一致）', async () => {
    const a = await castXiaoliuren({ kind: 'time', time: { year: 2026, month: 8, day: 26, hour: 10, minute: 30 } }, ctxOf('2026-08-26T10:30:00'));
    const b = await castXiaoliuren({ kind: 'time', time: { year: 2026, month: 8, day: 26, hour: 10, minute: 30 } }, ctxOf('2026-08-26T10:30:00'));
    expect(a.result.name).toBe(b.result.name);
    expect(a.configHash).toBe(b.configHash);
  });

  it('报数起课支持三个数', async () => {
    const chart = await castXiaoliuren({ kind: 'numbers', numbers: [3, 8, 7] }, ctxOf('2026-08-26T10:30:00'));
    expect(chart.result.name).toBe('赤口');
  });

  it('每宫均带应期与趋避速断字段（非空）', async () => {
    for (const palm of LIU_SHEN_PALMS) {
      expect(palm.yingqi.length).toBeGreaterThan(0);
      expect(palm.advice.length).toBeGreaterThan(0);
    }
  });

  it('末宫应期/趋避进入盘面与主断规则', async () => {
    const chart = await castXiaoliuren({ kind: 'numbers', numbers: [3, 8, 7] }, ctxOf('2026-08-26T10:30:00'));
    expect(chart.result.yingqi).toBeTruthy();
    expect(chart.result.advice).toBeTruthy();
  });
});