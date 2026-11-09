import { affordabilityInputSchema } from '../core';
import type { AffordabilityInput } from '../core';
import { parseManwon } from './form';
import type { Kind } from './form';

/**
 * 대출·자금 계획 입력. 규제·금융기관별로 달라 기본값을 제공하지 않고 사용자가 직접 입력한다 (ADR-0007).
 * 재무 정보(자산·소득)는 브라우저 메모리에서만 쓰고 저장·전송하지 않는다.
 */
export interface FinanceFormState {
  enabled: boolean;
  assetsManwon: string;
  annualIncomeManwon: string;
  existingAnnualDebtManwon: string;
  ltvLimitPercent: string;
  dsrLimitPercent: string;
  annualRatePercent: string;
  stressAddPercent: string;
  termYears: string;
  productCapManwon: string;
  acquisitionTaxPercent: string;
  brokerFeePercent: string;
  brokerFeeOverrideManwon: string;
  guaranteeFeePercent: string;
  registrationCostsManwon: string;
  otherCostsManwon: string;
  downPaymentPercent: string;
}

export const emptyFinanceForm = (): FinanceFormState => ({
  enabled: false,
  assetsManwon: '',
  annualIncomeManwon: '',
  existingAnnualDebtManwon: '',
  ltvLimitPercent: '',
  dsrLimitPercent: '',
  annualRatePercent: '',
  stressAddPercent: '',
  termYears: '',
  productCapManwon: '',
  acquisitionTaxPercent: '',
  brokerFeePercent: '',
  brokerFeeOverrideManwon: '',
  guaranteeFeePercent: '',
  registrationCostsManwon: '',
  otherCostsManwon: '',
  downPaymentPercent: '',
});

/** "4.5" 같은 비율(%) 문자열. 소수 넷째 자리까지, 0~100 */
export function parsePercent(raw: string): { ok: true; value: number } | { ok: false } {
  const s = raw.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(s)) return { ok: false };
  const value = Number(s);
  return value <= 100 ? { ok: true, value } : { ok: false };
}

export interface FinanceContext {
  kind: Kind;
  /** 보증금 또는 매매가 (원) */
  amountWon: number;
  /** 입력된 시세 (원). 매매 담보가치 산정에 사용 */
  marketWon?: number;
}

export type FinanceBuildResult = { ok: true; input: AffordabilityInput } | { ok: false; errors: string[] };

export function buildAffordabilityInput(form: FinanceFormState, ctx: FinanceContext): FinanceBuildResult {
  const errors: string[] = [];

  const reqWon = (label: string, raw: string): number => {
    const p = parseManwon(raw);
    if (!raw.trim()) errors.push(`${label}을(를) 입력하세요.`);
    else if (!p.ok) errors.push(`${label}은(는) 만원 단위 정수로 입력하세요.`);
    return p.ok ? p.won : 0;
  };
  const optWon = (label: string, raw: string): number | undefined => {
    if (!raw.trim()) return undefined;
    const p = parseManwon(raw);
    if (!p.ok) {
      errors.push(`${label}은(는) 만원 단위 정수로 입력하세요.`);
      return undefined;
    }
    return p.won;
  };
  const reqPct = (label: string, raw: string): number => {
    const p = parsePercent(raw);
    if (!raw.trim()) errors.push(`${label}을(를) 입력하세요.`);
    else if (!p.ok) errors.push(`${label}은(는) 0~100 사이 숫자(소수 4자리까지)로 입력하세요.`);
    return p.ok ? p.value : 0;
  };
  const optPct = (label: string, raw: string): number | undefined => {
    if (!raw.trim()) return undefined;
    const p = parsePercent(raw);
    if (!p.ok) {
      errors.push(`${label}은(는) 0~100 사이 숫자(소수 4자리까지)로 입력하세요.`);
      return undefined;
    }
    return p.value;
  };

  const assets = reqWon('보유 자산(자기자금)', form.assetsManwon);
  const annualIncome = reqWon('연소득', form.annualIncomeManwon);
  const existingAnnualDebtPayment = optWon('기존 대출 연 상환액', form.existingAnnualDebtManwon) ?? 0;

  const ltvLimitPercent = reqPct('LTV 한도(%)', form.ltvLimitPercent);
  const dsrLimitPercent = reqPct('DSR 한도(%)', form.dsrLimitPercent);
  const annualRatePercent = reqPct('예상 금리(%)', form.annualRatePercent);
  const stressAddPercent = optPct('스트레스 가산 금리(%)', form.stressAddPercent) ?? 0;
  if (ltvLimitPercent === 0 && form.ltvLimitPercent.trim() && !errors.some((e) => e.startsWith('LTV'))) {
    errors.push('LTV 한도(%)는 0보다 커야 합니다.');
  }
  if (dsrLimitPercent === 0 && form.dsrLimitPercent.trim() && !errors.some((e) => e.startsWith('DSR'))) {
    errors.push('DSR 한도(%)는 0보다 커야 합니다.');
  }

  let termMonths = 0;
  if (!form.termYears.trim()) errors.push('대출 기간(년)을 입력하세요.');
  else if (
    !/^\d{1,2}$/.test(form.termYears.trim()) ||
    Number(form.termYears) < 1 ||
    Number(form.termYears) > 50
  ) {
    errors.push('대출 기간은 1~50년 사이 정수로 입력하세요.');
  } else termMonths = Number(form.termYears) * 12;

  const productCap = optWon('상품·기관 한도', form.productCapManwon);

  const costs = {
    acquisitionTaxRatePercent: optPct('취득세 등 비율(%)', form.acquisitionTaxPercent),
    brokerFeeRatePercent: optPct('중개보수 요율(%)', form.brokerFeePercent),
    brokerFeeOverrideWon: optWon('중개보수 금액', form.brokerFeeOverrideManwon),
    guaranteeFeeRatePercent: optPct('보증보험료 요율(%)', form.guaranteeFeePercent),
    registrationCostsWon: optWon('등기·법무사 비용', form.registrationCostsManwon),
    otherCostsWon: optWon('이사·수리 등 기타 비용', form.otherCostsManwon),
  };
  const downPaymentPercent = optPct('계약금 비율(%)', form.downPaymentPercent);

  if (errors.length > 0) return { ok: false, errors };

  // 담보가치: 매매는 매매가와 시세 중 낮은 값, 전세·월세는 보증금.
  // 선순위 채권은 차감하지 않는다 (매매 시 매도인의 기존 근저당은 잔금 때 말소되고, 전세대출 한도와도 무관)
  const collateralValue =
    ctx.kind === 'sale' && ctx.marketWon !== undefined
      ? Math.min(ctx.amountWon, ctx.marketWon)
      : ctx.amountWon;

  const parsed = affordabilityInputSchema.safeParse({
    kind: ctx.kind,
    amount: ctx.amountWon,
    collateralValue,
    profile: { assets, annualIncome, existingAnnualDebtPayment },
    loan: { ltvLimitPercent, dsrLimitPercent, annualRatePercent, stressAddPercent, termMonths, productCap },
    costs,
    downPaymentPercent,
  });
  if (!parsed.success) {
    return { ok: false, errors: ['대출·자금 계획 입력값이 올바르지 않습니다. 금액과 비율을 확인하세요.'] };
  }
  return { ok: true, input: parsed.data };
}
