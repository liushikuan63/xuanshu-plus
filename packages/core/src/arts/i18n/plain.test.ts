import { describe, expect, it } from 'vitest';
import { plainRuleText, plainSummary } from './plain.js';
import type { RuleHit } from '../../types.js';

const rule = (text: string, severity: RuleHit['severity']): RuleHit => ({ ruleId: 'x', text, severity, confidenceLevel: 'D', citations: [] });

describe('白话精讲层', () => {
  it('六爻：旬空/月破术语转白话，保留干支与结论', () => {
    const out = plainRuleText('liuyao', rule('财爻旬空，待出空填实；月破。', '变数'));
    expect(out).toContain('暂时落空');
    expect(out).toContain('被打压');
    expect(out).toContain('财爻');
    expect(out.startsWith('白话精讲（六爻）')).toBe(true);
    expect(out).toContain('有变数');
  });

  it('干支生克口语化：生→在帮，克→在压', () => {
    const out = plainRuleText('bazi', rule('木生火且土克水时需注意', '提示'));
    expect(out).toContain('在帮');
    expect(out).toContain('在压');
  });

  it('八字术语白话：日主/大运/喜用神', () => {
    const out = plainRuleText('bazi', rule('日主偏强，大运、喜用神。论吉凶', '吉'));
    expect(out).toContain('你性子自主');
    expect(out).toContain('十年一段');
    expect(out).toContain('对你有帮助的力量');
  });

  it('奇门/六壬/金口诀术语均命中', () => {
    expect(plainRuleText('qimen', rule('值符落宫，伏吟', '变数'))).toContain('事情停滞');
    expect(plainRuleText('liuren', rule('用神，旬空，驿马在寅', '变数'))).toContain('这件事的核心');
    expect(plainRuleText('jinkou', rule('"人元"克"地分"', '变数'))).toContain('天时外应');
    expect(plainRuleText('xiaoliuren', rule('末宫：空亡，应期迟滞', '变数'))).toContain('最后定断的宫');
  });

  it('涉害白话：受克深者为用、打磨之意', () => {
    const a = plainRuleText('liuren', rule('四课并见，涉害。发用', '变数'));
    expect(a).toContain('回本宫路上');
    expect(a).toContain('克得最多');
    const b = plainRuleText('liuren', rule('受克深，为用', '变数'));
    expect(b).toContain('被克得最狠');
    const c = plainRuleText('liuren', rule('涉害深。先发用', '变数'));
    expect(c).toContain('最折腾');
  });

  it('涉害修正逻辑白话：本家止/藏干分计/孟仲季定机', () => {
    const a = plainRuleText('liuren', rule('"地盘本家"止，"藏干"亦计重', '变数'));
    expect(a).toContain('地盘老巢');
    expect(a).toContain('寄住的天干');
    const b = plainRuleText('liuren', rule('（见机）（察微）（复等）取先见', '变数'));
    expect(b).toContain('四孟位');
    expect(b).toContain('四仲位');
    expect(b).toContain('先取四孟位');
    expect(b).toContain('取四仲位');
    expect(b).toContain('日干/日支上神');
  });

  it('原文以句号收尾时接入程度词不出现「。；」粘连', () => {
    const out = plainRuleText('liuren', rule('磨过去了事才成。', '变数'));
    expect(out).toContain('磨过去了事才成；有变数，多留意。');
    expect(out).not.toContain('。；');
    const ex = plainRuleText('liuren', rule('防被动受阻！', '凶'));
    expect(ex).not.toContain('！；');
    expect(ex).toContain('要谨慎，容易受阻');
  });

  it('十二天将不重复翻、克贼关系有白话', () => {
    const a = plainRuleText('liuren', rule('十二天将。布支，天将。主事体', '提示'));
    expect(a).toContain('十二位天将');
    expect(a).not.toContain('十二十二');
    expect(a).toContain('十二种人事意象');
    const b = plainRuleText('liuren', rule('上克下、下贼上。', '变数'));
    expect(b).toContain('上面克着下面');
    expect(b).toContain('下面反克上面');
  });

  it('标点规整：句末「：/……」不与后缀粘连、句内连排去重', () => {
    const a = plainRuleText('liuren', rule('主事体相当：', '变数'));
    expect(a).not.toContain('：；');
    expect(a).toContain('主事体相当；有变数，多留意。');
    const b = plainRuleText('liuren', rule('磨过去才能成……', '变数'));
    expect(b).not.toContain('……；');
    expect(b).toContain('才能成；有变数');
    const c = plainRuleText('liuren', rule('忽生变故。。。需静待', '提示'));
    expect(c).not.toContain('。。');
    const d = plainRuleText('liuren', rule('受阻，。此路不通', '凶'));
    expect(d).not.toContain('，。');
    expect(d).toContain('受阻。此路不通');
  });

  it('词边界：术语嵌在干支/长词内不拆分，避免恶性再替换', () => {
    // 「涉害课」「四孟位」「取用神亥」整体保留原文，不出现「为用神课」「四四孟位」「取用神（…）」
    const a = plainRuleText('liuren', rule('涉害课白话：四孟位取用神亥，涉害者发用', '提示'));
    expect(a).toContain('涉害课白话：四孟位');
    expect(a).toContain('取用神亥，涉害者发用');
    expect(a).not.toContain('四四孟位');
    expect(a).not.toContain('为用神课');
    expect(a).not.toContain('取用神亥（这件事的核心）');
    // 独立出现的「用神」仍带白话锚点
    const b = plainRuleText('liuren', rule('用神，旬空', '提示'));
    expect(b).toContain('用神（这件事的核心）');
  });

  it('白话总评统计吉凶变数', () => {
    const s = plainSummary('liuyao', [rule('a', '吉'), rule('b', '吉'), rule('c', '凶'), rule('d', '变数')]);
    expect(s).toContain('整体偏顺');
    expect(s).toContain('2 条偏吉 / 1 条偏凶 / 1 条有变数');
  });

  it('无凶信号时给鼓励性提示', () => {
    const s = plainSummary('qimen', [rule('a', '吉'), rule('b', '提示')]);
    expect(s).toContain('没有明显的凶信号');
  });
});