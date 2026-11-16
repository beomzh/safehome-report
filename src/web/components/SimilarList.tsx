import { formatWon } from '../present';
import { complexSearchLinks } from '../siteLinks';
import type { LookupInfo } from './MarketLookup';

/** 같은 지역 다른 단지의 거래 사례와 단지별 검색 링크 (시세 조회 화면과 리포트가 함께 쓴다) */
export function SimilarList({ similar, region = '' }: { similar: LookupInfo['similar']; region?: string }) {
  return (
    <>
      <ul className="evidence">
        {similar.map((c) => (
          <li key={c.complexName}>
            {c.complexName}: 중앙값 {formatWon(c.medianWon)} ({c.count}건
            {c.diffPercent !== undefined &&
              `, 조회 시세 대비 ${c.diffPercent > 0 ? '+' : ''}${c.diffPercent}%`}
            ){' '}
            {complexSearchLinks(c.complexName, region).map((l, i) => (
              <span key={l.url}>
                {i > 0 && ' · '}
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.name}
                </a>
              </span>
            ))}
          </li>
        ))}
      </ul>
      <p className="hint">
        위 단지는 최근 실제로 거래된 사례입니다. 링크는 그 단지의 검색 화면으로, 지금 나온 매물이 없으면 "매물
        없음"으로 나올 수 있습니다(대안 단지를 찾는 출발점으로만 쓰세요).
      </p>
    </>
  );
}
