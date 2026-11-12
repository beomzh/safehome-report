import {
  acquisitionTax,
  affordabilityInputSchema,
  brokerageFee,
  propertyTax,
  requirementsInputSchema,
} from '../core';
import type { AffordabilityInput, RequirementsInput, RulesConfig } from '../core';
import { formatWon } from './present';
import { parseManwon } from './form';
import type { Kind } from './form';

/**
 * 대출·자금 계획 입력. 규제·금융기관별로 달라 기본값을 제공하지 않고 사용자가 직접 입력한다 (ADR-0007).
 * 재무 정보(자산·소득)는 브라우저 메모리에서만 쓰고 저장·전송하지 않는다.
 */
export interface FinanceFormState {
  enabled: boolean;
  /** 취득세·중개보수를 법정 요율로 자동 계산 (직접 입력한 값이 있으면 그 값을 우선) */
  autoCosts: boolean;
  /** 월세 금액(만원) — 월세 중개보수 환산에 사용 */
  monthlyRentManwon: string;
  /** 매매 주택의 공시가격(만원) — 재산세 계산용. 비우면 보유세를 계산하지 않는다 */
  publicPriceManwon: string;
  /** 1세대 1주택 여부 (재산세 특례세율) */
  singleHome: boolean;
  /** AI 제안으로 채워진 대출 기준값 칸 이름들. 사용자가 그 칸을 직접 고치면 목록에서 빠진다. 리포트에 공식 값이 아님을 표시한다 */
  aiFields: string[];
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
  autoCosts: true,
  monthlyRentManwon: '',
  publicPriceManwon: '',
  singleHome: false,
  aiFields: [],
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

/** 처음 화면에 채워 두는 예시 가정. 공식 값이 아니며 리포트에 그렇게 표시한다 */
export const EXAMPLE_ASSUMPTIONS = {
  ltvLimitPercent: '70',
  dsrLimitPercent: '40',
  annualRatePercent: '4',
  stressAddPercent: '1.5',
  termYears: '30',
} as const;

/** 필요 조건 계산을 처음부터 보여주기 위한 초기값 (자산·소득은 비움) */
export const defaultFinanceForm = (): FinanceFormState => ({
  ...emptyFinanceForm(),
  enabled: true,
  ...EXAMPLE_ASSUMPTIONS,
});

const usesExample = (f: FinanceFormState): boolean =>
  (Object.keys(EXAMPLE_ASSUMPTIONS) as (keyof typeof EXAMPLE_ASSUMPTIONS)[]).every(
    (k) => f[k] === EXAMPLE_ASSUMPTIONS[k],
  );

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
  /** 전용면적(㎡). 취득세의 농어촌특별세 판단에 사용 */
  areaM2?: number;
  /** 주택 유형. 오피스텔은 주택이 아니라 취득세·중개보수가 다르다 */
  housing?: 'apt' | 'rowhouse' | 'officetel' | 'house';
}

export type FinanceBuildResult = { ok: true; input: AffordabilityInput } | { ok: false; errors: string[] };

function makeParsers(errors: string[]) {
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
  return { reqWon, optWon, reqPct, optPct };
}

/** 대출 기준값·부대비용·기존 대출처럼 내 자산·소득과 무관한 입력을 해석한다 */
type CostConfig = Pick<RulesConfig, 'acquisitionTax' | 'brokerage' | 'propertyTax'>;

function parseCommon(form: FinanceFormState, ctx: FinanceContext, errors: string[], config?: CostConfig) {
  const { optWon, reqPct, optPct } = makeParsers(errors);
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
  const costs: Record<string, number | undefined> = {
    acquisitionTaxRatePercent: optPct('취득세 등 비율(%)', form.acquisitionTaxPercent),
    brokerFeeRatePercent: optPct('중개보수 요율(%)', form.brokerFeePercent),
    brokerFeeOverrideWon: optWon('중개보수 금액', form.brokerFeeOverrideManwon),
    guaranteeFeeRatePercent: optPct('보증보험료 요율(%)', form.guaranteeFeePercent),
    registrationCostsWon: optWon('등기·법무사 비용', form.registrationCostsManwon),
    otherCostsWon: optWon('이사·수리 등 기타 비용', form.otherCostsManwon),
  };
  const downPaymentPercent = optPct('계약금 비율(%)', form.downPaymentPercent);
  const monthlyRentWon = optWon('월세', form.monthlyRentManwon);

  // 법정 요율 자동 계산: 직접 입력한 값이 있으면 그 값을 우선한다
  const costNotes: string[] = [];
  if (form.autoCosts && config) {
    if (ctx.kind === 'sale' && costs.acquisitionTaxRatePercent === undefined && ctx.housing === 'officetel') {
      // 오피스텔은 주택이 아니라 건축물 취득세율 4% + 지방교육세 0.4% + 농어촌특별세 0.2% (잠정, 원문 미확인)
      costs.acquisitionTaxOverrideWon = Math.floor((ctx.amountWon * 46) / 1000);
      costNotes.push(
        `오피스텔 취득세 4.6%(취득세 4% + 지방교육세 0.4% + 농어촌특별세 0.2%) = ${formatWon(costs.acquisitionTaxOverrideWon)}. 주택 세율(1~3%)이 아니라 건축물 세율이 적용됩니다(잠정값, 공식 원문 미확인).`,
      );
    } else if (ctx.kind === 'sale' && costs.acquisitionTaxRatePercent === undefined) {
      const t = acquisitionTax(ctx.amountWon, ctx.areaM2, config.acquisitionTax);
      costs.acquisitionTaxOverrideWon = t.total;
      costNotes.push(
        `취득세 ${t.taxRatePercent}% = ${formatWon(t.acquisitionTax)} + 지방교육세 ${formatWon(t.localEducationTax)} + 농어촌특별세 ${formatWon(t.ruralSpecialTax)} → ${formatWon(t.total)}`,
        ...t.notes,
      );
    }
    if (
      costs.brokerFeeRatePercent === undefined &&
      costs.brokerFeeOverrideWon === undefined &&
      ctx.housing === 'officetel' &&
      ctx.kind !== 'monthly'
    ) {
      // 주거용 오피스텔(전용 85㎡ 이하·입식 부엌·화장실) 상한 요율: 매매 0.5%, 임대차 0.4% (잠정, 원문 미확인)
      const rate = ctx.kind === 'sale' ? 5 : 4;
      costs.brokerFeeOverrideWon = Math.floor((ctx.amountWon * rate) / 1000);
      costNotes.push(
        `오피스텔 중개보수 상한 ${rate / 10}% = ${formatWon(costs.brokerFeeOverrideWon)} (주거용 오피스텔 기준, 부가세 별도·잠정값).`,
      );
    } else if (costs.brokerFeeRatePercent === undefined && costs.brokerFeeOverrideWon === undefined) {
      const b = brokerageFee(ctx.kind, ctx.amountWon, monthlyRentWon, config.brokerage);
      costs.brokerFeeOverrideWon = b.feeWon;
      costNotes.push(
        `중개보수 상한 ${b.ratePercent}%${b.capped ? ` (한도 ${formatWon(b.capWon ?? 0)} 적용)` : ''} = ${formatWon(b.feeWon)} (한 쪽 부담분)`,
        ...b.notes,
      );
    }
    if (ctx.kind === 'sale') {
      const publicPrice = optWon('공시가격', form.publicPriceManwon);
      if (publicPrice !== undefined && publicPrice > 0) {
        const p = propertyTax(publicPrice, form.singleHome, config.propertyTax);
        costNotes.push(
          `재산세(연, 필요 자금에는 포함하지 않음) 약 ${formatWon(p.totalWon)}: 과세표준 ${formatWon(p.taxBaseWon)}(공시가격 × ${p.fairMarketPercent}%) → 재산세 ${formatWon(p.propertyTaxWon)}(도시지역분 ${formatWon(p.urbanAreaWon)} 포함) + 지방교육세 ${formatWon(p.localEducationTaxWon)}${p.singleHomeApplied ? ' (1세대 1주택 특례 적용)' : ''}`,
          ...p.notes,
        );
      }
      if (publicPrice === undefined) costNotes.push('보유세는 공시가격을 입력하면 재산세만 계산합니다.');
      costNotes.push(
        '종합부동산세는 계산하지 않았습니다. 공시가격 합계가 1세대 1주택 12억 원(그 외 9억 원)을 넘을 때 대상이 되는 것으로 알려져 있으나 세제 개편이 진행 중이라 확정 값을 제공할 수 없습니다. 홈택스 계산기로 확인하세요.',
      );
    }
    costNotes.push(
      `요율표는 ${config.acquisitionTax.status === 'provisional' ? '잠정값(공식 원문으로 최종 확인 필요)' : '확인된 값'}입니다.`,
    );
  }

  // 담보가치: 매매는 매매가와 시세 중 낮은 값, 전세·월세는 보증금.
  // 선순위 채권은 차감하지 않는다 (매매 시 매도인의 기존 근저당은 잔금 때 말소되고, 전세대출 한도와도 무관)
  const collateralValue =
    ctx.kind === 'sale' && ctx.marketWon !== undefined
      ? Math.min(ctx.amountWon, ctx.marketWon)
      : ctx.amountWon;

  return {
    existingAnnualDebtPayment,
    loan: { ltvLimitPercent, dsrLimitPercent, annualRatePercent, stressAddPercent, termMonths, productCap },
    costs,
    downPaymentPercent,
    collateralValue,
    costNotes,
  };
}

const AI_FIELD_LABEL: Record<string, string> = {
  ltvLimitPercent: 'LTV 한도',
  dsrLimitPercent: 'DSR 한도',
  annualRatePercent: '예상 금리',
  stressAddPercent: '스트레스 가산 금리',
  termYears: '대출 기간',
};

/** AI 제안이 남아 있는 항목을 밝히는 리포트 주의 문구 */
export function aiAssumptionNote(fields: readonly string[]): string {
  const names = fields.map((k) => AI_FIELD_LABEL[k] ?? k).join(', ');
  return `다음 대출 기준값은 AI가 제안한 값입니다: ${names}. 공식 값이 아니며 최신 규제를 반영하지 못했을 수 있으니 은행·공식 안내의 값으로 다시 계산해 보세요.`;
}

const GENERIC_ERROR = '대출·자금 계획 입력값이 올바르지 않습니다. 금액과 비율을 확인하세요.';

export function buildAffordabilityInput(
  form: FinanceFormState,
  ctx: FinanceContext,
  config?: CostConfig,
): FinanceBuildResult {
  const errors: string[] = [];
  const { reqWon } = makeParsers(errors);
  const assets = reqWon('보유 자산(자기자금)', form.assetsManwon);
  const annualIncome = reqWon('연소득', form.annualIncomeManwon);
  const c = parseCommon(form, ctx, errors, config);
  if (errors.length > 0) return { ok: false, errors };

  const parsed = affordabilityInputSchema.safeParse({
    kind: ctx.kind,
    amount: ctx.amountWon,
    collateralValue: c.collateralValue,
    profile: { assets, annualIncome, existingAnnualDebtPayment: c.existingAnnualDebtPayment },
    loan: c.loan,
    costs: c.costs,
    downPaymentPercent: c.downPaymentPercent,
  });
  if (!parsed.success) return { ok: false, errors: [GENERIC_ERROR] };
  return { ok: true, input: parsed.data };
}

export type FinancePlanResult =
  | {
      ok: true;
      requirements: RequirementsInput;
      affordability?: AffordabilityInput;
      costNotes: string[];
      /** 대출 기준값의 출처에 대한 주의 (AI 제안 적용 시) */
      assumptionNotes: string[];
    }
  | { ok: false; errors: string[] };

/**
 * 대출·자금 계획 입력을 해석한다.
 * - 필요 조건(역산)은 대출 기준값만 있으면 계산한다.
 * - 보유 자산·연소득을 둘 다 입력하면 "내 상황" 판정(affordability)도 계산한다. 하나만 입력하면 그 판정은 건너뛰고
 *   "필요 조건"만 계산한다(연소득은 대출 추천용으로 맨 위에서 따로 입력하므로 오류로 막지 않는다).
 */
export function buildFinancePlan(
  form: FinanceFormState,
  ctx: FinanceContext,
  config?: CostConfig,
): FinancePlanResult {
  const errors: string[] = [];
  const hasAssets = form.assetsManwon.trim() !== '';
  const hasIncome = form.annualIncomeManwon.trim() !== '';
  const { reqWon } = makeParsers(errors);
  const assets = hasAssets && hasIncome ? reqWon('보유 자산(자기자금)', form.assetsManwon) : undefined;
  const annualIncome = hasAssets && hasIncome ? reqWon('연소득', form.annualIncomeManwon) : undefined;
  const c = parseCommon(form, ctx, errors, config);
  if (errors.length > 0) return { ok: false, errors };
  const assumptionNotes = form.aiFields.length > 0 ? [aiAssumptionNote(form.aiFields)] : [];
  if (hasAssets !== hasIncome) {
    assumptionNotes.push(
      '보유 자산과 연소득을 둘 다 입력해야 "내 상황" 판정(자금 여력)을 계산합니다. 지금은 필요 조건만 계산했습니다.',
    );
  }
  if (usesExample(form) && form.aiFields.length === 0) {
    assumptionNotes.push(
      '대출 기준값(LTV 70%·DSR 40%·금리 4%·스트레스 +1.5%p·30년)은 앱의 예시 가정이며 실제 은행·규제 기준이 아닙니다. 은행 안내값으로 바꿔 다시 계산해 보세요.',
    );
  }

  const base = {
    kind: ctx.kind,
    amount: ctx.amountWon,
    collateralValue: c.collateralValue,
    loan: c.loan,
    costs: c.costs,
  };
  const req = requirementsInputSchema.safeParse({
    ...base,
    existingAnnualDebtPayment: c.existingAnnualDebtPayment,
  });
  if (!req.success) return { ok: false, errors: [GENERIC_ERROR] };

  if (assets === undefined || annualIncome === undefined) {
    return { ok: true, requirements: req.data, costNotes: c.costNotes, assumptionNotes };
  }
  const aff = affordabilityInputSchema.safeParse({
    ...base,
    profile: { assets, annualIncome, existingAnnualDebtPayment: c.existingAnnualDebtPayment },
    downPaymentPercent: c.downPaymentPercent,
  });
  if (!aff.success) return { ok: false, errors: [GENERIC_ERROR] };
  return {
    ok: true,
    requirements: req.data,
    affordability: aff.data,
    costNotes: c.costNotes,
    assumptionNotes,
  };
}
