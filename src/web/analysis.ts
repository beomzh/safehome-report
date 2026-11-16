import {
  evaluateAffordability,
  evaluateRequirements,
  evaluateRisk,
  evaluateVerdict,
  policyAssumptions,
  recommendLoans,
} from '../core';
import type {
  Affordability,
  Recommendation,
  Requirements,
  RiskInput,
  RiskReport,
  VerdictResult,
} from '../core';
import { buildRiskInput, todayIso } from './form';
import type { FormState } from './form';
import { buildFinancePlan } from './financeForm';
import type { FinanceFormState } from './financeForm';
import { LOAN_ELIGIBILITY } from './loanEligibility';
import { rateInfoFor } from './loanRates';
import { LOAN_PRODUCTS } from './loans';
import { applyPolicyBasis } from './policyFinance';
import { buildLoanDeal, toLoanProfile } from './profile';
import type { ProfileState } from './profile';
import { rulesConfig } from './rulesConfig';

export interface AnalysisResult {
  report: RiskReport;
  input: RiskInput;
  finance?: Affordability;
  requirements?: Requirements;
  costNotes?: string[];
  assumptionNotes?: string[];
  verdict: VerdictResult;
  loanRecs: Recommendation[];
}

export type AnalysisOutcome = { ok: true; result: AnalysisResult } | { ok: false; errors: string[] };

/**
 * 입력(폼·재무·내 상황)으로 위험 점검, 대출 후보 추천, 필요 조건, 방문 전 결론을 한 번에 계산한다.
 * 모두 브라우저 안의 순수 계산이며 입력이 네트워크로 나가지 않는다. 방문 전 점검(실시간)과 정밀 분석이 같이 쓴다.
 */
export function runAnalysis(
  form: FormState,
  fin: FinanceFormState,
  profile: ProfileState,
  asOf = todayIso(),
): AnalysisOutcome {
  const built = buildRiskInput(form, asOf);
  const errs: string[] = built.ok ? [] : [...built.errors];

  // 대출 후보 추천(공식 요건)을 먼저 구해, 해당할 수 있는 정책 대출이 있으면 그 상품의 공식 조건을 계산 기준값으로 쓴다
  let loanRecs: Recommendation[] = [];
  let effectiveFin = fin;
  let policyNotes: string[] = [];
  if (built.ok) {
    const loanProfile = toLoanProfile(profile, fin.annualIncomeManwon);
    const deal = buildLoanDeal({
      kind: built.input.contract.kind,
      amountWon: built.input.contract.amount,
      monthlyRentManwon: fin.monthlyRentManwon,
      lawdCd: form.lookupLawdCd,
      areaM2: form.lookupAreaM2,
    });
    loanRecs = recommendLoans(LOAN_ELIGIBILITY.products, loanProfile, deal, rateInfoFor);
    const top = loanRecs.find(
      (r) =>
        r.status !== 'unlikely' &&
        LOAN_ELIGIBILITY.products.find((p) => p.productId === r.productId)?.financing,
    );
    const topProduct = top && LOAN_ELIGIBILITY.products.find((p) => p.productId === top.productId);
    const policy =
      topProduct && policyAssumptions(topProduct, loanProfile, deal, rateInfoFor(topProduct.productId));
    if (policy && topProduct) {
      const name = LOAN_PRODUCTS.find((l) => l.id === topProduct.productId)?.name ?? topProduct.productId;
      const applied = applyPolicyBasis(fin, policy, name);
      effectiveFin = applied.fin;
      policyNotes = applied.notes;
    }
  }

  let finance: Affordability | undefined;
  let requirements: Requirements | undefined;
  let costNotes: string[] = [];
  let assumptionNotes: string[] = [];
  let dsrLimitPercent: number | undefined;
  if (fin.enabled && built.ok) {
    const plan = buildFinancePlan(
      effectiveFin,
      {
        kind: built.input.contract.kind,
        amountWon: built.input.contract.amount,
        marketWon: built.input.market?.estimatedValue,
        housing: form.lookupHousing,
        areaM2: /^\d+(\.\d+)?$/.test(form.lookupAreaM2.trim()) ? Number(form.lookupAreaM2) : undefined,
      },
      rulesConfig,
    );
    if (!plan.ok) errs.push(...plan.errors);
    else {
      requirements = evaluateRequirements(plan.requirements);
      dsrLimitPercent = plan.requirements.loan.dsrLimitPercent;
      costNotes = plan.costNotes;
      assumptionNotes = [...policyNotes, ...plan.assumptionNotes];
      if (plan.affordability) finance = evaluateAffordability(plan.affordability);
    }
  }

  if (!built.ok || errs.length > 0) return { ok: false, errors: errs };

  const report = evaluateRisk(built.input, rulesConfig);
  return {
    ok: true,
    result: {
      report,
      verdict: evaluateVerdict(
        {
          kind: built.input.contract.kind,
          amountWon: built.input.contract.amount,
          marketWon: built.input.market?.estimatedValue,
          marketConfidence: built.input.market?.confidence,
          grade: report.grade,
          affordability: finance,
          dsrLimitPercent,
        },
        rulesConfig,
      ),
      input: built.input,
      loanRecs,
      finance,
      requirements,
      costNotes,
      assumptionNotes,
    },
  };
}
