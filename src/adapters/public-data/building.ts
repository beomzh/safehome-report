import type { BuildingEntry } from '../../core';
import { PublicDataError } from './aptTrade';
import type { AdapterLog } from './tradeService';

const ENDPOINT = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo';
const NO_RETRY = new Set(['10', '20', '22', '30', '31']);

export interface BuildingTitle extends BuildingEntry {
  hhldCnt: number;
  grndFlrCnt: number;
  ugrndFlrCnt: number;
  /** 사용승인일 YYYYMMDD (없으면 빈 문자열) */
  useAprDay: string;
  totalAreaM2: number;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * 건축물대장 표제부 응답(JSON)을 정규화한다. 2026-11-12 실제 응답으로 확인한 필드:
 * bldNm, dongNm, mainPurpsCdNm(주용도), etcPurps(기타용도), hhldCnt, grndFlrCnt, ugrndFlrCnt, totArea, useAprDay.
 * 결과가 없으면 items 가 빈 문자열로 오고, 한 건이면 배열이 아니라 객체로 올 수 있다.
 */
export function parseBuildingJson(text: string): BuildingTitle[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PublicDataError('인식할 수 없는 응답 형식입니다');
  }
  const root = json as Record<string, unknown>;
  const err = root.OpenAPI_ServiceResponse as { cmmMsgHeader?: Record<string, string> } | undefined;
  if (err?.cmmMsgHeader) {
    const code = err.cmmMsgHeader.returnReasonCode ?? '';
    throw new PublicDataError(
      `공공데이터 API 오류 (${code}: ${err.cmmMsgHeader.returnAuthMsg ?? err.cmmMsgHeader.errMsg ?? ''})`,
      code || undefined,
    );
  }
  const response = root.response as
    { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: unknown } } | undefined;
  const code = response?.header?.resultCode;
  if (code === undefined) throw new PublicDataError('인식할 수 없는 응답 형식입니다');
  if (code !== '00') {
    throw new PublicDataError(`건축물대장 API 오류 (${code}: ${response?.header?.resultMsg ?? ''})`, code);
  }
  const items = (response?.body?.items as { item?: unknown } | string | undefined) ?? '';
  const raw = typeof items === 'string' ? [] : items.item;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((it: Record<string, unknown>) => {
    const bldNm = str(it.bldNm);
    const dongNm = str(it.dongNm);
    const label = [bldNm, dongNm && !bldNm.includes(dongNm) ? `${dongNm}동` : ''].filter(Boolean).join(' ');
    return {
      label: label || '(이름 없음)',
      mainPurpose: str(it.mainPurpsCdNm),
      etcPurpose: str(it.etcPurps) || undefined,
      hhldCnt: num(it.hhldCnt),
      grndFlrCnt: num(it.grndFlrCnt),
      ugrndFlrCnt: num(it.ugrndFlrCnt),
      useAprDay: str(it.useAprDay),
      totalAreaM2: num(it.totArea),
    };
  });
}

export interface BuildingServiceOptions {
  apiKey: string;
  log?: AdapterLog;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  cacheTtlMs?: number;
  now?: () => number;
}

/** 건축물대장 표제부 조회. 같은 지번은 메모리 캐시한다 */
export function createBuildingService(opts: BuildingServiceOptions) {
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const retries = opts.retries ?? 1;
  const ttl = opts.cacheTtlMs ?? 6 * 60 * 60 * 1000;
  const now = opts.now ?? Date.now;
  const log: AdapterLog = opts.log ?? (() => {});
  const key = opts.apiKey.includes('%') ? opts.apiKey : encodeURIComponent(opts.apiKey);
  const cache = new Map<string, { at: number; list: BuildingTitle[] }>();

  return {
    async lookup(args: {
      sigunguCd: string;
      bjdongCd: string;
      platGbCd: '0' | '1';
      bun: string;
      ji: string;
    }): Promise<BuildingTitle[]> {
      const id = `${args.sigunguCd}:${args.bjdongCd}:${args.platGbCd}:${args.bun}:${args.ji}`;
      const hit = cache.get(id);
      if (hit && now() - hit.at < ttl) return hit.list;
      const qs = new URLSearchParams({
        sigunguCd: args.sigunguCd,
        bjdongCd: args.bjdongCd,
        platGbCd: args.platGbCd,
        bun: args.bun,
        ji: args.ji,
        numOfRows: '100',
        pageNo: '1',
        _type: 'json',
      }).toString();
      let last: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await fetchFn(`${ENDPOINT}?serviceKey=${key}&${qs}`, {
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!res.ok) throw new PublicDataError(`공공데이터 API HTTP ${res.status}`);
          const list = parseBuildingJson(await res.text());
          cache.set(id, { at: now(), list });
          log('debug', 'public_data_building_loaded', { records: list.length });
          return list;
        } catch (e) {
          last = e;
          log('warn', 'public_data_retry', {
            attempt: attempt + 1,
            code: e instanceof PublicDataError ? (e.code ?? 'none') : 'network',
          });
          if (e instanceof PublicDataError && e.code && NO_RETRY.has(e.code)) throw e;
        }
      }
      throw last instanceof Error ? last : new PublicDataError('공공데이터 API 호출 실패');
    },
  };
}
