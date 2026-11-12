import { formatWon } from '../present';
import type { LookupInfo } from './MarketLookup';
import { SiteLinkList } from './SiteLinks';

/** 리포트의 "시세·대안 단지" 시트: 시세 조회 결과 안내, 같은 지역 다른 단지의 거래 사례, 확인용 사이트 링크 */
export function MarketNotes({ info }: { info: LookupInfo }) {
  const { similar, message } = info;
  return (
    <section className="card" aria-labelledby="market-notes-title">
      <h2 id="market-notes-title">시세 조회 결과와 비슷한 단지</h2>
      {message ? (
        <p className={message.tone === 'error' ? 'errors' : 'notice'}>{message.text}</p>
      ) : (
        <p className="hint">시세 조회를 실행하지 않았습니다. 시세는 직접 입력한 값입니다.</p>
      )}
      {similar.length > 0 && (
        <>
          <h3>같은 지역에서 비슷한 면적으로 거래된 다른 단지 (참고)</h3>
          <ul className="evidence">
            {similar.map((c) => (
              <li key={c.complexName}>
                {c.complexName}: 중앙값 {formatWon(c.medianWon)} ({c.count}건
                {c.diffPercent !== undefined &&
                  `, 조회 시세 대비 ${c.diffPercent > 0 ? '+' : ''}${c.diffPercent}%`}
                )
              </li>
            ))}
          </ul>
          <p className="hint">
            판매 중인 매물이 아니라 최근 실제 거래 사례입니다. 대안 단지를 찾는 출발점으로만 쓰고, 지금 나온
            매물은 아래 매물 사이트에서 확인하세요.
          </p>
        </>
      )}
      <h3>함께 확인할 사이트</h3>
      <SiteLinkList />
    </section>
  );
}
