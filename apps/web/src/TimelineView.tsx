import type { Timeline } from '@xuanshu/core';

export function TimelineView({ timeline }: { timeline: Timeline }) {
  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>{timeline.title}</h2>
          <p className="meta">从 {timeline.from}（{timeline.fromGanzhi}日）起，观察 {timeline.horizonDays} 天</p>
        </div>
        <span className="timeline-count">{timeline.entries.length} 个窗口</span>
      </div>
      {timeline.entries.length === 0 ? <p className="meta">当前盘面没有足够依据生成具体日期。</p> : (
        <ol className="timeline-list">
          {timeline.entries.map((entry) => (
            <li key={`${entry.date}-${entry.ruleId}-${entry.label}`} data-tone={entry.tone}>
              <time dateTime={entry.date}>{entry.date}<small>{entry.ganzhi} · +{entry.offsetDays}天</small></time>
              <div>
                <b>{entry.label}</b>
                <p>{entry.plain}</p>
                <details><summary>推算依据</summary><span className="meta">{entry.basis.join('；')} · {entry.ruleId}</span></details>
              </div>
            </li>
          ))}
        </ol>
      )}
      <details className="timeline-notes">
        <summary>口径与限制</summary>
        <p>{timeline.method}</p>
        <ul>{timeline.caveats.map((text) => <li key={text}>{text}</li>)}</ul>
      </details>
    </section>
  );
}
