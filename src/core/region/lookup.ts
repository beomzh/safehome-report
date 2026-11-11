import { SIGUNGU_CODES } from './sigunguCodes';

/** 시도 표기 변형을 한 가지로 맞춘다 (주소에 적힌 대로 매칭하기 위해) */
const SIDO_ALIASES: [string, string[]][] = [
  ['서울', ['서울특별시', '서울시', '서울']],
  ['부산', ['부산광역시', '부산시', '부산']],
  ['대구', ['대구광역시', '대구시', '대구']],
  ['인천', ['인천광역시', '인천시', '인천']],
  ['광주', ['광주광역시', '광주시', '광주']],
  ['대전', ['대전광역시', '대전시', '대전']],
  ['울산', ['울산광역시', '울산시', '울산']],
  ['세종', ['세종특별자치시', '세종시', '세종']],
  ['경기', ['경기도', '경기']],
  ['강원', ['강원특별자치도', '강원도', '강원']],
  ['충북', ['충청북도', '충북']],
  ['충남', ['충청남도', '충남']],
  ['전북', ['전북특별자치도', '전라북도', '전북']],
  ['전남', ['전라남도', '전남']],
  ['경북', ['경상북도', '경북']],
  ['경남', ['경상남도', '경남']],
  ['제주', ['제주특별자치도', '제주도', '제주']],
];

const sidoShort = (token: string): string | undefined =>
  SIDO_ALIASES.find(([, names]) => names.includes(token))?.[0];

interface Entry {
  code: string;
  name: string;
  sido: string;
  /** 시도를 뺀 나머지 토큰 (예: ['수원시', '장안구']) */
  rest: string[];
}

const ENTRIES: Entry[] = SIGUNGU_CODES.map(([code, name]) => {
  const [first = '', ...rest] = name.split(' ');
  return { code, name, sido: sidoShort(first) ?? first, rest };
});

export interface RegionMatch {
  code: string;
  name: string;
}

export type RegionResult =
  { ok: true; match: RegionMatch } | { ok: false; reason: 'not_found' | 'ambiguous' };

/**
 * 주소 문자열에서 시군구 법정동코드를 찾는다 (순수 함수, 네트워크·LLM 없음).
 * 시도가 있으면 시도까지 일치해야 하고, 없으면 시군구 이름이 하나로 정해질 때만 인정한다.
 * 여러 곳에 일치하면(예: 시도 없는 "중구") 추측하지 않고 ambiguous 를 돌려준다.
 */
export function findSigungu(address: string): RegionResult {
  const tokens = address.replace(/[(),]/g, ' ').split(/\s+/).filter(Boolean);
  const sido = tokens.map(sidoShort).find((s) => s !== undefined);
  const hits = ENTRIES.filter((e) => {
    if (sido !== undefined && e.sido !== sido) return false;
    // 시도 하나뿐인 항목(세종)은 주소에 그 시도가 적혀 있을 때만 인정한다
    if (e.rest.length === 0) return sido !== undefined;
    return e.rest.every((r) => tokens.includes(r));
  });
  if (hits.length === 0) return { ok: false, reason: 'not_found' };
  // 가장 구체적인(토큰이 많은) 항목을 우선한다 (예: 수원시 장안구 > 수원시)
  const best = Math.max(...hits.map((h) => h.rest.length));
  const top = hits.filter((h) => h.rest.length === best);
  const first = top[0];
  if (top.length === 1 && first) return { ok: true, match: { code: first.code, name: first.name } };
  return { ok: false, reason: 'ambiguous' };
}

/** 주소에서 법정동(읍·면·동·가)을 뽑는다. 번지·층·호는 제외 */
export function findDongName(address: string): string | undefined {
  const tokens = address.replace(/[(),]/g, ' ').split(/\s+/).filter(Boolean);
  return tokens.find((t) => /^[가-힣0-9]+(동|읍|면|가)$/.test(t) && !/^\d+동$/.test(t) && t.length >= 2);
}
