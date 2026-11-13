import { estimateMarketValue, estimateRent, findSimilarComplexes } from '../../core';
import type {
  MarketEstimate,
  RentEstimate,
  RentRecord,
  RulesConfig,
  SimilarComplex,
  TradeRecord,
} from '../../core';
import { parseRentXml, parseTradeXml, PublicDataError } from './aptTrade';
import { HOUSING } from './housing';
import type { HousingType } from './housing';

export type AdapterLog = (
  level: 'debug' | 'warn',
  event: string,
  fields: Record<string, string | number | boolean>,
) => void;

export interface TradeServiceOptions {
  /** 운영 로그 훅. 키·요청 URL 은 넘기지 않는다 */
  log?: AdapterLog;
  /** 공공데이터포털 서비스 키. Encoding 키(% 포함)는 그대로, Decoding 키는 인코딩해서 쓴다 */
  apiKey: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** 실패 시 재시도 횟수 (한도 초과 등 재시도해도 소용없는 오류는 재시도하지 않는다) */
  retries?: number;
  pageSize?: number;
  /** 전월세는 건수가 많아 더 크게 받는다 (허용 최대 9,999 확인, 기본 1000) */
  rentPageSize?: number;
  /** 429(요청 과다) 재시도 전 대기. 테스트에서 바꿀 수 있다 */
  sleepFn?: (ms: number) => Promise<void>;
  /** 한 달 조회 시 최대 페이지 수 (일일 한도 보호) */
  maxPages?: number;
  cacheTtlMs?: number;
  now?: () => number;
}

/** 429 일 때 다시 시도하는 최대 횟수 (대기 1.5초, 3초, 4.5초) */
const RATE_LIMIT_RETRIES = 3;
/** 공공데이터포털이 응답 헤더로 알려 주는 남은 일일 호출 수가 이 값 미만이면 경고 로그를 남긴다 */
export const LOW_QUOTA_WARN = 1000;

/** 응답 헤더 X-RateLimit-Remaining 을 읽는다 (없거나 숫자가 아니면 undefined) */
export function remainingQuota(res: Response): number | undefined {
  const raw = res.headers?.get('x-ratelimit-remaining');
  if (raw === null || raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

const NO_RETRY = new Set(['10', '20', '22', '30', '31']);

/** 'YYYY-MM-DD' 기준으로 현재 달과 이전 windowMonths 개월의 YYYYMM 목록 (최신순) */
export function monthsToFetch(asOf: string, windowMonths: number): string[] {
  const [y, m] = asOf.split('-').map(Number) as [number, number];
  const out: string[] = [];
  for (let i = 0; i <= windowMonths; i++) {
    const idx = y * 12 + (m - 1) - i;
    out.push(`${Math.floor(idx / 12)}${String((idx % 12) + 1).padStart(2, '0')}`);
  }
  return out;
}

/** 매매 실거래(아파트·연립다세대·오피스텔) 조회 서비스. 지역·계약월 단위로 메모리 캐시해 일일 한도를 아낀다 */
export function createTradeService(opts: TradeServiceOptions) {
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const retries = opts.retries ?? 2;
  const pageSize = opts.pageSize ?? 100;
  const rentPageSize = opts.rentPageSize ?? 1000;
  const sleep = opts.sleepFn ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxPages = opts.maxPages ?? 20;
  const ttl = opts.cacheTtlMs ?? 6 * 60 * 60 * 1000;
  const now = opts.now ?? Date.now;
  const log: AdapterLog = opts.log ?? (() => {});
  const key = opts.apiKey.includes('%') ? opts.apiKey : encodeURIComponent(opts.apiKey);
  const cache = new Map<string, { at: number; records: TradeRecord[] }>();

  async function fetchRaw(
    kind: 'trade' | 'rent',
    housing: HousingType,
    lawdCd: string,
    dealYmd: string,
    pageNo: number,
  ): Promise<string> {
    const spec = HOUSING[housing];
    const endpoint = kind === 'rent' ? spec.rentEndpoint : spec.endpoint;
    const qs = new URLSearchParams({
      LAWD_CD: lawdCd,
      DEAL_YMD: dealYmd,
      pageNo: String(pageNo),
      numOfRows: String(kind === 'rent' ? rentPageSize : pageSize),
    }).toString();
    let lastError: unknown;
    // 429(요청 과다)는 잠시 기다리면 풀리므로 더 많이, 점점 길게 기다리며 다시 시도한다
    const maxAttempts = Math.max(retries, RATE_LIMIT_RETRIES);
    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchFn(`${endpoint}?serviceKey=${key}&${qs}`, {
          signal: AbortSignal.timeout(timeoutMs),
        });
        const remaining = remainingQuota(res);
        if (remaining !== undefined) {
          log(remaining < LOW_QUOTA_WARN ? 'warn' : 'debug', 'public_data_quota', { remaining });
        }
        if (res.status === 429)
          throw new PublicDataError(
            '공공데이터포털이 요청이 많다고 잠시 제한했습니다(429). 1~2분 뒤 다시 조회하세요.',
            'http429',
          );
        if (!res.ok) throw new PublicDataError(`공공데이터 API HTTP ${res.status}`);
        const text = await res.text();
        // 오류 응답이면 여기서 던져 재시도 규칙을 적용한다
        (kind === 'rent' ? parseRentXml : parseTradeXml)(text, spec.nameTag, spec.areaTag);
        return text;
      } catch (e) {
        lastError = e;
        log('warn', 'public_data_retry', {
          month: dealYmd,
          attempt: attempt + 1,
          code: e instanceof PublicDataError ? (e.code ?? 'none') : 'network',
        });
        if (e instanceof PublicDataError && e.code === '30' && housing !== 'apt') {
          // 키에 이 API 권한이 없다: 활용신청 안내
          throw new PublicDataError(
            `${spec.label} ${kind === 'rent' ? '전월세' : '매매'} 실거래 API 활용신청이 되어 있지 않은 키입니다. 공공데이터포털에서 신청하세요: ${spec.applyUrl}`,
            '30',
          );
        }
        if (e instanceof PublicDataError && e.code && NO_RETRY.has(e.code)) throw e;
        if (e instanceof PublicDataError && e.code === 'http429') {
          if (attempt >= RATE_LIMIT_RETRIES) throw e;
          await sleep(1500 * (attempt + 1));
        } else if (attempt >= retries) {
          throw e;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new PublicDataError('공공데이터 API 호출 실패');
  }

  const fetchPage = async (housing: HousingType, lawdCd: string, dealYmd: string, pageNo: number) =>
    parseTradeXml(
      await fetchRaw('trade', housing, lawdCd, dealYmd, pageNo),
      HOUSING[housing].nameTag,
      HOUSING[housing].areaTag,
    );
  const fetchRentPage = async (housing: HousingType, lawdCd: string, dealYmd: string, pageNo: number) =>
    parseRentXml(
      await fetchRaw('rent', housing, lawdCd, dealYmd, pageNo),
      HOUSING[housing].nameTag,
      HOUSING[housing].areaTag,
    );
  const rentCache = new Map<string, { at: number; records: RentRecord[] }>();

  /** 전월세 한 달치. 월 단위 캐시, 페이지는 크게 받는다(요청 수 절감) */
  async function fetchRentMonth(
    lawdCd: string,
    dealYmd: string,
    housing: HousingType = 'apt',
  ): Promise<RentRecord[]> {
    const cacheKey = `${housing}:${lawdCd}:${dealYmd}`;
    const hit = rentCache.get(cacheKey);
    if (hit && now() - hit.at < ttl) return hit.records;
    const records: RentRecord[] = [];
    let total = Infinity;
    for (let page = 1; page <= maxPages && records.length < total; page++) {
      const parsed = await fetchRentPage(housing, lawdCd, dealYmd, page);
      records.push(...parsed.records);
      total = parsed.totalCount;
      if (parsed.records.length === 0 && parsed.skipped === 0) break;
    }
    rentCache.set(cacheKey, { at: now(), records });
    log('debug', 'public_data_rent_month_loaded', { month: dealYmd, records: records.length });
    return records;
  }

  async function fetchMonth(
    lawdCd: string,
    dealYmd: string,
    housing: HousingType = 'apt',
  ): Promise<TradeRecord[]> {
    const cacheKey = `${housing}:${lawdCd}:${dealYmd}`;
    const hit = cache.get(cacheKey);
    if (hit && now() - hit.at < ttl) {
      log('debug', 'public_data_cache_hit', { month: dealYmd, records: hit.records.length });
      return hit.records;
    }

    const records: TradeRecord[] = [];
    let total = Infinity;
    for (let page = 1; page <= maxPages && records.length < total; page++) {
      const parsed = await fetchPage(housing, lawdCd, dealYmd, page);
      records.push(...parsed.records);
      total = parsed.totalCount;
      if (parsed.records.length === 0 && parsed.skipped === 0) break;
    }
    cache.set(cacheKey, { at: now(), records });
    log('debug', 'public_data_month_loaded', { month: dealYmd, records: records.length });
    return records;
  }

  return {
    fetchMonth,
    fetchRentMonth,
    /**
     * 전월세 거래로 전세·월세 시세를 추정한다. 월세 거래가 많아 월 단위로 순차 호출하고(한도·429 보호),
     * 기간은 rentWindowMonths 만 쓴다.
     */
    async estimateRent(args: {
      housing?: HousingType;
      lawdCd: string;
      asOf: string;
      targetAreaM2: number;
      complexName?: string;
      dongName?: string;
      config: RulesConfig['marketEstimate'];
    }): Promise<RentEstimate & { monthsQueried: number }> {
      const months = monthsToFetch(args.asOf, args.config.rentWindowMonths);
      const all: RentRecord[] = [];
      // 429 를 피하려고 3개월씩 묶어 호출한다
      for (let i = 0; i < months.length; i += 3) {
        const chunk = months.slice(i, i + 3);
        const got = await Promise.all(chunk.map((ym) => fetchRentMonth(args.lawdCd, ym, args.housing)));
        all.push(...got.flat());
      }
      const spec = HOUSING[args.housing ?? 'apt'];
      const tolerance =
        spec.areaToleranceRatio !== undefined
          ? args.targetAreaM2 * spec.areaToleranceRatio
          : args.config.areaToleranceM2;
      const est = estimateRent(all, {
        asOf: args.asOf,
        targetAreaM2: args.targetAreaM2,
        areaToleranceM2: tolerance,
        windowMonths: args.config.rentWindowMonths,
        minSamples: args.config.minSamples,
        complexName: args.complexName,
        dongName: args.dongName,
      });
      return { ...est, monthsQueried: months.length };
    },
    /** 최근 거래를 모아 시세를 추정한다. 설정값(기간·최소 표본·면적 허용 오차)은 rules.config 에서 온다 */
    async estimate(args: {
      housing?: HousingType;
      lawdCd: string;
      asOf: string;
      targetAreaM2: number;
      complexName?: string;
      dongName?: string;
      config: RulesConfig['marketEstimate'];
    }): Promise<MarketEstimate & { monthsQueried: number; similar: SimilarComplex[] }> {
      const months = monthsToFetch(args.asOf, args.config.windowMonths);
      // 한꺼번에 13개월을 부르면 429 가 나므로 4개월씩 묶어 호출한다
      const all: TradeRecord[] = [];
      for (let i = 0; i < months.length; i += 4) {
        const chunk = months.slice(i, i + 4);
        const got = await Promise.all(chunk.map((ym) => fetchMonth(args.lawdCd, ym, args.housing)));
        all.push(...got.flat());
      }
      const spec = HOUSING[args.housing ?? 'apt'];
      const tolerance =
        spec.areaToleranceRatio !== undefined
          ? args.targetAreaM2 * spec.areaToleranceRatio
          : args.config.areaToleranceM2;
      const result = estimateMarketValue(all, {
        asOf: args.asOf,
        targetAreaM2: args.targetAreaM2,
        areaToleranceM2: tolerance,
        windowMonths: args.config.windowMonths,
        minSamples: args.config.minSamples,
        complexName: args.complexName,
        dongName: args.dongName,
      });
      const similar = !spec.supportsSimilar
        ? []
        : findSimilarComplexes(all, {
            asOf: args.asOf,
            targetAreaM2: args.targetAreaM2,
            areaToleranceM2: tolerance,
            windowMonths: args.config.windowMonths,
            minTrades: 2,
            limit: 5,
            excludeComplexName: args.complexName,
            referenceWon: result.market?.estimatedValue,
          });
      return { ...result, monthsQueried: months.length, similar };
    },
  };
}
