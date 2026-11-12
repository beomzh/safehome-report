import type { Check, Recommendation, RecommendStatus } from '../../core';
import { LOAN_ELIGIBILITY } from '../loanEligibility';
import { daysSince, STALE_AFTER_DAYS } from '../loanRates';
import { LOAN_PRODUCTS } from '../loans';

const STATUS_LABEL: Record<RecommendStatus, string> = {
  likely: '해당 가능',
  check: '확인 필요',
  unlikely: '해당 안 됨',
};
const MARK: Record<Check['result'], string> = { ok: '✓', fail: '✗', unknown: '?' };

const nameOf = (id: string) => LOAN_PRODUCTS.find((p) => p.id === id)?.name ?? id;
const sourceOf = (id: string) => LOAN_ELIGIBILITY.products.find((p) => p.productId === id)?.source;

function RecItem({ rec, today }: { rec: Recommendation; today: string }) {
  const src = sourceOf(rec.productId);
  const stale = src ? daysSince(src.checkedAt, today) > STALE_AFTER_DAYS : false;
  return (
    <li className="rule rule-none">
      <div className="rule-head">
        <h4>{nameOf(rec.productId)}</h4>
        <span className="count">{STATUS_LABEL[rec.status]}</span>
      </div>
      {rec.rate && rec.status !== 'unlikely' && (
        <p>
          <strong>
            기본금리 연{' '}
            {rec.rate.minPercent === rec.rate.maxPercent
              ? `${rec.rate.minPercent}%`
              : `${rec.rate.minPercent}~${rec.rate.maxPercent}%`}
          </strong>{' '}
          <span className="muted">
            {rec.rate.basis === 'grid'
              ? '(공식 금리표에서 내 소득·금액 구간으로 고른 값, 우대·지방 인하 전)'
              : '(소득을 입력하면 구간별 금리를 보여줍니다 — 지금은 상품 전체 범위)'}
          </span>
        </p>
      )}
      <ul className="evidence">
        {rec.checks.map((c) => (
          <li key={c.label}>
            <strong aria-label={c.result}>{MARK[c.result]}</strong> {c.label}: {c.detail}
          </li>
        ))}
      </ul>
      {src && (
        <p className="hint">
          요건 출처:{' '}
          <a href={src.url} target="_blank" rel="noopener noreferrer">
            {src.name}
          </a>{' '}
          (확인 {src.checkedAt}
          {stale ? ` — ${daysSince(src.checkedAt, today)}일이 지났으니 공식 페이지에서 다시 확인하세요` : ''})
        </p>
      )}
    </li>
  );
}

/** 입력한 소득·가구 정보로 본 정책 대출 후보. 참고용이며 심사는 수탁은행이 한다 */
export function LoanRecommendations({ recs, today }: { recs: Recommendation[]; today: string }) {
  const groups: RecommendStatus[] = ['likely', 'check', 'unlikely'];
  return (
    <section className="card" aria-labelledby="loan-reco-title">
      <h2 id="loan-reco-title">내 상황에 맞는 정책 대출 후보</h2>
      <p className="hint">
        주택도시기금 공식 안내의 대출대상·대상주택 요건에 입력하신 값을 맞춰 본 결과입니다. 순자산 기준은
        통계청 발표에 따라 해마다 바뀌고, 실제 대출 가능 여부와 금리·한도는 수탁은행 심사로 정해집니다.
        입력하지 않은 항목은 "확인 필요"로 둡니다.
      </p>
      {recs.length === 0 && <p className="muted">이 계약 유형에 맞는 정책 대출 정보가 없습니다.</p>}
      {groups.map((g) => {
        const list = recs.filter((r) => r.status === g);
        if (list.length === 0) return null;
        return (
          <div key={g}>
            <h3>
              {STATUS_LABEL[g]} <span className="count">{list.length}</span>
            </h3>
            <ul className="rules">
              {list.map((r) => (
                <RecItem key={r.productId} rec={r} today={today} />
              ))}
            </ul>
          </div>
        );
      })}
      <p className="hint">
        시중은행 전세·주택담보대출과 보금자리론은 소득·신용·보증기관 심사에 따라 달라 이 목록에 넣지
        않았습니다(위 "대출 안내" 시트 참고).
      </p>
    </section>
  );
}
