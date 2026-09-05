import { describe, expect, it } from 'vitest';
import { IntakeWizard, assessQuestion, summarize, defaultCtx } from './wizard.js';
import { checkQuality, repeatDivinationWarning, evidenceGapMessage } from './quality.js';
import { TAXONOMY, categories, sensitiveCategories } from './taxonomy.js';
import { ALL_PLAYBOOKS, playbookFor } from './playbooks.js';
import { castLiuyao } from '@xuanshu/core';

describe('事项分类', () => {
  it('14 类齐全', () => {
    expect(categories().length).toBe(14);
    expect(TAXONOMY['失物'].keyFactors.length).toBeGreaterThan(0);
  });

  it('敏感事项拦截', () => {
    expect(sensitiveCategories()).toEqual(expect.arrayContaining(['健康', '生育', '官非']));
  });
});

describe('playbook 十二张卡', () => {
  it('十二张卡：失物/感情/事业/求财/学业/出行/官非/合作/决策/健康齐全', () => {
    expect(ALL_PLAYBOOKS.map((p) => p.category)).toEqual(expect.arrayContaining(['失物', '感情', '事业', '求财', '学业', '出行', '官非', '合作', '决策', '健康', '其他']));
    expect(playbookFor('失物')).toBeDefined();
    expect(playbookFor('求财')).toBeDefined();
    expect(playbookFor('学业')).toBeDefined();
    expect(playbookFor('出行')).toBeDefined();
    expect(playbookFor('官非')).toBeDefined();
    expect(playbookFor('合作')).toBeDefined();
    expect(playbookFor('决策')).toBeDefined();
    expect(playbookFor('健康')).toBeDefined();
    expect(playbookFor('事业', '紫微格局')).toBeDefined();
    expect(playbookFor('择日')).toBeUndefined();
  });

  it('九段结构完整', () => {
    for (const pb of ALL_PLAYBOOKS) {
      expect(pb.arts.primary.length).toBeGreaterThan(0);
      expect(pb.howToAsk.goodExamples.length).toBeGreaterThan(0);
      expect(pb.howToCast.methods.length).toBeGreaterThan(0);
      expect(pb.yongShen.length).toBeGreaterThan(0);
      expect(pb.signals.length).toBeGreaterThan(0);
      expect(pb.timing.rules.length).toBeGreaterThan(0);
      expect(pb.readingList.length).toBeGreaterThan(0);
      expect(pb.recordTemplate.fields.length).toBeGreaterThan(0);
      expect(pb.forbidden.length).toBeGreaterThan(0);
    }
  });

  it('每条规则带 ruleId + citations + confidenceLevel', () => {
    for (const pb of ALL_PLAYBOOKS) {
      for (const y of pb.yongShen) {
        expect(y.ruleId).toBeTruthy();
        expect(y.citations.length).toBeGreaterThan(0);
        expect(['A', 'B', 'C', 'D', 'E']).toContain(y.confidenceLevel);
      }
      for (const s of pb.signals) {
        expect(s.ruleId).toBeTruthy();
        expect(s.citations.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('6 步向导', () => {
  it('失物全流程', () => {
    const w = new IntakeWizard();
    expect(w.current().step).toBe(0);
    w.chooseCategory('失物');
    const r = w.refineQuestion('我的身份证昨天在地铁站附近丢了，不确定是不是被人拿走了，三天内能找回吗');
    expect(r.state.step).toBe(2);
    expect(r.state.structured.what).toBe('身份证');
    expect(r.state.structured.isStolen).toBe('不确定');
    w.confirmArt('liuyao');
    expect(w.current().step).toBe(3);
    w.submitInput({ kind: 'numbers', numbers: [1, 3, 5] });
    expect(w.current().step).toBe(4);
    expect(w.current().summary).toContain('失物');
  });

  it('问句过泛触发提示', () => {
    const w = new IntakeWizard();
    w.chooseCategory('事业');
    const r = w.refineQuestion('我事业会不会成功');
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('敏感事项给出指引', () => {
    const w = new IntakeWizard();
    const r = w.chooseCategory('健康');
    expect(r.state.blocked).toBeDefined();
    expect(r.state.blocked!.guidance).toContain('专业机构');
  });
});

describe('问句质量', () => {
  it('过泛提示', () => {
    const q = checkQuality('我事业会不会成功');
    expect(q.warnings.length).toBeGreaterThan(0);
  });

  it('不可验证表述拦截', () => {
    const q = checkQuality('我前世是谁');
    expect(q.warnings.some((w) => w.includes('不可验证'))).toBe(true);
  });

  it('重复起卦提示', () => {
    expect(repeatDivinationWarning('身份证', '2026-08-29')).toContain('初筮告');
  });

  it('证据缺口提示', () => {
    expect(evidenceGapMessage('六爻')).toContain('请导入书库');
  });
});

describe('end-to-end：向导 + 六爻排盘', () => {
  it('失物 → 报数起卦 → 出盘', async () => {
    const ctx = defaultCtx(new Date('2024-02-10T12:00:00+08:00'));
    const w = new IntakeWizard();
    w.chooseCategory('失物');
    w.refineQuestion('我的钱包在商场丢了，三天内能找回吗');
    w.confirmArt('liuyao');
    w.submitInput({ kind: 'numbers', numbers: [1, 3, 5] });
    const chart = await castLiuyao(w.current().input!, ctx);
    expect(chart.benName).toBe('天火同人');
    expect(chart.movingIndices.length).toBe(1);
  });
});
