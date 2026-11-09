import { z } from 'zod';
import { wonSchema } from '../types';

const percentSchema = z.number().min(0).max(100);
const positiveWon = z.number().int().positive().refine(Number.isSafeInteger);

/** 사용자의 재무 프로필. 로컬에서만 사용하며 LLM·로그·공유 사본에 포함하지 않는다 */
export const financeProfileSchema = z.object({
  /** 동원 가능한 자기자금(현금·예금 등) */
  assets: wonSchema,
  annualIncome: wonSchema,
  /** 기존 대출의 연간 원리금 상환액 합계 */
  existingAnnualDebtPayment: wonSchema,
});
export type FinanceProfile = z.infer<typeof financeProfileSchema>;

/**
 * 대출 기준값. 규제·금융기관마다 달라 기본값을 제공하지 않고 호출자가 반드시 입력한다
 * (금융기관 안내값 등 출처를 사용자가 확인). 앱은 계산만 한다 (ADR-0007).
 */
export const loanAssumptionsSchema = z.object({
  ltvLimitPercent: z.number().positive().max(100),
  dsrLimitPercent: z.number().positive().max(100),
  annualRatePercent: percentSchema,
  /** 보수 시나리오에서 DSR 계산 금리에 더하는 가산 금리 */
  stressAddPercent: percentSchema,
  termMonths: z.number().int().positive().max(600),
  /** DSR 계산에 쓰는 만기. 없으면 termMonths */
  dsrTermMonths: z.number().int().positive().max(600).optional(),
  /** 상품·기관 한도(예: 보증기관 한도). 없으면 적용하지 않음 */
  productCap: wonSchema.optional(),
});
export type LoanAssumptions = z.infer<typeof loanAssumptionsSchema>;

/** 부대비용 기준값. 모두 호출자가 입력하며 입력하지 않은 항목은 0원으로 본다 */
export const costAssumptionsSchema = z.object({
  /** 매매 취득세 등 세금 비율(%) */
  acquisitionTaxRatePercent: percentSchema.optional(),
  /** 취득세·지방교육세·농어촌특별세 합계 금액. 있으면 비율보다 우선 (법정 계산 결과를 넘길 때 사용) */
  acquisitionTaxOverrideWon: wonSchema.optional(),
  /** 중개보수 요율(%). brokerFeeOverrideWon 이 있으면 그 금액을 쓴다 */
  brokerFeeRatePercent: percentSchema.optional(),
  brokerFeeOverrideWon: wonSchema.optional(),
  /** 전세보증보험료 요율(%) — 전세만 */
  guaranteeFeeRatePercent: percentSchema.optional(),
  /** 법무사·등기·채권 비용 등 */
  registrationCostsWon: wonSchema.optional(),
  /** 이사·수리 등 기타 */
  otherCostsWon: wonSchema.optional(),
});
export type CostAssumptions = z.infer<typeof costAssumptionsSchema>;

export const affordabilityInputSchema = z.object({
  kind: z.enum(['jeonse', 'monthly', 'sale']),
  /** 전세·월세는 보증금, 매매는 매매가 */
  amount: positiveWon,
  /** 대출 담보가치 (매매: 매매가·시세 중 낮은 값, 전세: 보증금 등 상품 기준) */
  collateralValue: positiveWon,
  /** 대출 한도에서 차감할 선순위 채권(등기부 근저당 채권최고액 합). 없으면 0 */
  seniorClaims: wonSchema.optional(),
  profile: financeProfileSchema,
  loan: loanAssumptionsSchema,
  costs: costAssumptionsSchema.optional(),
  /** 계약금 비율(%). 있으면 시점별 현금 필요액을 계산 */
  downPaymentPercent: percentSchema.optional(),
});
export type AffordabilityInput = z.infer<typeof affordabilityInputSchema>;
