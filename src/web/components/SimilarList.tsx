import { formatWon } from '../present';
import { complexSearchLinks } from '../siteLinks';
import type { LookupInfo } from './MarketLookup';

/** 같은 지역 다른 단지의 거래 사례와 단지별 검색 링크 (시세 조회 화면과 리포트가 함께 쓴다) */
export function SimilarList({ similar }: { similar: LookupInfo['similar'] }) {
  return (
    <ul className="evidence">
      {similar.map((c) => (
        <li key={c.complexName}>
          {c.complexName}: 중앙값 {formatWon(c.medianWon)} ({c.count}건
          {c.diffPercent !== undefined && `, 조회 시세 대비 ${c.diffPercent > 0 ? '+' : ''}${c.diffPercent}%`}
          ){' '}
          {complexSearchLinks(c.complexName).map((l, i) => (
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
  );
}
