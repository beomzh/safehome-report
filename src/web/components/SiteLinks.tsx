import { SITE_GROUPS } from '../siteLinks';

/** 사이트 링크 목록 (링크만 제공, 앱이 호출하지 않음) */
export function SiteLinkList() {
  return (
    <>
      <p className="hint">링크만 제공하며 이 앱은 해당 사이트로 정보를 보내지 않습니다.</p>
      {SITE_GROUPS.map((g) => (
        <div key={g.title}>
          <h3>{g.title}</h3>
          <ul className="evidence">
            {g.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.name}
                </a>{' '}
                <span className="muted">— {l.note}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** 방문 전 점검에 쓰는 외부 사이트 모음 */
export function SiteLinks() {
  return (
    <details className="card site-links">
      <summary>
        <strong>함께 확인할 사이트</strong>
      </summary>
      <SiteLinkList />
    </details>
  );
}
