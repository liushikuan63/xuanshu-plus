import { describe, expect, it } from 'vitest';
import { buildBazi, CANG_GAN, taoHua, yiMa, wenChang, yangRen, luShen, tianYi, shiShenToDayMaster } from './engine.js';
import { baziPlugin, wuxingDistribution, shiShenClassCounts } from './plugin.js';

describe('八字四柱黄金样本', () => {
  it('2024-02-10 12:00 → 甲辰年 丙寅月 甲辰日 庚午时', async () => {
    const chart = await buildBazi({ year: 2024, month: 2, day: 10, hour: 12, gender: 'male' });
    expect(chart.year.gan + chart.year.zhi).toBe('甲辰');
    expect(chart.month.gan + chart.month.zhi).toBe('丙寅');
    expect(chart.day.gan + chart.day.zhi).toBe('甲辰');
    expect(chart.hour.gan + chart.hour.zhi).toBe('庚午');
    expect(chart.dayMaster).toBe('甲');
  });

  it('2000-01-01 12:00 → 己卯年 丙子月 戊午日 戊午时（立春前）', async () => {
    const chart = await buildBazi({ year: 2000, month: 1, day: 1, hour: 12, gender: 'male' });
    expect(chart.year.gan + chart.year.zhi).toBe('己卯');
    expect(chart.month.gan + chart.month.zhi).toBe('丙子');
    expect(chart.day.gan + chart.day.zhi).toBe('戊午');
    expect(chart.hour.gan + chart.hour.zhi).toBe('戊午');
  });

  it('1984-02-02 12:00 → 癸亥年 乙丑月 丙寅日 甲午时', async () => {
    const chart = await buildBazi({ year: 1984, month: 2, day: 2, hour: 12, gender: 'male' });
    expect(chart.year.gan + chart.year.zhi).toBe('癸亥');
    expect(chart.month.gan + chart.month.zhi).toBe('乙丑');
    expect(chart.day.gan + chart.day.zhi).toBe('丙寅');
    expect(chart.hour.gan + chart.hour.zhi).toBe('甲午');
  });

  it('晚子时切分：23:30 日柱进一日', async () => {
    // 2024-02-10 甲辰日；23:30 按 23:00 切分 → 乙巳日
    const chart = await buildBazi({ year: 2024, month: 2, day: 10, hour: 23, minute: 30, gender: 'male' });
    expect(chart.day.gan + chart.day.zhi).toBe('乙巳');
  });

  it('东八区清晨不因 UTC 换算误落前一日', async () => {
    const chart = await buildBazi({ year: 2024, month: 2, day: 10, hour: 1, minute: 30, gender: 'male' });
    expect(chart.day.gan + chart.day.zhi).toBe('甲辰');
  });
});

describe('藏干与十神', () => {
  it('藏干表', () => {
    expect(CANG_GAN['子']).toEqual(['癸']);
    expect(CANG_GAN['寅']).toEqual(['甲', '丙', '戊']);
    expect(CANG_GAN['午']).toEqual(['丁', '己']);
  });

  it('十神（以日主甲为例）', () => {
    expect(shiShenToDayMaster('甲', '甲')).toBe('比肩');
    expect(shiShenToDayMaster('甲', '乙')).toBe('劫财');
    expect(shiShenToDayMaster('甲', '壬')).toBe('偏印');
    expect(shiShenToDayMaster('甲', '癸')).toBe('正印');
    expect(shiShenToDayMaster('甲', '丙')).toBe('食神');
    expect(shiShenToDayMaster('甲', '丁')).toBe('伤官');
    expect(shiShenToDayMaster('甲', '庚')).toBe('七杀');
    expect(shiShenToDayMaster('甲', '辛')).toBe('正官');
    expect(shiShenToDayMaster('甲', '戊')).toBe('偏财');
    expect(shiShenToDayMaster('甲', '己')).toBe('正财');
  });
});

describe('神煞', () => {
  it('桃花/驿马/文昌/羊刃/禄神/天乙', () => {
    expect(taoHua('子')).toBe('酉');
    expect(yiMa('申')).toBe('寅');
    expect(wenChang('甲')).toBe('巳');
    expect(yangRen('甲')).toBe('卯');
    expect(yangRen('乙')).toBeNull();
    expect(luShen('甲')).toBe('寅');
    expect(tianYi('甲')).toEqual(['丑', '未']);
    expect(tianYi('辛')).toEqual(['午', '寅']);
  });

  it('2024-02-10（甲辰日）神煞计算不抛错', async () => {
    const chart = await buildBazi({ year: 2024, month: 2, day: 10, hour: 12, gender: 'female' });
    expect(chart.shensha).toBeDefined();
    expect(chart.dayun.length).toBe(8);
  });
});

describe('大运', () => {
  it('阳年男顺行：2024 甲辰男顺排', async () => {
    const chart = await buildBazi({ year: 2024, month: 2, day: 10, hour: 12, gender: 'male' });
    expect(chart.qiyun.direction).toBe('顺');
    expect(chart.qiyun.age).toBeGreaterThan(7);
    expect(chart.qiyun.age).toBeLessThan(9);
    const first = chart.dayun[0]!;
    // 丙寅后第一步大运为丁卯
    expect(first.ganZhi.gan + first.ganZhi.zhi).toBe('丁卯');
  });

  it('阳年女逆行', async () => {
    const chart = await buildBazi({ year: 2024, month: 2, day: 10, hour: 12, gender: 'female' });
    expect(chart.qiyun.direction).toBe('逆');
    const first = chart.dayun[0]!;
    expect(first.ganZhi.gan + first.ganZhi.zhi).toBe('乙丑');
  });
});

describe('八字断语规则', () => {
  it('2024-02-10 甲辰/丙寅/甲辰/庚午：五行缺水、木最旺', async () => {
    const chart = await buildBazi({ year: 2024, month: 2, day: 10, hour: 12, gender: 'male' });
    const wx = wuxingDistribution(chart);
    expect(wx).toEqual({ 木: 3, 火: 2, 土: 2, 金: 1, 水: 0 });
    expect(chart.dayMaster).toBe('甲');
  });

  it('十神大类计数相对日主（甲）：比劫与财星并多', async () => {
    const chart = await buildBazi({ year: 2024, month: 2, day: 10, hour: 12, gender: 'male' });
    const cls = shiShenClassCounts(chart);
    const byName = Object.fromEntries(cls.map((c) => [c.cls, c.count]));
    expect(byName['比劫']).toBe(5);
    expect(byName['财星']).toBe(4);
    expect(byName['食伤']).toBe(3);
    expect(byName['印星']).toBe(2);
    expect(byName['官杀']).toBe(1);
  });

  it('规则集含五行分布与十神格局断（均 D 级无引文）', async () => {
    const chart = await buildBazi({ year: 2024, month: 2, day: 10, hour: 12, gender: 'male' });
    const rules = await baziPlugin.rules(chart, {});
    const wd = rules.find((r) => r.ruleId === 'bazi.wuxing.distribution')!;
    expect(wd).toBeDefined();
    expect(wd.text).toContain('缺「水」');
    expect(wd.confidenceLevel).toBe('D');
    expect(wd.citations.length).toBe(0);
    const ss = rules.find((r) => r.ruleId.startsWith('bazi.shishen.'))!;
    expect(ss).toBeDefined();
    expect(ss.confidenceLevel).toBe('D');
    expect(ss.text).toContain('十神结构');
    expect(ss.text).toContain('日主');
  });
});
