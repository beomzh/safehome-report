import type { RiskInput, RiskReport, RuleResult } from '../../core';
import { gradeInfo, groupResults } from '../present';
import { hasProvisionalThresholds } from '../rulesConfig';

function RuleCard({ r }: { r: RuleResult }) {
  const tone = r.status === 'triggered' ? r.severity : r.status === 'unknown' ? 'gray' : 'none';
  return (
    <li className={`rule rule-${tone}`}>
      <div className="rule-head">
        <span className="rule-id">{r.ruleId}</span>
        <h4>{r.title}</h4>
      </div>
      <ul className="evidence">
        {r.evidence.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      {r.action && <p className="action">→ {r.action}</p>}
    </li>
  );
}

function Section({ title, items, open }: { title: string; items: RuleResult[]; open?: boolean }) {
  if (items.length === 0) return null;
  return (
    <details className="rule-section" open={open}>
      <summary>
        {title} <span className="count">{items.length}</span>
      </summary>
      <ul className="rules">
        {items.map((r) => (
          <RuleCard key={r.ruleId} r={r} />
        ))}
      </ul>
    </details>
  );
}

export function ReportView({ report, input }: { report: RiskReport; input: RiskInput }) {
  const info = gradeInfo(report.grade);
  const groups = groupResults(report.results);
  const mode = input.registry ? '전체 분석 (등기부 정보 포함)' : '사전 점검 (등기부 정보 없음)';

  return (
    <section className="card report" aria-labelledby="report-title" aria-live="polite">
      <h2 id="report-title">분석 결과</h2>

      <div className={`grade grade-${info.tone}`}>
        <span className="grade-icon" aria-hidden="true">
          {info.icon}
        </span>
        <div>
          <div className="grade-label">{info.label}</div>
          <div className="grade-headline">{info.headline}</div>
        </div>
      </div>
      <p className="guidance">{info.guidance}</p>

      {!input.registry && (
        <p className="notice">
          등기부 정보가 없어 소유자·신탁·압류·근저당 등 권리분석을 하지 못했습니다. 등기사항전부증명서를
          발급받아 “3. 등기부 정보”에 입력하면 전체 분석이 가능합니다.
        </p>
      )}
      {hasProvisionalThresholds && (
        <p className="notice subtle">
          일부 판정 기준(예: 담보 비율 70%/80%)은 아직 공식 자료로 검증되지 않은 잠정값입니다.
        </p>
      )}

      <Section title="위험 신호" items={groups.risks} open />
      <Section title="판단 보류" items={groups.pending} open />
      <Section title="참고 정보" items={groups.info} />
      <Section title="이상 없음" items={groups.clear} />

      <footer className="report-meta muted">
        {mode} · 기준일 {report.asOf} · 룰셋 v{report.rulesetVersion}
      </footer>
    </section>
  );
}
