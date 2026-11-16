import { PublicDataError } from './aptTrade';
import type { AdapterLog } from './tradeService';

/**
 * 브이월드(국가공간정보) 공동주택가격속성 조회 — 동·호별 공시가격.
 * 2026-11-16 실제 호출로 확인한 사실: 요청 `https://api.vworld.kr/ned/data/getApartHousingPriceAttr`
 * (key, **domain**, pnu, stdrYear, dongNm, hoNm, format=json, numOfRows, pageNo). 인증키 발급 때 등록한 서비스 주소를 `domain` 으로 보내야 하고
 * (없으면 INCORRECT_KEY), pnu 는 법정동코드 10자리 + 대지구분 1자리(1 일반, 2 산) + 본번 4 + 부번 4 이다.
 * 동·호는 정확히 일치해야 걸리고(부분 일치 안 됨), 같은 동·호가 중복으로 올 수 있다. 결과가 없으면 응답 키가 `apartHousingPrices` 가 아니라 `response` 로 온다.
 */
const ENDPOINT = 'https://api.vworld.kr/ned/data/getApartHousingPriceAttr';

export interface PublicPrice {
  stdrYear: string;
  /** 공시기준월 (예: 01) */
  stdrMt: string;
  dongNm: string;
  hoNm: string;
  floorNm: string;
  /** 전용면적 ㎡ */
  areaM2: number;
  /** 공시가격 (원) */
  priceWon: number;
  /** 단지명 */
  complexName: string;
  /** 일반·집합 등 */
  kind: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** 응답(JSON)을 정규화한다. 오류 코드는 PublicDataError 로 던지고, 결과가 없으면 빈 목록 */
export function parsePublicPriceJson(text: string): PublicPrice[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PublicDataError('인식할 수 없는 응답 형식입니다');
  }
  const root = json as Record<
    string,
    { resultCode?: string; resultMsg?: string; field?: unknown } | undefined
  >;
  const body = root.apartHousingPrices ?? root.response;
  if (!body) throw new PublicDataError('인식할 수 없는 응답 형식입니다');
  if (body.resultCode) {
    // 결과가 없을 때는 resultCode 가 빈 문자열이다. 값이 있으면 오류(INCORRECT_KEY 등)
    throw new PublicDataError(`브이월드 오류 (${body.resultCode}: ${body.resultMsg ?? ''})`, body.resultCode);
  }
  const fields = Array.isArray(body.field) ? (body.field as Record<string, unknown>[]) : [];
  const out: PublicPrice[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    const price = Number(str(f.pblntfPc));
    const area = Number(str(f.prvuseAr));
    if (!Number.isSafeInteger(price) || price <= 0) continue;
    const row: PublicPrice = {
      stdrYear: str(f.stdrYear),
      stdrMt: str(f.stdrMt),
      dongNm: str(f.dongNm),
      hoNm: str(f.hoNm),
      floorNm: str(f.floorNm),
      areaM2: Number.isFinite(area) ? area : 0,
      priceWon: price,
      complexName: str(f.aphusNm),
      kind: str(f.aphusSeCodeNm),
    };
    // 같은 동·호·기준이 중복으로 오므로 한 번만 남긴다
    const key = `${row.stdrYear}|${row.dongNm}|${row.hoNm}|${row.priceWon}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export interface VworldOptions {
  apiKey: string;
  /** 키 발급 때 등록한 서비스 주소 (기본 localhost) */
  domain?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  log?: AdapterLog;
}

/** 최신 기준연도부터 거슬러 올라가며(이번 연도 → 전년도) 공시가격이 있는 가장 최근 값을 찾는다 */
export function createPublicPriceService(opts: VworldOptions) {
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const domain = opts.domain ?? 'localhost';
  const log: AdapterLog = opts.log ?? (() => {});

  async function fetchYear(pnu: string, year: number, dong: string, ho: string): Promise<PublicPrice[]> {
    const qs = new URLSearchParams({
      key: opts.apiKey,
      domain,
      format: 'json',
      pnu,
      stdrYear: String(year),
      numOfRows: '50',
      pageNo: '1',
      ...(dong ? { dongNm: dong } : {}),
      ...(ho ? { hoNm: ho } : {}),
    });
    const res = await fetchFn(`${ENDPOINT}?${qs.toString()}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new PublicDataError(`브이월드 HTTP ${res.status}`);
    return parsePublicPriceJson(await res.text());
  }

  return {
    async lookup(args: { pnu: string; dong: string; ho: string; thisYear: number }): Promise<PublicPrice[]> {
      for (const year of [args.thisYear, args.thisYear - 1]) {
        const list = await fetchYear(args.pnu, year, args.dong, args.ho);
        log('debug', 'vworld_price_loaded', { year, records: list.length });
        if (list.length > 0) return list;
      }
      return [];
    },
  };
}

/** 법정동코드 10자리 + 대지구분 + 본번·부번(4자리) 로 pnu(19자리)를 만든다 */
export function buildPnu(
  sigunguCd: string,
  bjdongCd: string,
  platGbCd: '0' | '1',
  bun: string,
  ji: string,
): string {
  // 건축HUB 의 대지구분(0 대지, 1 산)을 PNU 의 구분(1 일반, 2 산)으로 바꾼다
  return `${sigunguCd}${bjdongCd}${platGbCd === '1' ? '2' : '1'}${bun}${ji}`;
}
