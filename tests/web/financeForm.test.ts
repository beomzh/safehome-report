import { describe, expect, it } from 'vitest';
import { evaluateAffordability, evaluateRequirements } from '../../src/core';
import {
  buildAffordabilityInput,
  buildFinancePlan,
  emptyFinanceForm,
  parsePercent,
} from '../../src/web/financeForm';
import type { FinanceContext, FinanceFormState } from '../../src/web/financeForm';
import { rulesConfig } from '../../src/web/rulesConfig';

const filled = (over: Partial<FinanceFormState> = {}): FinanceFormState => ({
  ...emptyFinanceForm(),
  enabled: true,
  assetsManwon: '20,000',
  annualIncomeManwon: '6,000',
  ltvLimitPercent: '70',
  dsrLimitPercent: '40',
  annualRatePercent: '4',
  termYears: '30',
  ...over,
});
const sale = { kind: 'sale' as const, amountWon: 500_000_000 };

describe('parsePercent', () => {
  it.each([
    ['70', 70],
    ['4.5', 4.5],
    ['0.126', 0.126],
    ['0', 0],
    ['100', 100],
  ])('%s → %d', (raw, value) => {
    expect(parsePercent(raw)).toEqual({ ok: true, value });
  });
  it.each(['', 'abc', '-1', '101', '1.23456', '1,5', '4%'])('거부: %j', (raw) => {
    expect(parsePercent(raw).ok).toBe(false);
  });
});

describe('buildAffordabilityInput', () => {
  it('만원→원, 년→개월로 변환하고 비워 둔 선택값은 생략한다', () => {
    const r = buildAffordabilityInput(filled(), sale);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.profile).toEqual({
        assets: 200_000_000,
        annualIncome: 60_000_000,
        existingAnnualDebtPayment: 0,
      });
      expect(r.input.loan.termMonths).toBe(360);
      expect(r.input.loan.stressAddPercent).toBe(0);
      expect(r.input.loan.productCap).toBeUndefined();
      expect(r.input.downPaymentPercent).toBeUndefined();
    }
  });

  it('필수값(자산·소득·LTV·DSR·금리·기간)이 비면 각각 오류', () => {
    const r = buildAffordabilityInput(emptyFinanceForm(), sale);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBe(6);
  });

  it('기본값이 없다: 비율을 0으로 두면 거부, 소수·음수 금액 거부', () => {
    expect(buildAffordabilityInput(filled({ ltvLimitPercent: '0' }), sale).ok).toBe(false);
    expect(buildAffordabilityInput(filled({ assetsManwon: '3.5' }), sale).ok).toBe(false);
    expect(buildAffordabilityInput(filled({ termYears: '0' }), sale).ok).toBe(false);
    expect(buildAffordabilityInput(filled({ termYears: '51' }), sale).ok).toBe(false);
  });

  it('담보가치: 매매는 매매가·시세 중 낮은 값', () => {
    const low = buildAffordabilityInput(filled(), { ...sale, marketWon: 450_000_000 });
    const high = buildAffordabilityInput(filled(), { ...sale, marketWon: 700_000_000 });
    expect(low.ok && low.input.collateralValue).toBe(450_000_000);
    expect(high.ok && high.input.collateralValue).toBe(500_000_000);
  });

  it('담보가치: 전세는 보증금, 선순위 채권은 차감하지 않는다', () => {
    const r = buildAffordabilityInput(filled(), {
      kind: 'jeonse',
      amountWon: 300_000_000,
      marketWon: 100_000_000,
    });
    expect(r.ok && r.input.collateralValue).toBe(300_000_000);
    expect(r.ok && r.input.seniorClaims).toBeUndefined();
  });

  it('부대비용·계약금 비율을 반영한다', () => {
    const r = buildAffordabilityInput(
      filled({
        acquisitionTaxPercent: '1.1',
        brokerFeePercent: '0.4',
        registrationCostsManwon: '200',
        otherCostsManwon: '300',
        downPaymentPercent: '10',
      }),
      sale,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const result = evaluateAffordability(r.input);
      expect(result.fundingBase.totalRequired).toBe(512_500_000); // core 골든셋과 같은 값
      expect(result.fundingBase.timeline).toEqual({ atContract: 50_000_000, atBalance: 112_500_000 });
    }
  });

  it('기존 대출 상환액이 있으면 DSR 한도가 줄어든다', () => {
    const none = buildAffordabilityInput(filled({ annualIncomeManwon: '3,000' }), sale);
    const some = buildAffordabilityInput(
      filled({ annualIncomeManwon: '3,000', existingAnnualDebtManwon: '600' }),
      sale,
    );
    expect(none.ok && some.ok).toBe(true);
    if (none.ok && some.ok) {
      expect(evaluateAffordability(some.input).base.byDsr).toBeLessThan(
        evaluateAffordability(none.input).base.byDsr,
      );
    }
  });
});

describe('buildFinancePlan — 자산·소득 없이도 필요 조건 계산', () => {
  const noProfile = (over: Partial<FinanceFormState> = {}) =>
    filled({ assetsManwon: '', annualIncomeManwon: '', ...over });

  it('자산·소득을 비워도 대출 기준값만 있으면 필요 조건 입력을 만든다', () => {
    const r = buildFinancePlan(noProfile(), sale);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.affordability).toBeUndefined();
      expect(r.requirements.loan.termMonths).toBe(360);
      expect(r.requirements.collateralValue).toBe(500_000_000);
    }
  });

  it('자산과 소득을 둘 다 입력하면 내 상황 판정 입력도 만든다', () => {
    const r = buildFinancePlan(filled(), sale);
    expect(r.ok && r.affordability?.profile.annualIncome).toBe(60_000_000);
  });

  it('둘 중 하나만 입력하면 오류로 안내한다', () => {
    const onlyAssets = buildFinancePlan(noProfile({ assetsManwon: '20,000' }), sale);
    const onlyIncome = buildFinancePlan(noProfile({ annualIncomeManwon: '6,000' }), sale);
    for (const r of [onlyAssets, onlyIncome]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.join(' ')).toContain('둘 다 입력하거나 둘 다 비워');
    }
  });

  it('대출 기준값(LTV·DSR·금리·기간)은 여전히 필수 — 기본값 없음', () => {
    const r = buildFinancePlan(emptyFinanceForm(), sale);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBe(4);
  });

  it('기존 대출 상환액이 필요 조건 입력에 반영된다', () => {
    const r = buildFinancePlan(noProfile({ existingAnnualDebtManwon: '600' }), sale);
    expect(r.ok && r.requirements.existingAnnualDebtPayment).toBe(6_000_000);
  });
});

describe('법정 요율 자동 계산 (취득세·중개보수)', () => {
  const noProfile = (over: Partial<FinanceFormState> = {}) =>
    filled({ assetsManwon: '', annualIncomeManwon: '', ...over });
  const plan = (form: FinanceFormState, ctx: FinanceContext = { ...sale, areaM2: 84 }) =>
    buildFinancePlan(form, ctx, rulesConfig);

  it('매매 5억·84㎡: 취득세 550만(본세 500+교육세 50) + 중개보수 200만을 자동으로 넣는다', () => {
    const r = plan(noProfile());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.requirements.costs?.acquisitionTaxOverrideWon).toBe(5_500_000);
      expect(r.requirements.costs?.brokerFeeOverrideWon).toBe(2_000_000);
      expect(evaluateRequirements(r.requirements).totalRequired).toBe(507_500_000);
      expect(r.costNotes.join(' ')).toContain('취득세 1%');
      expect(r.costNotes.join(' ')).toContain('보유세');
    }
  });

  it('공시가격을 입력하면 재산세를 안내하되 필요 자금에는 넣지 않는다', () => {
    const base = plan(noProfile());
    const r = plan(noProfile({ publicPriceManwon: '50,000', singleHome: true }));
    expect(r.ok && base.ok).toBe(true);
    if (r.ok && base.ok) {
      const text = r.costNotes.join(' ');
      expect(text).toContain('재산세(연');
      expect(text).toContain('68만');
      expect(text).toContain('1세대 1주택 특례');
      expect(evaluateRequirements(r.requirements).totalRequired).toBe(
        evaluateRequirements(base.requirements).totalRequired,
      );
    }
  });

  it('공시가격 형식이 틀리면 오류로 안내한다', () => {
    const r = plan(noProfile({ publicPriceManwon: '오억' }));
    expect(r.ok).toBe(false);
  });

  it('85㎡ 초과면 농어촌특별세 0.2%가 더해진다', () => {
    const r = plan(noProfile(), { ...sale, areaM2: 85.5 });
    expect(r.ok && r.requirements.costs?.acquisitionTaxOverrideWon).toBe(5_000_000 + 500_000 + 1_000_000);
  });

  it('직접 입력한 세율·중개보수가 있으면 자동 계산 대신 그 값을 쓴다', () => {
    const r = plan(noProfile({ acquisitionTaxPercent: '8', brokerFeeOverrideManwon: '300' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.requirements.costs?.acquisitionTaxOverrideWon).toBeUndefined();
      expect(r.requirements.costs?.acquisitionTaxRatePercent).toBe(8);
      expect(r.requirements.costs?.brokerFeeOverrideWon).toBe(3_000_000);
      expect(evaluateRequirements(r.requirements).items.find((i) => i.label === '취득세 등')?.amount).toBe(
        40_000_000,
      );
    }
  });

  it('자동 계산을 끄면 입력한 값만 쓴다 (비어 있으면 0원)', () => {
    const r = plan(noProfile({ autoCosts: false }));
    expect(r.ok && r.requirements.costs?.acquisitionTaxOverrideWon).toBeUndefined();
    expect(r.ok && r.requirements.costs?.brokerFeeOverrideWon).toBeUndefined();
    expect(r.ok && r.costNotes).toEqual([]);
  });

  it('전세는 취득세 없이 중개보수만, 보유세 안내도 없다', () => {
    const r = plan(noProfile(), { kind: 'jeonse', amountWon: 300_000_000 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.requirements.costs?.acquisitionTaxOverrideWon).toBeUndefined();
      expect(r.requirements.costs?.brokerFeeOverrideWon).toBe(900_000);
      expect(r.costNotes.join(' ')).not.toContain('보유세');
    }
  });

  it('월세는 월세를 환산보증금에 반영한다 (보증금 1천만 + 월 50만 → 24만)', () => {
    const r = plan(noProfile({ monthlyRentManwon: '50' }), { kind: 'monthly', amountWon: 10_000_000 });
    expect(r.ok && r.requirements.costs?.brokerFeeOverrideWon).toBe(240_000);
  });

  it('설정이 없으면 자동 계산을 하지 않는다 (기존 동작 유지)', () => {
    const r = buildFinancePlan(noProfile(), sale);
    expect(r.ok && r.requirements.costs?.brokerFeeOverrideWon).toBeUndefined();
  });
});
