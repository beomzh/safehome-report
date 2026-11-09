import { estimateMarketValue } from '../../core';
import type { MarketEstimate, RulesConfig, TradeRecord } from '../../core';
import { parseAptTradeXml, PublicDataError } from './aptTrade';

const ENDPOINT = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';

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
  /** 한 달 조회 시 최대 페이지 수 (일일 한도 보호) */
  maxPages?: number;
  cacheTtlMs?: number;
  now?: () => number;
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

/** 아파트 매매 실거래 조회 서비스. 지역·계약월 단위로 메모리 캐시해 일일 한도를 아낀다 */
export function createTradeService(opts: TradeServiceOptions) {
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const retries = opts.retries ?? 2;
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 20;
  const ttl = opts.cacheTtlMs ?? 6 * 60 * 60 * 1000;
  const now = opts.now ?? Date.now;
  const log: AdapterLog = opts.log ?? (() => {});
  const key = opts.apiKey.includes('%') ? opts.apiKey : encodeURIComponent(opts.apiKey);
  const cache = new Map<string, { at: number; records: TradeRecord[] }>();

  async function fetchPage(lawdCd: string, dealYmd: string, pageNo: number) {
    const qs = new URLSearchParams({
      LAWD_CD: lawdCd,
      DEAL_YMD: dealYmd,
      pageNo: String(pageNo),
      numOfRows: String(pageSize),
    }).toString();
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchFn(`${ENDPOINT}?serviceKey=${key}&${qs}`, {
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new PublicDataError(`공공데이터 API HTTP ${res.status}`);
        return parseAptTradeXml(await res.text());
      } catch (e) {
        lastError = e;
        log('warn', 'public_data_retry', {
          month: dealYmd,
          attempt: attempt + 1,
          code: e instanceof PublicDataError ? (e.code ?? 'none') : 'network',
        });
        if (e instanceof PublicDataError && e.code && NO_RETRY.has(e.code)) throw e;
      }
    }
    throw lastError instanceof Error ? lastError : new PublicDataError('공공데이터 API 호출 실패');
  }

  async function fetchMonth(lawdCd: string, dealYmd: string): Promise<TradeRecord[]> {
    const cacheKey = `${lawdCd}:${dealYmd}`;
    const hit = cache.get(cacheKey);
    if (hit && now() - hit.at < ttl) {
      log('debug', 'public_data_cache_hit', { month: dealYmd, records: hit.records.length });
      return hit.records;
    }

    const records: TradeRecord[] = [];
    let total = Infinity;
    for (let page = 1; page <= maxPages && records.length < total; page++) {
      const parsed = await fetchPage(lawdCd, dealYmd, page);
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
    /** 최근 거래를 모아 시세를 추정한다. 설정값(기간·최소 표본·면적 허용 오차)은 rules.config 에서 온다 */
    async estimate(args: {
      lawdCd: string;
      asOf: string;
      targetAreaM2: number;
      complexName?: string;
      config: RulesConfig['marketEstimate'];
    }): Promise<MarketEstimate & { monthsQueried: number }> {
      const months = monthsToFetch(args.asOf, args.config.windowMonths);
      const batches = await Promise.all(months.map((ym) => fetchMonth(args.lawdCd, ym)));
      const result = estimateMarketValue(batches.flat(), {
        asOf: args.asOf,
        targetAreaM2: args.targetAreaM2,
        areaToleranceM2: args.config.areaToleranceM2,
        windowMonths: args.config.windowMonths,
        minSamples: args.config.minSamples,
        complexName: args.complexName,
      });
      return { ...result, monthsQueried: months.length };
    },
  };
}
