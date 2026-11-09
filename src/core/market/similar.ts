import { z } from 'zod';
import { monthsBetween, normalizeName } from '../rules/helpers';
import { medianWon, tradeRecordSchema } from './estimate';

/** 같은 지역에서 비슷한 면적으로 실제 거래된 다른 단지. 판매 중인 매물이 아니라 거래 사례다 */
export interface SimilarComplex {
  complexName: string;
  medianWon: number;
  count: number;
  minWon: number;
  maxWon: number;
  /** 기준 가격 대비 차이(%, 소수 첫째 자리). 기준이 없으면 undefined */
  diffPercent?: number;
}

const paramsSchema = z.object({
  asOf: z.string(),
  targetAreaM2: z.number().positive(),
  areaToleranceM2: z.number().nonnegative(),
  windowMonths: z.number().int().positive(),
  /** 이 건수 미만인 단지는 우연한 한 건일 수 있어 제외한다 */
  minTrades: z.number().int().positive(),
  limit: z.number().int().positive(),
  /** 제외할 단지(조회한 매물 자신) */
  excludeComplexName: z.string().optional(),
  /** 기준 가격(원). 있으면 이 값에 가까운 순으로 정렬한다 */
  referenceWon: z.number().int().positive().optional(),
});
export type SimilarParams = z.infer<typeof paramsSchema>;

/** 단지별로 묶어 비슷한 면적·최근 기간의 거래만 모은다 (순수 함수, 해제 거래 제외) */
export function findSimilarComplexes(rawRecords: unknown, rawParams: unknown): SimilarComplex[] {
  const records = z.array(tradeRecordSchema).parse(rawRecords);
  const p = paramsSchema.parse(rawParams);
  const excluded = p.excludeComplexName?.trim() ? normalizeName(p.excludeComplexName) : undefined;

  const groups = new Map<string, { name: string; amounts: number[] }>();
  for (const r of records) {
    if (r.cancelled || !r.complexName?.trim()) continue;
    if (Math.abs(r.areaM2 - p.targetAreaM2) > p.areaToleranceM2) continue;
    const months = monthsBetween(r.dealDate, p.asOf);
    if (months < 0 || months > p.windowMonths) continue;
    const key = normalizeName(r.complexName);
    if (key === excluded) continue;
    const g = groups.get(key) ?? { name: r.complexName.trim(), amounts: [] };
    g.amounts.push(r.amountWon);
    groups.set(key, g);
  }

  const out: SimilarComplex[] = [];
  for (const g of groups.values()) {
    if (g.amounts.length < p.minTrades) continue;
    const med = medianWon(g.amounts);
    out.push({
      complexName: g.name,
      medianWon: med,
      count: g.amounts.length,
      minWon: Math.min(...g.amounts),
      maxWon: Math.max(...g.amounts),
      diffPercent:
        p.referenceWon === undefined
          ? undefined
          : Math.round(((med - p.referenceWon) / p.referenceWon) * 1000) / 10,
    });
  }
  const ref = p.referenceWon;
  out.sort((a, b) =>
    ref === undefined
      ? b.count - a.count || a.complexName.localeCompare(b.complexName, 'ko')
      : Math.abs(a.medianWon - ref) - Math.abs(b.medianWon - ref) ||
        a.complexName.localeCompare(b.complexName, 'ko'),
  );
  return out.slice(0, p.limit);
}
