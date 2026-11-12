'use client';

import { useState } from 'react';
import { STATUS_LABEL, VERDICT_LABEL } from '../../core';
import type { VerdictResult } from '../../core';

interface Explanation {
  summary: string;
  perCriterion: { id: string; comment: string }[];
  conditions: string[];
  nextActions: string[];
  disagreement: string | null;
  droppedForNumbers: number;
  droppedForClaims?: number;
}

const TONE = { go: 'green', conditional: 'yellow', avoid: 'red' } as const;

/** "보러 갈지" 기준표 결론(코드가 판정)과 선택적 AI 해석. 기준표는 그대로 공개한다 */
export function VerdictPanel({
  result,
  kind,
}: {
  result: VerdictResult;
  kind: 'jeonse' | 'monthly' | 'sale';
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [exp, setExp] = useState<Explanation | null>(null);

  const ask = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/verdict', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          verdict: result.verdict,
          criteria: result.criteria.map((c) => ({
            id: c.id,
            title: c.title,
            status: c.status,
            rule: c.rule,
            facts: c.facts,
          })),
        }),
      });
      const data = (await res.json()) as { explanation?: Explanation; error?: string };
      if (!res.ok || !data.explanation) setError(data.error ?? 'AI 해석에 실패했습니다.');
      else setExp(data.explanation);
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const comment = (id: string) => exp?.perCriterion.find((p) => p.id === id)?.comment;

  return (
    <section className="card" aria-labelledby="verdict-title">
      <h2 id="verdict-title">방문 전 결론 (기준표)</h2>
      <div className={`grade grade-${TONE[result.verdict]}`}>
        <div>
          <div className="grade-label">{VERDICT_LABEL[result.verdict]}</div>
          <div className="grade-headline">
            미달이 하나라도 있으면 방문을 권하지 않고, 주의·판단 불가가 있으면 확인 후 방문, 모두 충족이면
            방문 가능입니다. 안전을 보증하는 결론이 아닙니다.
          </div>
        </div>
      </div>
      <ul className="rules">
        {result.criteria.map((c) => (
          <li key={c.id} className="rule rule-none">
            <div className="rule-head">
              <h4>
                {c.id} {c.title}
              </h4>
              <span className="count">{STATUS_LABEL[c.status]}</span>
            </div>
            <p>{c.detail}</p>
            <p className="hint">기준: {c.rule}</p>
            {comment(c.id) && <p className="notice">AI: {comment(c.id)}</p>}
          </li>
        ))}
      </ul>

      {!exp && (
        <div className="actions">
          <button type="button" className="btn-secondary" onClick={ask} disabled={busy}>
            {busy ? 'AI 해석 중…' : 'AI 해석 요청'}
          </button>
        </div>
      )}
      <p className="hint">
        AI 해석을 누르면 계약 유형·결론·기준별 상태와 비율만 LLM 서버로 전송됩니다(자산·소득·가격·성명·지역은
        보내지 않음). AI는 결론을 바꾸지 못하고, 기준표에 없는 숫자가 든 문장은 버려집니다.
      </p>
      {error && (
        <p className="errors" role="alert">
          {error}
        </p>
      )}
      {exp && (
        <div>
          <h3>AI 해석</h3>
          {exp.summary && <p>{exp.summary}</p>}
          {exp.conditions.length > 0 && (
            <>
              <h4>방문 전 확인할 조건</h4>
              <ul className="evidence">
                {exp.conditions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
          {exp.nextActions.length > 0 && (
            <>
              <h4>다음 행동</h4>
              <ul className="evidence">
                {exp.nextActions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
          {exp.disagreement && (
            <p className="notice">
              <strong>AI 이견 (결론은 바뀌지 않음):</strong> {exp.disagreement}
            </p>
          )}
          {(exp.droppedForClaims ?? 0) > 0 && (
            <p className="hint">
              안전·승인을 단정하는 표현이 들어 있어 {exp.droppedForClaims}개 문장을 제외했습니다.
            </p>
          )}
          {exp.droppedForNumbers > 0 && (
            <p className="hint">
              기준표에 없는 숫자가 들어 있어 {exp.droppedForNumbers}개 문장을 제외했습니다.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
