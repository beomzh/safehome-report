/**
 * 사이트 보기 패널. 일부 사이트는 다른 페이지 안에 넣는 것(iframe)을 헤더로 막는다.
 * 2026-11-12 응답 헤더 확인: 네이버 부동산(land·fin·m.land)과 호갱노노는 X-Frame-Options: SAMEORIGIN 으로 막고,
 * KB부동산·다방·피터팬은 해당 헤더가 없다. 직방은 자동 요청에 403 을 돌려줘 확인하지 못했다.
 * 막힌 사이트는 화면 안에 넣지 않고 작은 팝업 창으로 연다.
 */
export const VIEWER_EVENT = 'safehome:view-site';

const BLOCKED_HOSTS = [/(^|\.)naver\.com$/, /(^|\.)hogangnono\.com$/];

/** http(s) 주소만 허용한다 (javascript: 등 차단). 올바르지 않으면 null */
export function normalizeViewUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** 이 주소를 화면 안 프레임에 넣을 수 있는지 (알려진 차단 사이트면 false) */
export function canFrame(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !BLOCKED_HOSTS.some((re) => re.test(host));
  } catch {
    return false;
  }
}

/** 어디서든 호출: 사이트 보기 패널(또는 팝업)로 연다 */
export function openSiteViewer(rawUrl: string): boolean {
  const url = normalizeViewUrl(rawUrl);
  if (!url) return false;
  if (!canFrame(url)) {
    window.open(url, 'safehome-site', 'popup=yes,width=1100,height=800,noopener,noreferrer');
    return true;
  }
  window.dispatchEvent(new CustomEvent(VIEWER_EVENT, { detail: url }));
  return true;
}
