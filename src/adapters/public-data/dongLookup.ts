import codes from './dongCodes.json';

/**
 * 시군구(5자리) 아래 법정동·리 코드(뒤 5자리) 표. 원본: 행정안전부 법정동코드(KIKcd_B.20260701, 2026-07-01 시행본)에서
 * 이 앱이 검증한 시군구(256곳)만 추렸다. 2026 개편(인천 4개 구, 전남광주통합특별시, 부천·화성 구)이 반영돼 있다.
 * 건축물이 리 단위로 등록되어 조회되지 않는 읍·면 상위 행은 뺐다.
 * 표본 확인 결과는 docs/public-data-api.md 에 있다.
 */
const TABLE = codes as unknown as Record<string, [string, string][]>;

export type DongResult =
  { ok: true; bjdongCd: string; name: string } | { ok: false; reason: 'not_found' | 'ambiguous' };

/** 주소·법정동명에서 시군구 아래 법정동(리)을 찾는다. 모호하면 추측하지 않는다 */
export function resolveBjdong(sigunguCd: string, text: string): DongResult {
  const entries = TABLE[sigunguCd];
  if (!entries) return { ok: false, reason: 'not_found' };
  const tokens = new Set(text.replace(/[(),]/g, ' ').split(/\s+/).filter(Boolean));
  const hits = entries.filter(([, name]) => name.split(' ').every((t) => tokens.has(t)));
  if (hits.length === 0) return { ok: false, reason: 'not_found' };
  // 읍·면 + 리처럼 토큰이 많이 일치하는 항목을 우선한다
  const best = Math.max(...hits.map(([, n]) => n.split(' ').length));
  const top = hits.filter(([, n]) => n.split(' ').length === best);
  const first = top[0];
  if (top.length === 1 && first) return { ok: true, bjdongCd: first[0], name: first[1] };
  return { ok: false, reason: 'ambiguous' };
}

export interface Jibun {
  /** 0 대지, 1 산 */
  platGbCd: '0' | '1';
  bun: string;
  ji: string;
}

/** "12", "12-3", "산 12-3" 같은 지번을 건축HUB 요청 형식(4자리)으로 바꾼다. 형식이 다르면 null */
export function parseJibun(text: string): Jibun | null {
  const m = /^\s*(산\s*)?(\d{1,4})(?:\s*-\s*(\d{1,4}))?\s*(?:번지)?\s*$/.exec(text);
  if (!m) return null;
  return {
    platGbCd: m[1] ? '1' : '0',
    bun: (m[2] as string).padStart(4, '0'),
    ji: (m[3] ?? '0').padStart(4, '0'),
  };
}
