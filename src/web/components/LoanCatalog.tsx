import type { Grade } from '../../core';
import type { Kind } from '../form';
import { todayIso } from '../form';
import { loansFor, OFFICIAL_SOURCES } from '../loans';
import { rateInfoFor } from '../loanRates';
import { RateBlock } from './RateBlock';

const KIND_TITLE: Record<Kind, string> = { jeonse: '전세', monthly: '월세', sale: '매매' };

/** 계약 유형에 맞는 대출 종류, 확인 포인트, 공식 안내 금리(출처·확인일 표시) */
export function LoanCatalog({ kind, grade }: { kind: Kind; grade: Grade }) {
  const products = loansFor(kind);
  const today = todayIso();
  return (
    <section className="card" aria-labelledby="loan-title">
      <h2 id="loan-title">이용할 수 있는 대출 종류 ({KIND_TITLE[kind]})</h2>
      {(grade === 'red' || grade === 'yellow') && kind !== 'sale' && (
        <p className="notice">
          이 매물은 위험 신호가 있어 전세대출 <strong>보증이 거절되거나 한도가 줄 수 있습니다</strong>
          (보증기관 심사 기준에 따름). 계약 전에 보증 가능 여부를 먼저 확인하세요.
        </p>
      )}
      <ul className="rules">
        {products.map((p) => (
          <li key={p.id} className="rule rule-none">
            <div className="rule-head">
              <h4>{p.name}</h4>
            </div>
            <p className="hint">{p.provider}</p>
            <p>{p.summary}</p>
            <ul className="evidence">
              {p.checkpoints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <RateBlock info={rateInfoFor(p.id)} today={today} />
          </li>
        ))}
      </ul>
      <p className="notice subtle">
        금리는 위에 적은 확인일 기준으로 공식 사이트 안내를 옮긴 것이며 수시로 바뀝니다. 한도·소득/자산 기준은
        상품마다 달라 여기서 다루지 않습니다. 자격과 조건, 실제 적용 금리는 반드시 공식 안내(
        {OFFICIAL_SOURCES.join(', ')})와 취급 기관에서 최신 내용을 확인하세요. 상품 목록은 일부이며 전체가
        아닙니다.
      </p>
    </section>
  );
}
