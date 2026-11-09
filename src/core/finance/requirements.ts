import { z } from 'zod';
import { requiredFundItems } from './affordability';
import type { FundItem } from './affordability';
import { monthlyPayment, mulPercent } from './money';
import { costAssumptionsSchema, loanAssumptionsSchema } from './types';
import { wonSchema } from '../types';

/**
 * "이 가격이면 연소득과 자산이 얼마나 필요한가" (역산, PRD §5.5·§5.6 확장).
 * 내 재무 정보 없이 매물 조건과 대출 기준값만으로 계산한다. 기준값은 사용자가 입력한다 (ADR-0007).
 */
export const requirementsInputSchema = z.object({
  kind: z.enum(['jeonse', 'monthly', 'sale']),
  amount: z.number().int().positive().refine(Number.isSafeInteger),
  collateralValue: z.number().int().positive().refine(Number.isSafeInteger),
  seniorClaims: wonSchema.optional(),
  /** 이미 갚고 있는 대출의 연 원리금 (DSR 에 합산) */
  existingAnnualDebtPayment: wonSchema.optional(),
  loan: loanAssumptionsSchema,
  costs: costAssumptionsSchema.optional(),
});
export type RequirementsInput = z.infer<typeof requirementsInputSchema>;

export type MaxLoanBottleneck = 'ltv' | 'product' | 'price';

export interface RequirementRow {
  /** 받을 수 있는 최대 대출 대비 비율(%) */
  loanSharePercent: number;
  loan: number;
  /** 총 필요 자금 − 대출 = 있어야 하는 자기자금 */
  ownFundsNeeded: number;
  /** 예상 월 상환액 (기준 금리, 원리금균등) */
  monthlyPayment: number;
  /** 이 대출을 DSR 한도 안에서 받기 위한 최소 연소득 (기준 금리) */
  minIncomeBase: number;
  /** 같은 계산에 스트레스 가산 금리를 더한 최소 연소득 */
  minIncomeConservative: number;
}

export interface Requirements {
  items: FundItem[];
  totalRequired: number;
  /** LTV 한도로 계산한 대출 한도 (가격 상한 적용 전) */
  maxLoanByLtv: number;
  /** min(LTV 한도, 상품 한도, 가격) */
  maxLoan: number;
  maxLoanBottleneck: MaxLoanBottleneck;
  /** 대출을 얼마나 받느냐에 따른 필요 자기자금·연소득 */
  rows: RequirementRow[];
}

const SHARES = [100, 80, 60, 40, 20, 0] as const;

/** 필요 연소득 = (신규 대출 연 원리금 + 기존 대출 연 원리금) / DSR 한도, 올림 */
function minIncome(
  loan: number,
  ratePercent: number,
  termMonths: number,
  dsrPercent: number,
  existing: number,
): number {
  const annual = monthlyPayment(loan, ratePercent, termMonths) * 12 + existing;
  return Math.ceil((annual * 100) / dsrPercent);
}

export function evaluateRequirements(rawInput: unknown): Requirements {
  const input = requirementsInputSchema.parse(rawInput);
  const { loan } = input;
  const existing = input.existingAnnualDebtPayment ?? 0;

  const items = requiredFundItems(input);
  const totalRequired = items.reduce((sum, i) => sum + i.amount, 0);

  const maxLoanByLtv = Math.max(
    0,
    mulPercent(input.collateralValue, loan.ltvLimitPercent) - (input.seniorClaims ?? 0),
  );
  const candidates: [MaxLoanBottleneck, number][] = [['ltv', maxLoanByLtv]];
  if (loan.productCap !== undefined) candidates.push(['product', loan.productCap]);
  candidates.push(['price', input.amount]);
  // 동률이면 앞선 항목(ltv > product > price)을 병목으로 본다
  const [maxLoanBottleneck, maxLoan] = candidates.reduce((min, cur) => (cur[1] < min[1] ? cur : min));

  const dsrTerm = loan.dsrTermMonths ?? loan.termMonths;
  const rows = SHARES.map((share): RequirementRow => {
    const l = mulPercent(maxLoan, share);
    return {
      loanSharePercent: share,
      loan: l,
      ownFundsNeeded: totalRequired - l,
      monthlyPayment: monthlyPayment(l, loan.annualRatePercent, loan.termMonths),
      minIncomeBase: minIncome(l, loan.annualRatePercent, dsrTerm, loan.dsrLimitPercent, existing),
      minIncomeConservative: minIncome(
        l,
        loan.annualRatePercent + loan.stressAddPercent,
        dsrTerm,
        loan.dsrLimitPercent,
        existing,
      ),
    };
  });

  return { items, totalRequired, maxLoanByLtv, maxLoan, maxLoanBottleneck, rows };
}
