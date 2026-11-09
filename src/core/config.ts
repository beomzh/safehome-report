import { z } from 'zod';
import { isoDateSchema } from './types';

/**
 * 임계치·기준값은 코드가 아니라 rules.config/*.json 에서 관리한다 (ADR-0004).
 * 모든 값은 출처(source)와 검증 상태(status)를 가진다.
 * status 가 provisional 인 값은 M0에서 근거 문서와 대조하기 전까지 잠정치다.
 */
const sourcedSchema = z.object({
  status: z.enum(['provisional', 'verified']),
  source: z.string().min(1),
});

export const rulesConfigSchema = z.object({
  rulesetVersion: z.number().int().positive(),
  effectiveFrom: isoDateSchema,
  /** 등기부 파싱 신뢰도가 이 값 미만이면 등기부 기반 룰은 판단 보류(unknown) */
  minParseConfidence: sourcedSchema.extend({ value: z.number().min(0).max(1) }),
  ltv: sourcedSchema.extend({
    /** 이 비율(%) 초과 → 주의(yellow) */
    cautionAbovePercent: z.number().positive(),
    /** 이 비율(%) 초과 → 위험(red) */
    dangerAbovePercent: z.number().positive(),
  }),
  frequentTransfer: sourcedSchema.extend({
    windowMonths: z.number().int().positive(),
    minCount: z.number().int().positive(),
  }),
  /** 실거래 기반 시세 추정 기준 (src/core/market) */
  marketEstimate: sourcedSchema.extend({
    /** 최근 N개월 거래만 사용 */
    windowMonths: z.number().int().positive(),
    /** 이 건수 미만이면 신뢰도 low */
    minSamples: z.number().int().positive(),
    /** 목표 전용면적 ± 이 값(㎡) 안의 거래만 사용 */
    areaToleranceM2: z.number().nonnegative(),
  }),
});
export type RulesConfig = z.infer<typeof rulesConfigSchema>;
