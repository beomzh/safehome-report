import type { Affordability, Bottleneck, Grade, LoanScenario } from '../../core';
import { formatWon } from '../present';

const BOTTLENECK_LABEL: Record<Bottleneck, string> = {
  ltv: 'LTV 한도',
  dsr: 'DSR 한도',
  product: '상품·기관 한도',
};

function ScenarioRow({ title, s }: { title: string; s: LoanScenario }) {
  return (
    <tr>
      <th scope="row">{title}</th>
      <td>{formatWon(s.estimated)}</td>
      <td>{BOTTLENECK_LABEL[s.bottleneck]}</td>
      <td className="muted">
        LTV {formatWon(s.byLtv)} · DSR {formatWon(s.byDsr)}
        {s.byProductCap !== undefined && ` · 상품 ${formatWon(s.byProductCap)}`}
      </td>
    </tr>
  );
}

export function FinanceReport({ result, grade }: { result: Affordability; grade: Grade }) {
  const plan = result.fundingBase;
  const consPlan = result.fundingConservative;
  const short = plan.surplus < 0;

  return (
    <section className="card" aria-labelledby="finance-title">
      <h2 id="finance-title">대출·필요 자금 추정</h2>

      {grade === 'red' && (
        <p className="notice danger" role="note">
          위험 신호가 발견되었습니다. 자금 계산보다 위험 신호 확인이 먼저입니다.
        </p>
      )}

      <h3>필요 자금</h3>
      <table className="table">
        <tbody>
          {plan.items.map((i) => (
            <tr key={i.label}>
              <th scope="row">{i.label}</th>
              <td>{formatWon(i.amount)}</td>
            </tr>
          ))}
          <tr className="total">
            <th scope="row">총 필요 자금</th>
            <td>{formatWon(plan.totalRequired)}</td>
          </tr>
        </tbody>
      </table>

      <h3>대출 가능액 추정</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">시나리오</th>
              <th scope="col">추정 한도</th>
              <th scope="col">한도 결정 항목</th>
              <th scope="col">항목별 한도</th>
            </tr>
          </thead>
          <tbody>
            <ScenarioRow title={`기준 (금리 ${result.base.dsrRatePercent}%)`} s={result.base} />
            {result.conservative.dsrRatePercent !== result.base.dsrRatePercent && (
              <ScenarioRow
                title={`보수 (DSR 금리 ${result.conservative.dsrRatePercent}%)`}
                s={result.conservative}
              />
            )}
          </tbody>
        </table>
      </div>

      <h3>내 자금 상황 (기준 시나리오)</h3>
      <table className="table">
        <tbody>
          <tr>
            <th scope="row">대출 반영액</th>
            <td>{formatWon(plan.loanUsed)}</td>
          </tr>
          <tr>
            <th scope="row">필요 자기자금</th>
            <td>{formatWon(plan.ownFundsNeeded)}</td>
          </tr>
          <tr className={short ? 'total short' : 'total ok'}>
            <th scope="row">{short ? '부족액' : '여유액'}</th>
            <td>
              {short ? '⚠️ ' : ''}
              {formatWon(Math.abs(plan.surplus))}
            </td>
          </tr>
          {plan.timeline && (
            <>
              <tr>
                <th scope="row">계약 시점 필요 현금</th>
                <td>{formatWon(plan.timeline.atContract)}</td>
              </tr>
              <tr>
                <th scope="row">잔금 시점 필요 현금</th>
                <td>{formatWon(plan.timeline.atBalance)}</td>
              </tr>
            </>
          )}
          <tr>
            <th scope="row">예상 월 상환액</th>
            <td>{formatWon(result.monthlyPayment)}</td>
          </tr>
          <tr>
            <th scope="row">연소득 대비 상환 비율</th>
            <td>
              {result.debtServicePercent === null ? '계산 불가(소득 0)' : `${result.debtServicePercent}%`}
            </td>
          </tr>
        </tbody>
      </table>
      {consPlan.surplus !== plan.surplus && (
        <p className="hint">
          보수 시나리오에서는 {consPlan.surplus < 0 ? '부족액' : '여유액'}이{' '}
          {formatWon(Math.abs(consPlan.surplus))}
          입니다.
        </p>
      )}

      <p className="notice subtle">
        추정치입니다. 실제 대출 한도와 금리는 금융기관 심사로 결정되며, 세금·수수료는 매물과 보유 주택 수 등에
        따라 달라집니다. 입력하지 않은 비용은 0원으로 계산했습니다. 정확한 금액은 금융기관·법무사·세무사에게
        확인하세요.
      </p>
    </section>
  );
}
