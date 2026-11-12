import { z } from 'zod';
import { monthsBetween, normalizeName, percent } from '../rules/helpers';
import { isoDateSchema } from '../types';
import { medianWon } from './estimate';

/** 전월세 실거래 한 건 (어댑터가 정규화해 넘긴다). 월세가 0 이면 전세다 */
export const rentRecordSchema = z.object({
  depositWon: z.number().int().positive().refine(Number.isSafeInteger),
  monthlyRentWon: z.number().int().nonnegative().refine(Number.isSafeInteger),
  areaM2: z.number().positive(),
  dealDate: isoDateSchema,
  complexName: z.string().optional(),
  dongName: z.string().optional(),
  /** 갱신 계약 (신규·모름은 false). 갱신은 신규보다 낮게 형성되는 경향이 있다 */
  renewal: z.boolean(),
});
export type RentRecord = z.infer<typeof rentRecordSchema>;

export const rentParamsSchema = z.object({
  asOf: isoDateSchema,
  targetAreaM2: z.number().positive(),
  areaToleranceM2: z.number().nonnegative(),
  windowMonths: z.number().int().positive(),
  minSamples: z.number().int().positive(),
  complexName: z.string().optional(),
  dongName: z.string().optional(),
});
export type RentParams = z.infer<typeof rentParamsSchema>;

export interface JeonseEstimate {
  medianWon: number;
  sampleCount: number;
  minWon: number;
  maxWon: number;
  confidence: 'high' | 'low';
  /** 신규 계약 표본이 부족해 갱신 계약을 포함했는가 (포함하면 신뢰도 low) */
  includesRenewal: boolean;
}

export interface MonthlyEstimate {
  medianDepositWon: number;
  medianRentWon: number;
  sampleCount: number;
}

export interface RentEstimate {
  jeonse?: JeonseEstimate;
  monthly?: MonthlyEstimate;
}

/**
 * 전월세 실거래에서 전세·월세 시세를 추정한다 (순수 함수).
 * 기간·면적·(지정 시)단지·동 필터는 매매 시세와 같다. 전세는 신규 계약만으로 minSamples 이상이면 그것만 쓰고,
 * 부족하면 갱신 계약을 포함하되 신뢰도를 low 로 둔다. 전월세에는 해제 정보가 없어 취소 거래는 거를 수 없다.
 */
export function estimateRent(rawRecords: unknown, rawParams: unknown): RentEstimate {
  const records = z.array(rentRecordSchema).parse(rawRecords);
  const p = rentParamsSchema.parse(rawParams);
  const wanted = p.complexName?.trim() ? normalizeName(p.complexName) : undefined;
  const wantedDong = p.dongName?.trim() ? normalizeName(p.dongName) : undefined;

  const used = records.filter((r) => {
    if (Math.abs(r.areaM2 - p.targetAreaM2) > p.areaToleranceM2) return false;
    const months = monthsBetween(r.dealDate, p.asOf);
    if (months < 0 || months > p.windowMonths) return false;
    if (wanted !== undefined && (!r.complexName || normalizeName(r.complexName) !== wanted)) return false;
    if (
      wanted === undefined &&
      wantedDong !== undefined &&
      (!r.dongName || normalizeName(r.dongName) !== wantedDong)
    )
      return false;
    return true;
  });

  const out: RentEstimate = {};
  const jeonseAll = used.filter((r) => r.monthlyRentWon === 0);
  if (jeonseAll.length > 0) {
    const fresh = jeonseAll.filter((r) => !r.renewal);
    const enough = fresh.length >= p.minSamples;
    const pick = enough ? fresh : jeonseAll;
    const amounts = pick.map((r) => r.depositWon);
    out.jeonse = {
      medianWon: medianWon(amounts),
      sampleCount: pick.length,
      minWon: Math.min(...amounts),
      maxWon: Math.max(...amounts),
      confidence: enough ? 'high' : 'low',
      includesRenewal: !enough && pick.some((r) => r.renewal),
    };
  }
  const monthly = used.filter((r) => r.monthlyRentWon > 0);
  if (monthly.length > 0) {
    out.monthly = {
      medianDepositWon: medianWon(monthly.map((r) => r.depositWon)),
      medianRentWon: medianWon(monthly.map((r) => r.monthlyRentWon)),
      sampleCount: monthly.length,
    };
  }
  return out;
}

/** 전세가율 = 전세 시세 ÷ 매매 시세 × 100 (소수 첫째 자리). 어느 한쪽이 없으면 undefined */
export function jeonseRatioPercent(jeonseWon: number | undefined, saleWon: number | undefined) {
  if (jeonseWon === undefined || saleWon === undefined || saleWon <= 0) return undefined;
  return percent(jeonseWon, saleWon);
}
