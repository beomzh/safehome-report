import { z } from 'zod';
import { monthsBetween, normalizeName } from '../rules/helpers';
import { isoDateSchema } from '../types';
import type { MarketInfo } from '../types';

/**
 * 공공 실거래 API 응답을 어댑터가 이 형태로 정규화해 넘긴다.
 * 매매는 거래금액, 전세는 보증금을 amountWon 에 넣는다.
 */
export const tradeRecordSchema = z.object({
  amountWon: z.number().int().positive().refine(Number.isSafeInteger),
  /** 전용면적(㎡) */
  areaM2: z.number().positive(),
  /** 계약일 YYYY-MM-DD (일자를 모르면 해당 월 1일로 정규화) */
  dealDate: isoDateSchema,
  complexName: z.string().optional(),
  /** 해제(취소)된 거래 */
  cancelled: z.boolean(),
});
export type TradeRecord = z.infer<typeof tradeRecordSchema>;

/** 기준값은 호출자가 rules.config 의 marketEstimate 에서 넘긴다 (기본값 없음) */
export const estimateParamsSchema = z.object({
  asOf: isoDateSchema,
  targetAreaM2: z.number().positive(),
  areaToleranceM2: z.number().nonnegative(),
  windowMonths: z.number().int().positive(),
  minSamples: z.number().int().positive(),
  /** 단지(건물)명. 있으면 같은 이름의 거래만 사용 */
  complexName: z.string().optional(),
});
export type EstimateParams = z.infer<typeof estimateParamsSchema>;

export interface MarketEstimate {
  /** 표본이 없으면 undefined (시세 기반 룰은 판단 보류가 된다) */
  market?: MarketInfo;
  sampleCount: number;
  minWon?: number;
  maxWon?: number;
}

/** 정수 중앙값. 짝수 개면 가운데 두 값의 평균(내림) */
export function medianWon(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError('빈 목록의 중앙값은 계산할 수 없다');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return Math.floor(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

/**
 * 실거래 목록에서 시세를 추정한다 (순수 함수).
 * 해제된 거래, 면적 허용 범위 밖, 기간 밖, (지정 시) 다른 단지 거래는 제외한다.
 * 표본이 minSamples 미만이면 신뢰도를 low 로 표시한다.
 */
export function estimateMarketValue(rawRecords: unknown, rawParams: unknown): MarketEstimate {
  const records = z.array(tradeRecordSchema).parse(rawRecords);
  const p = estimateParamsSchema.parse(rawParams);
  const wanted = p.complexName?.trim() ? normalizeName(p.complexName) : undefined;

  const used = records.filter((r) => {
    if (r.cancelled) return false;
    if (Math.abs(r.areaM2 - p.targetAreaM2) > p.areaToleranceM2) return false;
    const months = monthsBetween(r.dealDate, p.asOf);
    if (months < 0 || months > p.windowMonths) return false;
    if (wanted !== undefined && (!r.complexName || normalizeName(r.complexName) !== wanted)) return false;
    return true;
  });

  if (used.length === 0) return { sampleCount: 0 };

  const amounts = used.map((r) => r.amountWon);
  return {
    market: {
      estimatedValue: medianWon(amounts),
      source: 'trade_median',
      confidence: used.length >= p.minSamples ? 'high' : 'low',
    },
    sampleCount: used.length,
    minWon: Math.min(...amounts),
    maxWon: Math.max(...amounts),
  };
}
