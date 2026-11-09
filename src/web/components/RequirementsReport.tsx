import type { Grade, MaxLoanBottleneck, Requirements } from '../../core';
import type { Kind } from '../form';
import { formatWon } from '../present';

const BOTTLENECK_LABEL: Record<MaxLoanBottleneck, string> = {
  ltv: 'LTV 한도',
  product: '상품·기관 한도',
  price: '가격(보증금) 자체',
};

/**
 * "이 가격이면 연소득과 자산이 얼마나 필요한가" — 내 재무 정보 없이 매물 조건과 입력한 대출 기준값으로 계산한다.
 * 대출을 얼마나 받느냐에 따라 필요 자기자금과 필요 연소득이 어떻게 달라지는지 한 표로 보여준다.
 */
export function RequirementsReport({
  requirements: r,
  kind,
  amountWon,
  grade,
}: {
  requirements: Requirements;
  kind: Kind;
  amountWon: number;
  grade: Grade;
}) {
  const top = r.rows[0];
  const subject = kind === 'sale' ? `매매가 ${formatWon(amountWon)}` : `보증금 ${formatWon(amountWon)}`;
  const showConservative = r.rows.some((x) => x.minIncomeConservative !== x.minIncomeBase);

  return (
    <section className="card" aria-labelledby="req-title">
      <h2 id="req-title">이 매물에 필요한 조건 ({subject})</h2>

      {grade === 'red' && (
        <p className="notice danger" role="note">
          위험 신호가 발견되었습니다. 자금 계산보다 위험 신호 확인이 먼저입니다.
        </p>
      )}

      {top && (
        <div className="grade grade-gray" role="status">
          <div>
            <div className="grade-label">대출 최대 {formatWon(r.maxLoan)}</div>
            <div className="grade-headline">
              한도를 정하는 항목: {BOTTLENECK_LABEL[r.maxLoanBottleneck]} · 대출을 최대로 받으면 자기자금{' '}
              {formatWon(top.ownFundsNeeded)} 이상, 연소득 {formatWon(top.minIncomeBase)} 이상 필요
            </div>
          </div>
        </div>
      )}

      <h3>총 필요 자금</h3>
      <table className="table">
        <tbody>
          {r.items.map((i) => (
            <tr key={i.label}>
              <th scope="row">{i.label}</th>
              <td>{formatWon(i.amount)}</td>
            </tr>
          ))}
          <tr className="total">
            <th scope="row">총 필요 자금</th>
            <td>{formatWon(r.totalRequired)}</td>
          </tr>
        </tbody>
      </table>

      <h3>대출을 얼마나 받느냐에 따라</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">최대 대출 대비</th>
              <th scope="col">대출액</th>
              <th scope="col">필요 자기자금</th>
              <th scope="col">월 상환액</th>
              <th scope="col">필요 연소득</th>
              {showConservative && <th scope="col">필요 연소득 (스트레스)</th>}
            </tr>
          </thead>
          <tbody>
            {r.rows.map((x) => (
              <tr key={x.loanSharePercent}>
                <th scope="row">{x.loanSharePercent === 0 ? '대출 없음' : `${x.loanSharePercent}%`}</th>
                <td>{formatWon(x.loan)}</td>
                <td>{formatWon(x.ownFundsNeeded)}</td>
                <td>{x.loan === 0 ? '-' : formatWon(x.monthlyPayment)}</td>
                <td>{formatWon(x.minIncomeBase)}</td>
                {showConservative && <td>{formatWon(x.minIncomeConservative)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        필요 연소득은 (신규 대출 연 원리금 + 기존 대출 연 원리금) ÷ DSR 한도로 계산합니다. 연소득이 이 값
        이상이고 자기자금이 해당 줄의 금액 이상이면 그 조건으로 진행할 수 있습니다.
      </p>

      <p className="notice subtle">
        입력하신 LTV·DSR·금리·기간·비용 가정으로 계산한 추정치입니다(입력하지 않은 비용은 0원). 실제 한도와
        금리는 금융기관 심사로 결정되며, 규제·상품에 따라 크게 달라질 수 있으니 은행 안내값으로 다시 계산해
        보세요.
      </p>
    </section>
  );
}
