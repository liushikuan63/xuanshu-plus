import { useMemo, useState } from 'react';
import { artLabel, ART_TYPES, type ArtType } from '@xuanshu/core';
import {
  calibrate,
  localDateIso,
  type CaseRecord,
  type FeedbackStats,
  type OutcomeResult,
  type WindowFollowup,
  type WindowVerdict,
} from '@xuanshu/ledger';
import { FollowupPanel } from './FollowupPanel';

const OUTCOMES: OutcomeResult[] = ['应验', '部分应验', '未应验', '无法判断'];

export function CaseCenterView({
  cases,
  stats,
  followups,
  notes,
  statusMessage,
  onNoteChange,
  onOutcome,
  onFollowupVerdict,
  onExport,
  onImport,
}: {
  cases: CaseRecord[];
  stats: FeedbackStats | null;
  followups: WindowFollowup[];
  notes: Record<string, string>;
  statusMessage: string;
  onNoteChange: (caseId: string, note: string) => void;
  onOutcome: (record: CaseRecord, result: OutcomeResult) => void;
  onFollowupVerdict: (key: string, verdict: WindowVerdict) => void;
  onExport: (kind: 'json' | 'csv' | 'md') => void;
  onImport: (file: File) => void;
}) {
  const [art, setArt] = useState<ArtType | 'all'>('all');
  const [query, setQuery] = useState('');
  const today = localDateIso();
  const judged = cases.filter((record) => record.annotation.outcome && record.annotation.outcome.result !== '无法判断').length;
  const pending = cases.length - judged;
  const due = followups.filter((row) => row.verdict === '待观察' && row.date <= today).length;
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return cases.filter((record) => {
      if (art !== 'all' && record.artType !== art) return false;
      if (!keyword) return true;
      return [record.question.summary, record.question.category, artLabel(record.artType), ...record.tags]
        .some((value) => value.toLowerCase().includes(keyword));
    });
  }, [art, cases, query]);
  const insights = stats ? calibrate(cases, stats) : [];

  return (
    <>
      <section className="card case-center-head">
        <div className="section-heading">
          <div><h2>案例本 · 个人复盘</h2><p className="meta">本地持久化记录、事后回标与应期观察</p></div>
          <div className="case-actions">
            <button className="secondary small" type="button" onClick={() => onExport('json')}>导出 JSON</button>
            <button className="secondary small" type="button" onClick={() => onExport('csv')}>导出 CSV</button>
            <button className="secondary small" type="button" onClick={() => onExport('md')}>导出 Markdown</button>
            <label className="secondary small file-label">
              导入案例
              <input type="file" accept=".json,.xuan-case.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ''; }} />
            </label>
          </div>
        </div>
        <div className="case-summary-grid">
          <div><strong>{cases.length}</strong><span>全部案例</span></div>
          <div><strong>{judged}</strong><span>已回标</span></div>
          <div><strong>{pending}</strong><span>待复盘</span></div>
          <div className={due ? 'attention' : ''}><strong>{due}</strong><span>应期到期</span></div>
        </div>
        {statusMessage && <p className="ok">{statusMessage}</p>}
      </section>

      <section className="card case-browser">
        <div className="section-heading">
          <div><h2>案例记录</h2><p className="meta">当前显示 {filtered.length} / {cases.length} 条</p></div>
          <input className="case-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索问句、事项、术数或标签" aria-label="搜索案例" />
        </div>
        <div className="chips case-filters" aria-label="按术数筛选">
          <button type="button" className={`chip ${art === 'all' ? 'active' : ''}`} onClick={() => setArt('all')}>全部</button>
          {ART_TYPES.map((id) => <button type="button" key={id} className={`chip ${art === id ? 'active' : ''}`} onClick={() => setArt(id)}>{artLabel(id)}</button>)}
        </div>

        {filtered.length === 0 && <p className="meta case-empty">{cases.length ? '没有符合筛选条件的案例。' : '尚无案例，请先在占卜工作台完成排盘并存档。'}</p>}
        <div className="case-list">
          {filtered.map((record) => (
            <details className="case-entry" key={record.caseId}>
              <summary>
                <span className="case-art">{artLabel(record.artType)}</span>
                <span className="case-question">{record.question.summary || '未填问句'}</span>
                <span className="case-date">{record.createdAt.slice(0, 16).replace('T', ' ')}</span>
                <span className={record.annotation.outcome ? 'case-outcome resolved' : 'case-outcome'}>{record.annotation.outcome?.result ?? '待回标'}</span>
              </summary>
              <div className="case-entry-body">
                <dl className="case-facts">
                  <div><dt>事项</dt><dd>{record.question.category}</dd></div>
                  <div><dt>状态</dt><dd>{record.status}</dd></div>
                  <div><dt>规则</dt><dd>{record.result.ruleHits.length} 条</dd></div>
                  <div><dt>证据</dt><dd>{record.result.evidenceRefs.length} 条</dd></div>
                </dl>
                {record.result.ruleHits.length > 0 && (
                  <ul className="case-rules">{record.result.ruleHits.slice(0, 6).map((rule) => <li key={rule.ruleId}><span>{rule.ruleId}</span>{rule.text}</li>)}</ul>
                )}
                <div className="case-feedback">
                  <div className="followup-actions">
                    {OUTCOMES.map((outcome) => <button key={outcome} type="button" className="secondary small" onClick={() => onOutcome(record, outcome)}>{outcome}</button>)}
                  </div>
                  <input className="crossfill" value={notes[record.caseId] ?? ''} onChange={(event) => onNoteChange(record.caseId, event.target.value)} placeholder="回标备注" aria-label={`${record.question.summary}回标备注`} />
                </div>
                {record.annotation.outcome?.note && <p className="meta">上次备注：{record.annotation.outcome.note}</p>}
              </div>
            </details>
          ))}
        </div>
      </section>

      <FollowupPanel rows={followups} onVerdict={onFollowupVerdict} />

      <section className="card calibration-center">
        <div className="section-heading"><div><h2>校准汇总</h2><p className="meta">仅校准个人解释习惯，不回写排盘引擎</p></div><span className="timeline-count">{judged} 条有效样本</span></div>
        {!stats || insights.length === 0 ? <p className="meta">完成案例回标后，这里会按术数和事项显示样本提示。</p> : insights.map((insight) => (
          <div className="calibration-row" key={`${insight.dimension}.${insight.key}`}>
            <span>{insight.dimension === 'art' ? '术数' : '事项'}</span>
            <div><b>{insight.key}</b><p>{insight.message}</p></div>
            <strong>{insight.total ? `${Math.round(insight.hitRate * 100)}%` : '—'}</strong>
          </div>
        ))}
      </section>
    </>
  );
}
