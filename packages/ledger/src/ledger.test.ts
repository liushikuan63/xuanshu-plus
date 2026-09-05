import { describe, expect, it } from 'vitest';
import { quotaStatus, DEFAULT_QUOTA } from './quota.js';
import { MemoryCaseStore, makeCaseRecord } from './store.js';
import { LocalCaseStore, memoryStorage } from './localstore.js';
import { applyOutcome, calibrate } from './feedback.js';
import { exportCsv, exportJson, exportMarkdown, isIncomingCaseNewer, parseCaseImport } from './io.js';
import { LocalFollowupStore, aggregateWindowStats, type WindowFollowup } from './timing.js';
import type { CaseRecord } from './schema.js';

function sampleCase(over: Partial<CaseRecord> = {}): CaseRecord {
  return makeCaseRecord({
    artType: 'liuyao',
    question: { category: '失物', summary: '我的身份证丢了', structured: {} },
    input: { raw: {}, normalized: {}, config: {}, configHash: 'cfg_1', engineVersion: '0.1.0' },
    result: { chart: {}, ruleHits: [{ ruleId: 'liuyao.lost.ji.wangxiang', text: '用神旺相', confidenceLevel: 'A' }], warnings: [], evidenceRefs: [], boardHash: 'b1' },
    ...over,
  });
}

describe('99 条配额', () => {
  it('90 条软提醒', () => {
    const s = quotaStatus('liuyao', 90, 0);
    expect(s.softReached).toBe(true);
    expect(s.full).toBe(false);
    expect(s.suggestion).toBe('export-backup');
  });

  it('99 条满额引导归档', () => {
    const s = quotaStatus('liuyao', 99, 3);
    expect(s.full).toBe(true);
    expect(s.remaining).toBe(0);
    expect(s.suggestion).toBe('archive-oldest');
  });

  it('未满时不提醒', () => {
    const s = quotaStatus('liuyao', 50, 0);
    expect(s.softReached).toBe(false);
    expect(s.suggestion).toBe('none');
  });

  it('可配置上限', () => {
    const s = quotaStatus('liuyao', 150, 0, { limit: 199, softThreshold: 180 });
    expect(s.full).toBe(false);
    expect(s.remaining).toBe(49);
  });
});

describe('案例存储', () => {
  it('增删查与按术数计数', async () => {
    const store = new MemoryCaseStore();
    await store.add(sampleCase());
    await store.add(sampleCase({ artType: 'bazi' }));
    expect(await store.countByArt('liuyao')).toBe(1);
    expect(await store.countByArt('bazi')).toBe(1);
    const list = await store.list({ art: 'liuyao' });
    expect(list.length).toBe(1);
  });

  it('重复起卦判定（5 分钟内同 hash 同摘要）', async () => {
    const store = new MemoryCaseStore();
    const rec = sampleCase({ createdAt: new Date().toISOString() });
    await store.add(rec);
    const dup = await store.findDuplicate({ configHash: 'cfg_1', summary: '我的身份证丢了', createdAt: new Date().toISOString() });
    expect(dup).toBeDefined();
    const notDup = await store.findDuplicate({ configHash: 'cfg_1', summary: '我的身份证丢了', createdAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    expect(notDup).toBeNull();
  });

  it('崩溃恢复：open 且未标注视为未完成', async () => {
    const store = new MemoryCaseStore();
    await store.add(sampleCase({ status: 'open', annotation: { presetTags: [], customTags: [], updatedAt: '' } }));
    const done = sampleCase({ status: 'open', annotation: { presetTags: ['应验'], customTags: [], outcome: { result: '应验', at: new Date().toISOString() }, updatedAt: new Date().toISOString() } });
    await store.add(done);
    const incomplete = await store.incomplete();
    expect(incomplete.length).toBe(1);
  });
});

describe('LocalCaseStore 持久化', () => {
  it('写入后可跨实例重载（同一存储后端）', async () => {
    const storage = memoryStorage();
    const a = new LocalCaseStore(storage);
    await a.add(sampleCase());
    await a.add(sampleCase({ artType: 'bazi' }));
    const b = new LocalCaseStore(storage); // 模拟刷新/重启
    expect(await b.countByArt('liuyao')).toBe(1);
    expect(await b.countByArt('bazi')).toBe(1);
    const list = await b.list({ art: 'liuyao' });
    expect(list.length).toBe(1);
  });

  it('remove 后持久化生效', async () => {
    const storage = memoryStorage();
    const a = new LocalCaseStore(storage);
    const rec = sampleCase();
    await a.add(rec);
    await a.remove(rec.caseId);
    const b = new LocalCaseStore(storage);
    expect(await b.get(rec.caseId)).toBeUndefined();
  });

  it('损坏数据安全降级为空库', async () => {
    const storage = memoryStorage();
    storage.setItem('xuanshu.cases.v1', '{not-json');
    const s = new LocalCaseStore(storage);
    expect(await s.countByArt('liuyao')).toBe(0);
  });

  it('持久化失败时抛错且不提交内存变更', async () => {
    const storage = memoryStorage();
    const store = new LocalCaseStore(storage);
    const first = sampleCase({ caseId: 'first' });
    await store.add(first);
    const failing = {
      ...storage,
      setItem: () => { throw new Error('quota exceeded'); },
    };
    const brokenStore = new LocalCaseStore(failing);
    await expect(brokenStore.add(sampleCase({ caseId: 'second' }))).rejects.toThrow('持久化失败');
    expect(await brokenStore.get('second')).toBeUndefined();
    expect(await brokenStore.get('first')).toBeDefined();
  });
});

describe('闭环统计', () => {
  it('统计应验率并标注样本不足', async () => {
    const store = new MemoryCaseStore();
    for (let i = 0; i < 5; i++) {
      await store.add(sampleCase({ annotation: { presetTags: ['应验'], customTags: [], outcome: { result: '应验', at: new Date().toISOString() }, updatedAt: new Date().toISOString() } }));
    }
    const stats = await store.stats();
    expect(stats.byArt['liuyao']!.judged).toBe(5);
    expect(stats.byArt['liuyao']!.hit).toBe(5);
    const insights = calibrate([], stats);
    expect(insights.some((i) => i.dimension === 'art' && i.key === 'liuyao' && !i.sampleEnough)).toBe(true);
    expect(insights[0]!.message).toContain('样本不足');
  });

  it('applyOutcome 回标应验：状态 resolved、revision、presetTags 更新', () => {
    const rec = applyOutcome(sampleCase({ revision: 0, annotation: { presetTags: [], customTags: [], updatedAt: '' } }), {
      result: '应验',
      note: '三天内找回',
      matchedRuleIds: ['liuyao.lost.ji.wangxiang'],
    });
    expect(rec.status).toBe('resolved');
    expect(rec.revision).toBe(1);
    expect(rec.annotation.outcome?.result).toBe('应验');
    expect(rec.annotation.outcome?.note).toBe('三天内找回');
    expect(rec.annotation.presetTags).toContain('应验');
  });

  it('applyOutcome 未应验至今（部分/未应验）update 持久化', async () => {
    const storage = memoryStorage();
    const store = new LocalCaseStore(storage);
    const rec = sampleCase();
    await store.add(rec);
    await store.update(applyOutcome(rec, { result: '未应验', note: '至今未找回' }));
    const got = await store.get(rec.caseId);
    expect(got!.status).toBe('resolved');
    expect(got!.annotation.outcome?.result).toBe('未应验');
  });
});

describe('导出', () => {
  it('JSON 导出带 meta 与 checksum', () => {
    const json = JSON.parse(exportJson([sampleCase()]));
    expect(json.meta.schemaVersion).toBe(1);
    expect(json.meta.appVersion).toBe('0.1.0');
    expect(json.meta.checksum).toMatch(/^sha1-like_/);
    expect(json.records.length).toBe(1);
  });

  it('JSON 导入校验 checksum 与记录结构', () => {
    const exported = exportJson([sampleCase()]);
    const imported = parseCaseImport(exported);
    expect(imported.checksumVerified).toBe(true);
    expect(imported.records).toHaveLength(1);

    const tampered = JSON.parse(exported);
    tampered.records[0].question.summary = '已篡改';
    expect(() => parseCaseImport(JSON.stringify(tampered))).toThrow('checksum 校验失败');
  });

  it('裸数组导入跳过结构损坏的记录', () => {
    const imported = parseCaseImport(JSON.stringify([sampleCase(), { caseId: 'broken', artType: 'liuyao' }]));
    expect(imported.checksumVerified).toBe(false);
    expect(imported.records).toHaveLength(1);
    expect(imported.invalidCount).toBe(1);
  });

  it('同 caseId 冲突优先保留较高 revision', () => {
    const existing = sampleCase({ revision: 1 });
    expect(isIncomingCaseNewer(sampleCase({ revision: 2 }), existing)).toBe(true);
    expect(isIncomingCaseNewer(sampleCase({ revision: 0 }), existing)).toBe(false);
  });

  it('CSV 导出', () => {
    const csv = exportCsv([sampleCase()]);
    expect(csv.split('\n')[0]).toBe('caseId,artType,category,summary,createdAt,status,result,note,keyTakeaway');
  });

  it('CSV 导出阻断表格公式注入', () => {
    const csv = exportCsv([sampleCase({ question: { category: '失物', summary: '=HYPERLINK("https://example.test")', structured: {} } })]);
    expect(csv).toContain("\"'=HYPERLINK(\"\"https://example.test\"\")\"");
  });

  it('Markdown 导出含断语与出处', () => {
    const md = exportMarkdown([sampleCase()]);
    expect(md).toContain('用神旺相');
    expect(md).toContain('liuyao.lost.ji.wangxiang');
  });
});

describe('应期窗口回收', () => {
  const row = (over: Partial<WindowFollowup> = {}): WindowFollowup => ({
    key: over.key ?? 'c1|2026-09-01|liuyao.timeline.ying-value',
    caseId: over.caseId ?? 'c1', artType: over.artType ?? 'liuyao', category: over.category ?? '失物',
    date: over.date ?? '2026-09-01', ruleId: over.ruleId ?? 'liuyao.timeline.ying-value',
    tone: over.tone ?? 'neutral', label: over.label ?? '应爻值日', verdict: over.verdict ?? '待观察',
    recordedAt: over.recordedAt ?? '2026-09-10T00:00:00.000Z', actualDate: over.actualDate,
  });

  it('到期未判不进入命中率分母，提前判定单列', () => {
    const result = aggregateWindowStats([
      row(),
      row({ key: 'hit', date: '2026-09-02', verdict: '应验' }),
      row({ key: 'miss', date: '2026-09-03', verdict: '未应验' }),
      row({ key: 'early', date: '2026-09-20', verdict: '应验' }),
    ], '2026-09-10');
    const stat = result.byRule['liuyao.timeline.ying-value']!;
    expect(stat).toMatchObject({ due: 3, judged: 2, hit: 1, early: 1 });
    expect(result.insufficient).toContain('liuyao.timeline.ying-value');
  });

  it('实际日期偏差与应验判定分开统计', () => {
    const result = aggregateWindowStats([
      row({ key: 'a', verdict: '未应验', actualDate: '2026-09-03' }),
      row({ key: 'b', caseId: 'c2', date: '2026-09-02', verdict: '应验', actualDate: '2026-09-01' }),
    ], '2026-09-10', 2, 2);
    expect(result.byRule['liuyao.timeline.ying-value']).toMatchObject({
      judged: 2, hit: 1, dated: 2, inTolerance: 2, offsets: [-1, 2], medianOffset: 1, medianAbs: 2,
    });
  });

  it('持久化窗口且不会覆盖已有判定', async () => {
    const storage = memoryStorage();
    const store = new LocalFollowupStore(storage);
    const entries = [{ date: '2026-09-12', ganzhi: '己未', offsetDays: 7, label: '应爻值日', tone: 'neutral' as const, basis: ['应爻'], plain: '核对', ruleId: 'liuyao.timeline.ying-value' }];
    expect(await store.seed('c1', 'liuyao', '失物', entries)).toBe(1);
    const key = (await store.list('c1'))[0]!.key;
    await store.setVerdict(key, '应验', { actualDate: '2026-09-13' });
    expect(await store.seed('c1', 'liuyao', '失物', entries)).toBe(0);
    const reloaded = new LocalFollowupStore(storage);
    expect((await reloaded.list('c1'))[0]).toMatchObject({ verdict: '应验', actualDate: '2026-09-13' });
  });
});
