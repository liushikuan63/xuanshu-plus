import { useMemo } from 'react';
import { baziJingPi, type BaziChart, type JingPiEvidenceLevel } from '@xuanshu/core';

const EVIDENCE_LABEL: Record<JingPiEvidenceLevel, string> = {
  C: '规则整理',
  D: '流派参考',
};

export function BaziJingPiView({ chart }: { chart: BaziChart }) {
  const result = useMemo(() => baziJingPi(chart), [chart]);

  return (
    <section className="card jingpi-result">
      <div className="section-heading">
        <div>
          <h2>{result.headline}</h2>
          <p className="meta">四柱 {result.pillars} · 扶抑参考 {result.favorableElements.join('、')}</p>
        </div>
        <span className="day-god">六层解读</span>
      </div>

      <div className="jingpi-sections">
        {result.sections.map((section) => (
          <article className="jingpi-section" key={section.id}>
            <div className="jingpi-title">
              <h3>{section.title}</h3>
              <span data-level={section.evidenceLevel}>{section.evidenceLevel} · {EVIDENCE_LABEL[section.evidenceLevel]}</span>
            </div>
            <p>{section.summary}</p>
            <ul>{section.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
            <details>
              <summary>计算依据（{section.basis.length} 项）</summary>
              <ul>{section.basis.map((basis) => <li key={basis}>{basis}</li>)}</ul>
            </details>
          </article>
        ))}
      </div>

      <div className="jingpi-review">
        <b>复核要点</b>
        <ul>{result.reviewTips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
      </div>
      <p className="meta">{result.disclaimer}</p>
    </section>
  );
}
