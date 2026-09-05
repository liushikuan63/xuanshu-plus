import { useMemo, useState } from 'react';
import { almanacMonth, almanacOf, almanacSummary } from '@xuanshu/core/almanac';

function localIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function AlmanacView() {
  const now = new Date();
  const today = localIso(now);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(today);
  const days = useMemo(() => almanacMonth(year, month), [year, month]);
  const selected = useMemo(() => {
    const inMonth = days.find((day) => day.date === selectedDate);
    return inMonth ?? days[0]!;
  }, [days, selectedDate]);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  function moveMonth(delta: number) {
    const target = new Date(Date.UTC(year, month - 1 + delta, 1));
    const nextYear = target.getUTCFullYear();
    const nextMonth = target.getUTCMonth() + 1;
    setYear(nextYear);
    setMonth(nextMonth);
    setSelectedDate(almanacOf(nextYear, nextMonth, 1).date);
  }

  function backToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDate(today);
  }

  return (
    <>
      <section className="card almanac-shell">
        <div className="section-heading">
          <h2>万年历与黄历</h2>
          <div className="calendar-nav">
            <button className="icon-button" type="button" aria-label="上一月" title="上一月" onClick={() => moveMonth(-1)}>‹</button>
            <strong aria-live="polite">{year} 年 {month} 月</strong>
            <button className="icon-button" type="button" aria-label="下一月" title="下一月" onClick={() => moveMonth(1)}>›</button>
            <button className="secondary small" type="button" onClick={backToday}>今天</button>
          </div>
        </div>
        <div className="calendar-week" aria-hidden="true">
          {['日', '一', '二', '三', '四', '五', '六'].map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="calendar-grid" role="grid" aria-label={`${year}年${month}月`}>
          {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} className="calendar-blank" />)}
          {days.map((day, index) => {
            const selectedNow = day.date === selected.date;
            return (
              <button
                key={day.date}
                type="button"
                role="gridcell"
                aria-selected={selectedNow}
                className={`calendar-day${selectedNow ? ' selected' : ''}${day.date === today ? ' today' : ''}`}
                onClick={() => setSelectedDate(day.date)}
              >
                <span className="calendar-number">{index + 1}</span>
                <span className="calendar-lunar">{day.solarTerm || day.festivals[0] || day.lunarDate.replace(/^.*月/, '')}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card almanac-detail" aria-live="polite">
        <div className="section-heading">
          <div>
            <h2>{selected.date} · {selected.week}</h2>
            <p className="meta">{selected.lunarText} · {selected.yearGanzhi}年 {selected.monthGanzhi}月 {selected.dayGanzhi}日 · 属{selected.zodiac} · {selected.constellation}</p>
          </div>
          <span className="day-god">{selected.jianChu}日 · {selected.dayGod}</span>
        </div>
        <p className="plain-summary">{almanacSummary(selected)}</p>
        <div className="almanac-columns">
          <div className="almanac-list good"><b>宜</b><span>{selected.yi.join('、') || '无特别宜事'}</span></div>
          <div className="almanac-list avoid"><b>忌</b><span>{selected.ji.join('、') || '无特别忌事'}</span></div>
        </div>
        <dl className="facts-grid">
          <div><dt>冲煞</dt><dd>{selected.clash || '无'}{selected.sha ? ` · 煞${selected.sha}` : ''}</dd></div>
          <div><dt>吉神</dt><dd>{selected.luckyGods.join('、') || '未载'}</dd></div>
          <div><dt>凶煞</dt><dd>{selected.unluckyGods.join('、') || '未载'}</dd></div>
          <div><dt>彭祖百忌</dt><dd>{selected.pengZu.join('；') || '未载'}</dd></div>
          <div><dt>节气物候</dt><dd>{[selected.solarTerm, selected.wuHou, selected.hou].filter(Boolean).join(' · ') || '平候'}</dd></div>
          <div><dt>节日</dt><dd>{selected.festivals.join('、') || '无'}</dd></div>
        </dl>
        <p className="meta">黄历内容属于传统民俗文化参考，不构成医疗、法律或投资建议。</p>
      </section>
    </>
  );
}
