import { localDateIso, type WindowFollowup, type WindowVerdict } from '@xuanshu/ledger';

const VERDICTS: Exclude<WindowVerdict, '待观察'>[] = ['应验', '部分应验', '未应验', '无法判断'];

export function FollowupPanel({ rows, onVerdict }: {
  rows: WindowFollowup[];
  onVerdict: (key: string, verdict: WindowVerdict) => void;
}) {
  const today = localDateIso();
  const pending = rows.filter((row) => row.verdict === '待观察');
  const due = pending.filter((row) => row.date <= today);
  const upcoming = pending.filter((row) => row.date > today).slice(0, 12);
  const settled = rows.filter((row) => row.verdict !== '待观察').slice(-12).reverse();

  return (
    <section className="card">
      <div className="section-heading">
        <div><h2>应期回收</h2><p className="meta">到期未判不会被算作未应验，反馈只进入个人复盘。</p></div>
        <span className={due.length ? 'due-count' : 'timeline-count'}>{due.length} 条到期</span>
      </div>
      {rows.length === 0 && <p className="meta">存档带日期时间轴的六爻或奇门案例后，这里会出现观察窗口。</p>}
      {[...due, ...upcoming].map((row) => (
        <div className="followup-row" key={row.key}>
          <div><b>{row.date} · {row.label}</b><span className="meta">{row.date <= today ? '已到期' : '待观察'} · {row.ruleId}</span></div>
          <div className="followup-actions">
            {VERDICTS.map((verdict) => <button key={verdict} type="button" className="secondary small" onClick={() => onVerdict(row.key, verdict)}>{verdict}</button>)}
          </div>
        </div>
      ))}
      {settled.length > 0 && (
        <details>
          <summary>最近已回标 {settled.length} 条</summary>
          <ul className="cases">{settled.map((row) => <li key={row.key}>{row.date} · {row.label} · <b>{row.verdict}</b></li>)}</ul>
        </details>
      )}
    </section>
  );
}
