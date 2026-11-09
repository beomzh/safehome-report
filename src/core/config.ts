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

/** 중개보수 구간. underWon 미만이면 이 구간(마지막 구간은 underWon 없음) */
const brokerageBandSchema = z.object({
  underWon: z.number().int().positive().optional(),
  ratePercent: z.number().positive(),
  capWon: z.number().int().positive().optional(),
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
  /** 주택 유상취득 취득세 표준세율과 부가세 (지방세법 제11조 제1항 제8호). 중과는 계산하지 않는다 */
  acquisitionTax: sourcedSchema.extend({
    /** 이 금액 이하는 lowRatePercent */
    lowerLimitWon: z.number().int().positive(),
    /** 이 금액 이상은 highRatePercent. 사이 구간은 선형 산식 */
    upperLimitWon: z.number().int().positive(),
    lowRatePercent: z.number().positive(),
    highRatePercent: z.number().positive(),
    /** 지방교육세 = 취득세율의 이 비율(표준세율의 50%에 20%를 곱한 값 = 10%) */
    localEducationShareOfRate: z.number().positive(),
    /** 이 전용면적(㎡)을 초과하면 농어촌특별세 */
    ruralSpecialAboveAreaM2: z.number().positive(),
    ruralSpecialPercent: z.number().nonnegative(),
  }),
  /** 중개보수 상한 요율표 (시·도 조례로 정해지므로 지역별로 다를 수 있다) */
  brokerage: sourcedSchema.extend({
    sale: z.array(brokerageBandSchema).min(1),
    lease: z.array(brokerageBandSchema).min(1),
    /** 월세 환산: 보증금 + 월세 × multiplier. 환산액이 thresholdWon 미만이면 multiplierBelowThreshold 를 쓴다 */
    monthlyRentMultiplier: z.number().positive(),
    monthlyRentMultiplierBelowThreshold: z.number().positive(),
    monthlyRentThresholdWon: z.number().int().positive(),
  }),
});
export type RulesConfig = z.infer<typeof rulesConfigSchema>;
