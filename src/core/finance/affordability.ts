import { monthlyPayment, mulPercent, principalFromAnnualPayment } from './money';
import { affordabilityInputSchema } from './types';
import type { AffordabilityInput, LoanAssumptions } from './types';

export type Bottleneck = 'ltv' | 'dsr' | 'product';

export interface LoanScenario {
  /** DSR 계산에 쓴 금리(%) */
  dsrRatePercent: number;
  byLtv: number;
  byDsr: number;
  byProductCap?: number;
  /** min(LTV 한도, DSR 한도, 상품 한도) */
  estimated: number;
  /** 가장 낮아 한도를 결정한 항목 (동률이면 ltv > dsr > product) */
  bottleneck: Bottleneck;
}

export interface FundItem {
  label: string;
  amount: number;
}

export interface FundingPlan {
  items: FundItem[];
  /** 총 필요 자금 = 가격 + 부대비용 */
  totalRequired: number;
  /** 실제 대출 반영액 = min(추정 대출, 가격). 대출은 부대비용을 충당하지 못한다고 본다 */
  loanUsed: number;
  /** 필요 자기자금 = 총 필요 자금 − 대출 반영액 */
  ownFundsNeeded: number;
  /** 보유 자산 − 필요 자기자금. 음수면 부족액 */
  surplus: number;
  /** 계약금(자기자금)과 잔금 시점 필요 현금 (계약금 비율이 있을 때) */
  timeline?: { atContract: number; atBalance: number };
}

export interface Affordability {
  base: LoanScenario;
  conservative: LoanScenario;
  /** 기준 시나리오 대출액 기준 자금 계획 */
  fundingBase: FundingPlan;
  /** 보수 시나리오 대출액 기준 자금 계획 */
  fundingConservative: FundingPlan;
  /** 기준 시나리오 대출 월 상환액(원) */
  monthlyPayment: number;
  /** (신규 연 상환액 + 기존 연 상환액) / 연소득 × 100, 소득 0이면 null */
  debtServicePercent: number | null;
}

/** 대출 한도 추정 (PRD §5.5). 기준·보수(DSR 금리에 가산 금리 적용) 두 시나리오 */
export function estimateLoanScenario(
  collateralValue: number,
  seniorClaims: number,
  profile: AffordabilityInput['profile'],
  loan: LoanAssumptions,
  dsrRatePercent: number,
): LoanScenario {
  const byLtv = Math.max(0, mulPercent(collateralValue, loan.ltvLimitPercent) - seniorClaims);

  const allowedAnnual = Math.max(
    0,
    mulPercent(profile.annualIncome, loan.dsrLimitPercent) - profile.existingAnnualDebtPayment,
  );
  const byDsr = principalFromAnnualPayment(
    allowedAnnual,
    dsrRatePercent,
    loan.dsrTermMonths ?? loan.termMonths,
  );

  const byProductCap = loan.productCap;
  const candidates: [Bottleneck, number][] = [
    ['ltv', byLtv],
    ['dsr', byDsr],
  ];
  if (byProductCap !== undefined) candidates.push(['product', byProductCap]);

  // 동률이면 앞선 항목(ltv > dsr > product)을 병목으로 본다
  const [bottleneck, estimated] = candidates.reduce((min, cur) => (cur[1] < min[1] ? cur : min));
  return { dsrRatePercent, byLtv, byDsr, byProductCap, estimated, bottleneck };
}

/** 필요 자금 항목 산출 (PRD §5.6). 입력하지 않은 비용은 0원 */
export function requiredFundItems(input: Pick<AffordabilityInput, 'kind' | 'amount' | 'costs'>): FundItem[] {
  const c = input.costs ?? {};
  const isSale = input.kind === 'sale';
  const items: FundItem[] = [{ label: isSale ? '매매가' : '보증금', amount: input.amount }];

  if (isSale) {
    items.push({ label: '취득세 등', amount: mulPercent(input.amount, c.acquisitionTaxRatePercent ?? 0) });
  }
  items.push({
    label: '중개보수',
    amount: c.brokerFeeOverrideWon ?? mulPercent(input.amount, c.brokerFeeRatePercent ?? 0),
  });
  if (input.kind === 'jeonse') {
    items.push({ label: '보증보험료', amount: mulPercent(input.amount, c.guaranteeFeeRatePercent ?? 0) });
  }
  items.push({ label: '등기·법무사 등 비용', amount: c.registrationCostsWon ?? 0 });
  items.push({ label: '이사·수리 등 기타', amount: c.otherCostsWon ?? 0 });
  return items;
}

export function buildFundingPlan(input: AffordabilityInput, estimatedLoan: number): FundingPlan {
  const items = requiredFundItems(input);
  const totalRequired = items.reduce((sum, i) => sum + i.amount, 0);
  const loanUsed = Math.min(estimatedLoan, input.amount);
  const ownFundsNeeded = totalRequired - loanUsed;

  const plan: FundingPlan = {
    items,
    totalRequired,
    loanUsed,
    ownFundsNeeded,
    surplus: input.profile.assets - ownFundsNeeded,
  };

  if (input.downPaymentPercent !== undefined) {
    // 계약금은 자기자금, 대출은 잔금 시점에 실행되고 부대비용도 잔금 시점에 낸다고 단순화한다
    const atContract = Math.min(mulPercent(input.amount, input.downPaymentPercent), ownFundsNeeded);
    plan.timeline = { atContract, atBalance: ownFundsNeeded - atContract };
  }
  return plan;
}

/** 입력을 검증하고 대출 가능액·필요 자금·자산 대비 과부족·상환 부담을 한 번에 계산한다 (순수 함수) */
export function evaluateAffordability(rawInput: unknown): Affordability {
  const input = affordabilityInputSchema.parse(rawInput);
  const seniorClaims = input.seniorClaims ?? 0;
  const { loan, profile } = input;

  const base = estimateLoanScenario(
    input.collateralValue,
    seniorClaims,
    profile,
    loan,
    loan.annualRatePercent,
  );
  const conservative = estimateLoanScenario(
    input.collateralValue,
    seniorClaims,
    profile,
    loan,
    loan.annualRatePercent + loan.stressAddPercent,
  );

  const fundingBase = buildFundingPlan(input, base.estimated);
  const fundingConservative = buildFundingPlan(input, conservative.estimated);

  const payment = monthlyPayment(fundingBase.loanUsed, loan.annualRatePercent, loan.termMonths);
  const debtServicePercent =
    profile.annualIncome === 0
      ? null
      : Math.round(((payment * 12 + profile.existingAnnualDebtPayment) * 1000) / profile.annualIncome) / 10;

  return {
    base,
    conservative,
    fundingBase,
    fundingConservative,
    monthlyPayment: payment,
    debtServicePercent,
  };
}
