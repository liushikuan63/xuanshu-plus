import { useMemo, useState } from 'react';
import { artLabel, type Playbook } from '@xuanshu/core';
import { ALL_PLAYBOOKS } from '@xuanshu/intake';
import { normalizeSearchText } from '@xuanshu/knowledge/normalize';

interface PlaybookCenterViewProps {
  onUse(playbook: Playbook): void;
  onRead(canonicalId: string, book: string, query?: string): void;
}

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  who: '涉及谁',
  what: '具体事项',
  timeRange: '时间范围',
  options: '备选方案',
  location: '地点',
  needTiming: '是否需要应期',
};

function citationQuery(quote: string): string {
  return quote.match(/\p{Script=Han}{2,12}/u)?.[0] ?? [...quote].slice(0, 8).join('');
}

function searchText(playbook: Playbook): string {
  return [
    playbook.category,
    playbook.subCategory,
    artLabel(playbook.arts.primary),
    playbook.arts.whyPrimary,
    ...playbook.howToAsk.goodExamples,
    ...playbook.yongShen.flatMap((row) => [row.condition, row.yongShen]),
    ...playbook.signals.map((row) => row.name),
    ...playbook.readingList.flatMap((row) => [row.book, row.chapter]),
  ].filter(Boolean).join(' ');
}

export function PlaybookCenterView({ onUse, onRead }: PlaybookCenterViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [art, setArt] = useState('全部');
  const arts = useMemo(
    () => ['全部', ...new Set(ALL_PLAYBOOKS.map((playbook) => playbook.arts.primary).map(artLabel))],
    [],
  );
  const filtered = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query.trim());
    return ALL_PLAYBOOKS.filter((playbook) => {
      if (art !== '全部' && artLabel(playbook.arts.primary) !== art) return false;
      return !normalizedQuery || normalizeSearchText(searchText(playbook)).includes(normalizedQuery);
    });
  }, [art, query]);
  const selected = ALL_PLAYBOOKS.find((playbook) => playbook.id === selectedId);

  if (!selected) {
    return (
      <section className="playbook-center" aria-labelledby="playbook-center-title">
        <div className="section-heading">
          <div>
            <h2 id="playbook-center-title">断事路径卡</h2>
            <p className="meta">共 {ALL_PLAYBOOKS.length} 张，当前显示 {filtered.length} 张</p>
          </div>
          <input
            className="case-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索事项、术数、用神或典籍"
            aria-label="搜索路径卡"
          />
        </div>
        <div className="chips playbook-filters" role="group" aria-label="按主用术数筛选">
          {arts.map((name) => (
            <button
              key={name}
              className={`chip ${art === name ? 'active' : ''}`}
              aria-pressed={art === name}
              onClick={() => setArt(name)}
            >
              {name}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="meta playbook-empty">没有匹配的路径卡。</p>
        ) : (
          <div className="playbook-card-grid">
            {filtered.map((playbook) => (
              <button
                key={playbook.id}
                className="playbook-card"
                onClick={() => setSelectedId(playbook.id)}
                aria-label={`打开${playbook.category}${playbook.subCategory ? `·${playbook.subCategory}` : ''}路径卡`}
              >
                <span className="playbook-card-title">
                  {playbook.category}{playbook.subCategory ? ` · ${playbook.subCategory}` : ''}
                </span>
                <span className="playbook-art">{artLabel(playbook.arts.primary)}</span>
                <span className="playbook-card-summary">{playbook.arts.whyPrimary}</span>
                <span className="playbook-card-meta">
                  {playbook.signals.length} 条信号 · {playbook.readingList.length} 项书目 · v{playbook.version}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="playbook-center playbook-detail" aria-labelledby="playbook-detail-title">
      <div className="playbook-detail-head">
        <div>
          <button className="secondary small" onClick={() => setSelectedId(null)}>返回全部路径卡</button>
          <h2 id="playbook-detail-title">
            {selected.category}{selected.subCategory ? ` · ${selected.subCategory}` : ''}
          </h2>
          <p className="meta">{artLabel(selected.arts.primary)} · 路径卡 v{selected.version}</p>
        </div>
        <button className="primary" onClick={() => onUse(selected)}>带入占卜工作台</button>
      </div>

      <ol className="playbook-steps">
        <li className="playbook-step">
          <span className="playbook-step-number">1</span>
          <div>
            <h3>术数选择</h3>
            <p><b>主用：{artLabel(selected.arts.primary)}</b>。{selected.arts.whyPrimary}</p>
            {selected.arts.alternates.length > 0 && (
              <ul>
                {selected.arts.alternates.map((row) => (
                  <li key={row.art}><b>{artLabel(row.art)}</b>：{row.reason}</li>
                ))}
              </ul>
            )}
          </div>
        </li>

        <li className="playbook-step">
          <span className="playbook-step-number">2</span>
          <div>
            <h3>怎么问</h3>
            <div className="playbook-example-grid">
              <div>
                <b>可核验问法</b>
                <ul>{selected.howToAsk.goodExamples.map((text) => <li key={text}>{text}</li>)}</ul>
              </div>
              <div>
                <b>需要改写</b>
                <ul>{selected.howToAsk.badExamples.map((row) => <li key={row.text}>{row.text}：{row.why}</li>)}</ul>
              </div>
            </div>
            <p className="meta">
              必填：{selected.howToAsk.requiredFields.map((field) => REQUIRED_FIELD_LABELS[field] ?? field).join('、')}
            </p>
            {selected.howToAsk.clarify.map((row) => <p key={row.id}>{row.text}</p>)}
          </div>
        </li>

        <li className="playbook-step">
          <span className="playbook-step-number">3</span>
          <div>
            <h3>怎么起</h3>
            {selected.howToCast.methods.map((method) => (
              <div key={method.name} className="playbook-method">
                <b>{method.name}</b>
                <ol>{method.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              </div>
            ))}
            <ul>{selected.howToCast.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
          </div>
        </li>

        <li className="playbook-step">
          <span className="playbook-step-number">4</span>
          <div>
            <h3>取用神</h3>
            <div className="playbook-rule-list">
              {selected.yongShen.map((row) => (
                <article key={row.ruleId}>
                  <div><b>{row.yongShen}</b><span>{row.confidenceLevel} 级</span></div>
                  <p>{row.condition}</p>
                  <small>{row.ruleId}</small>
                  <div className="playbook-citations">
                    {row.citations.map((citation) => (
                      <button
                        key={citation.segId}
                        onClick={() => onRead(citation.canonicalId, citation.book, citationQuery(citation.quote))}
                      >
                        《{citation.book}》{citation.chapter}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </li>

        <li className="playbook-step">
          <span className="playbook-step-number">5</span>
          <div>
            <h3>看什么信号</h3>
            <div className="playbook-rule-list">
              {selected.signals.map((signal) => (
                <article key={signal.ruleId} data-meaning={signal.meaning}>
                  <div><b>{signal.name}</b><span>{signal.meaning} · {signal.confidenceLevel} 级</span></div>
                  <small>{signal.ruleId}</small>
                  <div className="playbook-citations">
                    {signal.citations.map((citation) => (
                      <button
                        key={citation.segId}
                        onClick={() => onRead(citation.canonicalId, citation.book, citationQuery(citation.quote))}
                      >
                        《{citation.book}》{citation.chapter}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </li>

        <li className="playbook-step">
          <span className="playbook-step-number">6</span>
          <div>
            <h3>定方位与取象</h3>
            {!selected.locating ? <p className="meta">本路径不使用方位取象。</p> : (
              <>
                {selected.locating.byGuaGong && <p>{selected.locating.byGuaGong}</p>}
                {selected.locating.byYaoWei && (
                  <dl className="playbook-location-grid">
                    {Object.entries(selected.locating.byYaoWei).map(([key, value]) => (
                      <div key={key}><dt>第 {key} 爻</dt><dd>{value}</dd></div>
                    ))}
                  </dl>
                )}
                {selected.locating.byDiZhi && (
                  <p>{Object.entries(selected.locating.byDiZhi).map(([key, value]) => `${key}：${value.dir}（${value.places.join('、')}）`).join('；')}</p>
                )}
                {selected.locating.byLiuShen && (
                  <p>{Object.entries(selected.locating.byLiuShen).map(([key, value]) => `${key}：${value}`).join('；')}</p>
                )}
                <small>{selected.locating.ruleId} · {selected.locating.confidenceLevel} 级</small>
              </>
            )}
          </div>
        </li>

        <li className="playbook-step">
          <span className="playbook-step-number">7</span>
          <div>
            <h3>断应期</h3>
            <ul>
              {selected.timing.rules.map((rule) => (
                <li key={rule.ruleId}>
                  {rule.name} <small>{rule.ruleId} · {rule.confidenceLevel} 级</small>
                </li>
              ))}
            </ul>
            <p className="meta">{selected.timing.fallback}</p>
          </div>
        </li>

        <li className="playbook-step">
          <span className="playbook-step-number">8</span>
          <div>
            <h3>读哪本书</h3>
            <div className="playbook-reading-list">
              {selected.readingList.map((row) => (
                <button key={`${row.canonicalId}:${row.chapter}`} onClick={() => onRead(row.canonicalId, row.book)}>
                  <b>《{row.book}》{row.chapter}</b>
                  <span>{row.why}</span>
                  <small>优先级 P{row.priority}</small>
                </button>
              ))}
            </div>
          </div>
        </li>

        <li className="playbook-step">
          <span className="playbook-step-number">9</span>
          <div>
            <h3>怎么记</h3>
            <dl className="playbook-record-grid">
              {selected.recordTemplate.fields.map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>{field.type === 'enum' ? field.options?.join(' / ') : field.type}</dd>
                </div>
              ))}
            </dl>
            <p>{selected.recordTemplate.hint}</p>
          </div>
        </li>
      </ol>

      <div className="playbook-boundary">
        <b>禁止事项</b>
        <ul>{selected.forbidden.map((rule) => <li key={rule}>{rule}</li>)}</ul>
        <p>{selected.disclaimer}</p>
      </div>
    </section>
  );
}
