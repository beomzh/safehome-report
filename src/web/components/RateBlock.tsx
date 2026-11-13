import { daysSince, isStale } from '../loanRates';
import type { LoanRateInfo } from '../loanRates';

const pct = (n: number) => `${n.toFixed(2).replace(/0$/, '')}%`;

/**
 * 대출 상품의 금리 안내. 공식 사이트에서 확인한 값만 보여주고, 출처 링크와 확인일을 항상 함께 표시한다.
 * 금리는 수시로 바뀌므로 확인일이 오래되면 경고하고, 확인하지 못한 부분은 그대로 밝힌다.
 */
export function RateBlock({ info, today }: { info: LoanRateInfo | undefined; today: string }) {
  if (!info) {
    return <p className="hint">금리: 공식 자료를 확인하지 못했습니다. 취급 기관의 안내 금리를 확인하세요.</p>;
  }
  const { source } = info;
  const stale = isStale(source.checkedAt, today);
  return (
    <div className="rate-block">
      <p>
        <strong>금리 (연)</strong> <span className="hint">{info.rateType}</span>
      </p>

      {info.range && (
        <p>
          공식 안내 금리 범위:{' '}
          <strong>
            {pct(info.range.minPercent)} ~ {pct(info.range.maxPercent)}
          </strong>
        </p>
      )}

      {info.table && (
        <table className="table">
          <caption className="hint">{info.table.basis}</caption>
          <tbody>
            {info.table.rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td>{pct(r.percent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {info.grid && (
        <div className="table-wrap">
          <table className="table">
            <caption className="hint">{info.grid.basis}</caption>
            <thead>
              <tr>
                <th scope="col">부부합산 연소득</th>
                {info.grid.cols.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {info.grid.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {r.percents.map((p, i) => (
                    <td key={info.grid?.cols[i]}>{pct(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {info.termTable && (
        <div className="table-wrap">
          <table className="table">
            <caption className="hint">만기별 금리 (공시일 {info.termTable.publishedAt})</caption>
            <thead>
              <tr>
                <th scope="col">상품</th>
                {info.termTable.terms.map((t) => (
                  <th key={t} scope="col">
                    {t}년
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {info.termTable.series.map((s) => (
                <tr key={s.name}>
                  <th scope="row">{s.name}</th>
                  {s.percents.map((p, i) => (
                    <td key={info.termTable?.terms[i]}>{pct(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {info.bankRates && (
        <div className="table-wrap">
          <table className="table">
            <caption className="hint">
              {info.bankRates.basis} — {info.bankRates.publishedYm} 공시 (실제 적용 금리와 다를 수 있음)
            </caption>
            <thead>
              <tr>
                <th>은행</th>
                <th>평균</th>
                {info.bankRates.scoreBands.map((b) => (
                  <th key={b}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...info.bankRates.banks]
                .sort((a, b) => (a.avgPercent ?? 99) - (b.avgPercent ?? 99))
                .map((b) => (
                  <tr key={b.name}>
                    <td>{b.name}</td>
                    <td>
                      <strong>{b.avgPercent === null ? '-' : pct(b.avgPercent)}</strong>
                    </td>
                    {b.byBand.map((v, i) => (
                      <td key={info.bankRates!.scoreBands[i]}>{v === null ? '-' : pct(v)}</td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {info.benchmarks && (
        <ul className="evidence">
          {info.benchmarks.map((b) => (
            <li key={b.name}>
              {b.name}: <strong>{pct(b.percent)}</strong> (공시 {b.publishedAt}
              {b.note ? `, ${b.note}` : ''})
            </li>
          ))}
        </ul>
      )}

      {info.adjustments.length > 0 && (
        <ul className="evidence">
          {info.adjustments.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      {info.notCovered.length > 0 && (
        <ul className="evidence">
          {info.notCovered.map((n) => (
            <li key={n}>⚠️ {n}</li>
          ))}
        </ul>
      )}

      <p className="hint">
        출처:{' '}
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          {source.name}
        </a>{' '}
        · 확인일 {source.checkedAt}
      </p>
      {stale && (
        <p className="notice danger" role="note">
          확인한 지 {daysSince(source.checkedAt, today)}일이 지났습니다. 금리가 바뀌었을 수 있으니 공식
          페이지에서 다시 확인하세요.
        </p>
      )}
    </div>
  );
}
