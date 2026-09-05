import { useState, type FormEvent } from 'react';
import {
  baziHehunOf,
  computeBoneWeight,
  fortuneOf,
  qimenRelationshipOf,
  type BaziHehunResult,
  type BoneWeightResult,
  type DailyFortune,
  type FortuneBirth,
  type QimenRelationshipResult,
} from '@xuanshu/core';

type Tool = 'fortune' | 'boneweight' | 'hehun' | 'qimen';
type Birth = FortuneBirth & { minute: number };

const INITIAL_BIRTH: Birth = { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 'male' };
const INITIAL_PARTNER: Birth = { year: 1992, month: 8, day: 20, hour: 14, minute: 0, gender: 'female' };

function localIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function BirthEditor({
  id,
  title,
  value,
  onChange,
}: {
  id: string;
  title?: string;
  value: Birth;
  onChange: (value: Birth) => void;
}) {
  function setNumber(field: 'year' | 'month' | 'day' | 'hour' | 'minute', raw: string) {
    onChange({ ...value, [field]: Number(raw) });
  }

  return (
    <fieldset className="destiny-person">
      {title && <legend>{title}</legend>}
      <div className="destiny-birth-grid">
        <label className="birth-field" htmlFor={`${id}-year`}><span>公历年</span><input id={`${id}-year`} className="num" type="number" min="1900" max="2100" value={value.year} onChange={(event) => setNumber('year', event.target.value)} /></label>
        <label className="birth-field" htmlFor={`${id}-month`}><span>月</span><input id={`${id}-month`} className="num" type="number" min="1" max="12" value={value.month} onChange={(event) => setNumber('month', event.target.value)} /></label>
        <label className="birth-field" htmlFor={`${id}-day`}><span>日</span><input id={`${id}-day`} className="num" type="number" min="1" max="31" value={value.day} onChange={(event) => setNumber('day', event.target.value)} /></label>
        <label className="birth-field" htmlFor={`${id}-hour`}><span>时</span><input id={`${id}-hour`} className="num" type="number" min="0" max="23" value={value.hour} onChange={(event) => setNumber('hour', event.target.value)} /></label>
        <label className="birth-field" htmlFor={`${id}-minute`}><span>分</span><input id={`${id}-minute`} className="num" type="number" min="0" max="59" value={value.minute} onChange={(event) => setNumber('minute', event.target.value)} /></label>
        <div className="birth-field">
          <span>性别</span>
          <div className="gender-control" role="group" aria-label={`${title ?? '本人'}性别`}>
            {([['male', '男'], ['female', '女']] as const).map(([gender, label]) => (
              <button
                key={gender}
                type="button"
                className={value.gender === gender ? 'active' : ''}
                aria-pressed={value.gender === gender}
                onClick={() => onChange({ ...value, gender })}
              >{label}</button>
            ))}
          </div>
        </div>
      </div>
    </fieldset>
  );
}

function ResultError({ message }: { message: string }) {
  return message ? <p className="warn" role="alert">{message}</p> : null;
}

function FortuneResult({ result }: { result: DailyFortune }) {
  return (
    <section className="card destiny-result" aria-live="polite">
      <div className="section-heading">
        <div>
          <h2>{result.date} · 今日参考</h2>
          <p className="meta">命盘 {result.birthPillars} · 日主{result.dayMaster}{result.dayMasterElement} · 当日{result.dayPillar}{result.dayElement}</p>
        </div>
        <span className="day-god">{result.birthConstellation}</span>
      </div>
      <p className="plain-summary">{result.summary}</p>
      <div className="fortune-metrics">
        {result.metrics.map((metric) => (
          <article className="fortune-metric" key={metric.id} data-level={metric.level}>
            <div><b>{metric.label}</b><strong>{metric.score}</strong></div>
            <span>{metric.level}</span>
            <p>{metric.text}</p>
            <details><summary>评分依据</summary><ul>{metric.basis.map((basis) => <li key={basis}>{basis}</li>)}</ul></details>
          </article>
        ))}
      </div>
      <dl className="facts-grid">
        <div><dt>参考五行</dt><dd>{result.favorableElements.join('、')}</dd></div>
        <div><dt>参考色彩</dt><dd>{result.luckyColors.join('、')}</dd></div>
        <div><dt>参考数字</dt><dd>{result.luckyNumbers.join('、')}</dd></div>
        <div><dt>参考方位</dt><dd>{result.favorableDirections.join('、')}</dd></div>
      </dl>
      <div className="destiny-notes">
        <div><b>提示</b><ul>{result.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></div>
        <div><b>留意</b><ul>{result.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul></div>
      </div>
      <p className="meta">{result.disclaimer}</p>
    </section>
  );
}

function BoneWeightResultView({ result }: { result: BoneWeightResult }) {
  return (
    <section className="card destiny-result" aria-live="polite">
      <div className="section-heading">
        <div><h2>称骨结果 · {result.label}</h2><p className="meta">{result.yearGanzhi}年 · 农历{result.lunarDate} · {result.hourBranch}时</p></div>
        <span className="day-god">{result.totalLiang.toFixed(1)} 两</span>
      </div>
      <dl className="bone-parts">
        {result.parts.map((part) => <div key={part.name}><dt>{part.name}</dt><dd>{part.label}</dd></div>)}
      </dl>
      <blockquote className="bone-poem">{result.poem}</blockquote>
      <p className="plain-summary">{result.plain}</p>
      <p className="meta">{result.disclaimer}</p>
    </section>
  );
}

function HehunResultView({ result }: { result: BaziHehunResult }) {
  return (
    <section className="card destiny-result" aria-live="polite">
      <div className="section-heading">
        <div><h2>双人合盘 · 七维分析</h2><p className="meta">甲方 {result.pair.first}<br />乙方 {result.pair.second}</p></div>
        <span className="compatibility-score">{result.score}<small>/ 90</small></span>
      </div>
      <p className="plain-summary">{result.summary}</p>
      <div className="compatibility-list">
        {result.items.map((item) => (
          <article key={item.id} data-verdict={item.verdict}>
            <div><b>{item.label}</b><span>{item.verdict} · {item.scoreEffect > 0 ? '+' : ''}{item.scoreEffect}</span></div>
            <p>{item.detail}</p>
            <small>{item.explanation}</small>
          </article>
        ))}
      </div>
      <div className="destiny-notes">
        <div><b>相合项</b><ul>{result.strengths.length ? result.strengths.map((item) => <li key={item}>{item}</li>) : <li>当前规则未形成明显加分项</li>}</ul></div>
        <div><b>留意项</b><ul>{result.cautions.length ? result.cautions.map((item) => <li key={item}>{item}</li>) : <li>当前规则未检出明显冲害</li>}</ul></div>
      </div>
      <p className="meta">{result.disclaimer}</p>
    </section>
  );
}

function QimenRelationshipResultView({ result }: { result: QimenRelationshipResult }) {
  return (
    <section className="card destiny-result" aria-live="polite">
      <div className="section-heading">
        <div><h2>奇门关系 · 五维分析</h2><p className="meta">{result.chartSummary}</p></div>
        <span className="compatibility-score">{result.score}<small>/ 90</small></span>
      </div>
      <p className="plain-summary">{result.summary}</p>
      <div className="compatibility-list">
        {result.items.map((item) => (
          <article key={item.id} data-verdict={item.verdict}>
            <div><b>{item.label}</b><span>{item.verdict} · {item.scoreEffect > 0 ? '+' : ''}{item.scoreEffect}</span></div>
            <p>{item.detail}</p>
            <small>{item.explanation}</small>
            <details><summary>盘面依据（{item.basis.length} 项）</summary><ul>{item.basis.map((basis) => <li key={basis}>{basis}</li>)}</ul></details>
          </article>
        ))}
      </div>
      <p className="meta">{result.disclaimer}</p>
    </section>
  );
}

export function DestinyToolsView() {
  const now = new Date();
  const [tool, setTool] = useState<Tool>('fortune');
  const [birth, setBirth] = useState<Birth>(INITIAL_BIRTH);
  const [partner, setPartner] = useState<Birth>(INITIAL_PARTNER);
  const [targetDate, setTargetDate] = useState(localIso(new Date()));
  const [qimenDate, setQimenDate] = useState(localIso(now));
  const [qimenTime, setQimenTime] = useState(localTime(now));
  const [fortune, setFortune] = useState<DailyFortune | null>(null);
  const [boneWeight, setBoneWeight] = useState<BoneWeightResult | null>(null);
  const [hehun, setHehun] = useState<BaziHehunResult | null>(null);
  const [qimen, setQimen] = useState<QimenRelationshipResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function selectTool(next: Tool) {
    setTool(next);
    setError('');
  }

  async function runFortune(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const [year, month, day] = targetDate.split('-').map(Number);
      if (!year || !month || !day) throw new Error('请选择有效的参考日期');
      setFortune(await fortuneOf(birth, year, month, day));
    } catch (cause) {
      setFortune(null);
      setError((cause as Error).message || '今日参考计算失败');
    } finally {
      setBusy(false);
    }
  }

  function runBoneWeight(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      setBoneWeight(computeBoneWeight(birth.year, birth.month, birth.day, birth.hour, birth.minute));
    } catch (cause) {
      setBoneWeight(null);
      setError((cause as Error).message || '称骨计算失败');
    }
  }

  async function runHehun(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setHehun(await baziHehunOf(birth, partner));
    } catch (cause) {
      setHehun(null);
      setError((cause as Error).message || '双人合盘计算失败');
    } finally {
      setBusy(false);
    }
  }

  async function runQimen(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const [year, month, day] = qimenDate.split('-').map(Number);
      const [hour, minute] = qimenTime.split(':').map(Number);
      if (!year || !month || !day || hour === undefined || minute === undefined) throw new Error('请选择有效的问事日期和时间');
      setQimen(await qimenRelationshipOf({ year, month, day, hour, minute }));
    } catch (cause) {
      setQimen(null);
      setError((cause as Error).message || '奇门关系分析失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="card destiny-tools">
        <div className="section-heading">
          <div><h2>命理工具</h2><p className="meta">规则透明、结果可复核的传统文化参考</p></div>
          <div className="chips destiny-tabs" role="tablist" aria-label="命理工具">
            {([['fortune', '今日参考'], ['boneweight', '称骨'], ['hehun', '双人合盘'], ['qimen', '奇门关系']] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tool === id} className={`chip ${tool === id ? 'active' : ''}`} onClick={() => selectTool(id)}>{label}</button>
            ))}
          </div>
        </div>

        {tool === 'fortune' && (
          <form onSubmit={runFortune}>
            <BirthEditor id="fortune-birth" value={birth} onChange={setBirth} />
            <div className="destiny-action-row">
              <label className="birth-field" htmlFor="fortune-date"><span>参考日期</span><input id="fortune-date" className="num" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>
              <button className="primary" type="submit" disabled={busy}>{busy ? '计算中…' : '生成今日参考'}</button>
            </div>
          </form>
        )}

        {tool === 'boneweight' && (
          <form onSubmit={runBoneWeight}>
            <BirthEditor id="bone-birth" value={birth} onChange={setBirth} />
            <button className="primary" type="submit">计算骨重</button>
          </form>
        )}

        {tool === 'hehun' && (
          <form onSubmit={runHehun}>
            <div className="compatibility-people">
              <BirthEditor id="hehun-first" title="甲方" value={birth} onChange={setBirth} />
              <BirthEditor id="hehun-second" title="乙方" value={partner} onChange={setPartner} />
            </div>
            <button className="primary" type="submit" disabled={busy}>{busy ? '分析中…' : '生成七维合盘'}</button>
          </form>
        )}

        {tool === 'qimen' && (
          <form onSubmit={runQimen}>
            <div className="qimen-moment-row">
              <label className="birth-field" htmlFor="qimen-date"><span>问事日期</span><input id="qimen-date" className="num" type="date" value={qimenDate} onChange={(event) => setQimenDate(event.target.value)} /></label>
              <label className="birth-field" htmlFor="qimen-time"><span>问事时间</span><input id="qimen-time" className="num" type="time" value={qimenTime} onChange={(event) => setQimenTime(event.target.value)} /></label>
              <button className="primary" type="submit" disabled={busy}>{busy ? '起局分析中…' : '生成奇门关系盘'}</button>
            </div>
          </form>
        )}
        <ResultError message={error} />
      </section>

      {tool === 'fortune' && fortune && <FortuneResult result={fortune} />}
      {tool === 'boneweight' && boneWeight && <BoneWeightResultView result={boneWeight} />}
      {tool === 'hehun' && hehun && <HehunResultView result={hehun} />}
      {tool === 'qimen' && qimen && <QimenRelationshipResultView result={qimen} />}
    </>
  );
}
