import { describe, expect, it } from 'vitest';
import {
  evaluateAffordability,
  monthlyPayment,
  mulPercent,
  principalFromAnnualPayment,
} from '../../src/core';

/** 매매 5억, 담보 5억, 소득 6천만원, 자산 2억 — LTV 70%, DSR 40%, 금리 4%, 30년 */
const sale = (over: Record<string, unknown> = {}) => ({
  kind: 'sale' as const,
  amount: 500_000_000,
  collateralValue: 500_000_000,
  profile: { assets: 200_000_000, annualIncome: 60_000_000, existingAnnualDebtPayment: 0 },
  loan: {
    ltvLimitPercent: 70,
    dsrLimitPercent: 40,
    annualRatePercent: 4,
    stressAddPercent: 1.5,
    termMonths: 360,
  },
  costs: {
    acquisitionTaxRatePercent: 1.1,
    brokerFeeRatePercent: 0.4,
    registrationCostsWon: 2_000_000,
    otherCostsWon: 3_000_000,
  },
  ...over,
});

describe('mulPercent (BigInt, 내림)', () => {
  it.each([
    [123_456_789, 0.4, 493_827],
    [1_000_000_000, 1.1, 11_000_000],
    [100_000_000_000, 100, 100_000_000_000],
    [999, 0, 0],
  ])('%d × %d%% = %d', (won, pct, expected) => {
    expect(mulPercent(won, pct)).toBe(expected);
  });

  it('음수·소수 금액, 음수 비율은 거부한다', () => {
    expect(() => mulPercent(-1, 1)).toThrow();
    expect(() => mulPercent(1.5, 1)).toThrow();
    expect(() => mulPercent(100, -1)).toThrow();
  });
});

describe('상환액 계산', () => {
  it('금리 0% 는 단순 분할', () => {
    expect(principalFromAnnualPayment(12_000_000, 0, 120)).toBe(120_000_000);
    expect(monthlyPayment(120_000_000, 0, 120)).toBe(1_000_000);
  });

  it('원금 → 월상환액 → 원금 역산이 서로 일관된다', () => {
    const principal = principalFromAnnualPayment(12_000_000, 4, 360); // 월 100만원
    expect(monthlyPayment(principal, 4, 360)).toBeLessThanOrEqual(1_000_000);
    expect(monthlyPayment(principal + 1_000, 4, 360)).toBeGreaterThan(1_000_000);
  });

  it('상환 가능액이 0 이하면 원금 0', () => {
    expect(principalFromAnnualPayment(0, 4, 360)).toBe(0);
    expect(monthlyPayment(0, 4, 360)).toBe(0);
  });
});

describe('대출 가능액 추정', () => {
  it('LTV 가 병목: 5억 × 70% = 3.5억', () => {
    const r = evaluateAffordability(sale());
    expect(r.base.byLtv).toBe(350_000_000);
    expect(r.base.estimated).toBe(350_000_000);
    expect(r.base.bottleneck).toBe('ltv');
  });

  it('선순위 채권은 LTV 한도에서 차감된다 (한도를 넘으면 0)', () => {
    expect(evaluateAffordability(sale({ seniorClaims: 100_000_000 })).base.byLtv).toBe(250_000_000);
    expect(evaluateAffordability(sale({ seniorClaims: 400_000_000 })).base.byLtv).toBe(0);
  });

  it('DSR 이 병목: 소득이 낮으면 DSR 한도가 결정한다', () => {
    const r = evaluateAffordability(
      sale({ profile: { assets: 200_000_000, annualIncome: 30_000_000, existingAnnualDebtPayment: 0 } }),
    );
    expect(r.base.bottleneck).toBe('dsr');
    expect(r.base.estimated).toBe(r.base.byDsr);
    expect(r.base.byDsr).toBeLessThan(r.base.byLtv);
    // 연 1,200만원(월 100만원) 상환 가능 → 역산한 원금의 월 상환액이 100만원 이하
    expect(monthlyPayment(r.base.byDsr, 4, 360)).toBeLessThanOrEqual(1_000_000);
  });

  it('기존 대출 상환액이 DSR 한도를 넘으면 신규 대출 0', () => {
    const r = evaluateAffordability(
      sale({ profile: { assets: 0, annualIncome: 60_000_000, existingAnnualDebtPayment: 30_000_000 } }),
    );
    expect(r.base.byDsr).toBe(0);
    expect(r.base.estimated).toBe(0);
    expect(r.base.bottleneck).toBe('dsr');
  });

  it('상품 한도가 가장 낮으면 병목은 product', () => {
    const r = evaluateAffordability(sale({ loan: { ...sale().loan, productCap: 100_000_000 } }));
    expect(r.base.estimated).toBe(100_000_000);
    expect(r.base.bottleneck).toBe('product');
  });

  it('동률이면 ltv 를 병목으로 본다', () => {
    const r = evaluateAffordability(sale({ loan: { ...sale().loan, productCap: 350_000_000 } }));
    expect(r.base.bottleneck).toBe('ltv');
  });

  it('보수 시나리오(가산 금리)는 기준보다 DSR 한도가 같거나 낮다', () => {
    const r = evaluateAffordability(
      sale({ profile: { assets: 0, annualIncome: 30_000_000, existingAnnualDebtPayment: 0 } }),
    );
    expect(r.conservative.dsrRatePercent).toBe(5.5);
    expect(r.conservative.byDsr).toBeLessThan(r.base.byDsr);
    expect(r.conservative.estimated).toBeLessThanOrEqual(r.base.estimated);
  });
});

describe('필요 자금과 자산 대비 과부족', () => {
  it('매매: 가격 + 취득세·중개보수·기타, 대출 반영 후 필요 자기자금', () => {
    const r = evaluateAffordability(sale());
    const f = r.fundingBase;
    expect(f.items.map((i) => [i.label, i.amount])).toEqual([
      ['매매가', 500_000_000],
      ['취득세 등', 5_500_000],
      ['중개보수', 2_000_000],
      ['등기·법무사 등 비용', 2_000_000],
      ['이사·수리 등 기타', 3_000_000],
    ]);
    expect(f.totalRequired).toBe(512_500_000);
    expect(f.loanUsed).toBe(350_000_000);
    expect(f.ownFundsNeeded).toBe(162_500_000);
    expect(f.surplus).toBe(37_500_000); // 자산 2억 − 1.625억
  });

  it('자산이 부족하면 surplus 가 음수(부족액)', () => {
    const r = evaluateAffordability(
      sale({ profile: { assets: 100_000_000, annualIncome: 60_000_000, existingAnnualDebtPayment: 0 } }),
    );
    expect(r.fundingBase.surplus).toBe(-62_500_000);
  });

  it('전세: 취득세 없음, 중개보수 직접 입력, 보증보험료 포함', () => {
    const r = evaluateAffordability({
      kind: 'jeonse',
      amount: 300_000_000,
      collateralValue: 300_000_000,
      profile: { assets: 100_000_000, annualIncome: 60_000_000, existingAnnualDebtPayment: 0 },
      loan: {
        ltvLimitPercent: 80,
        dsrLimitPercent: 40,
        annualRatePercent: 4,
        stressAddPercent: 1,
        termMonths: 24 * 10,
      },
      costs: { brokerFeeOverrideWon: 1_000_000, guaranteeFeeRatePercent: 0.126 },
    });
    expect(r.fundingBase.items.map((i) => i.label)).not.toContain('취득세 등');
    expect(r.fundingBase.totalRequired).toBe(301_378_000);
    expect(r.fundingBase.loanUsed).toBe(240_000_000);
    expect(r.fundingBase.ownFundsNeeded).toBe(61_378_000);
  });

  it('대출 한도가 가격보다 커도 대출 반영액은 가격까지만', () => {
    const r = evaluateAffordability(
      sale({
        amount: 300_000_000,
        collateralValue: 600_000_000,
        loan: { ...sale().loan, ltvLimitPercent: 90 },
      }),
    );
    expect(r.base.byLtv).toBe(540_000_000);
    expect(r.fundingBase.loanUsed).toBe(300_000_000);
  });

  it('계약금 비율이 있으면 시점별 현금을 계산한다 (대출은 잔금 시점)', () => {
    const r = evaluateAffordability(sale({ downPaymentPercent: 10 }));
    expect(r.fundingBase.timeline).toEqual({ atContract: 50_000_000, atBalance: 112_500_000 });
  });

  it('계약금 비율이 없으면 timeline 은 없다', () => {
    expect(evaluateAffordability(sale()).fundingBase.timeline).toBeUndefined();
  });
});

describe('상환 부담', () => {
  it('월 상환액과 연소득 대비 상환 비율(기존 대출 포함)', () => {
    const r = evaluateAffordability(sale());
    expect(r.monthlyPayment).toBeGreaterThan(1_600_000);
    expect(r.monthlyPayment).toBeLessThan(1_800_000);
    expect(r.debtServicePercent).toBeGreaterThan(33);
    expect(r.debtServicePercent).toBeLessThan(35);
  });

  it('소득이 0이면 비율은 null, 대출 한도는 0', () => {
    const r = evaluateAffordability(
      sale({ profile: { assets: 0, annualIncome: 0, existingAnnualDebtPayment: 0 } }),
    );
    expect(r.debtServicePercent).toBeNull();
    expect(r.base.estimated).toBe(0);
  });
});

describe('입력 검증과 결정성', () => {
  it('잘못된 기준값은 거부한다', () => {
    expect(() => evaluateAffordability(sale({ loan: { ...sale().loan, ltvLimitPercent: 0 } }))).toThrow();
    expect(() => evaluateAffordability(sale({ loan: { ...sale().loan, termMonths: 0 } }))).toThrow();
    expect(() => evaluateAffordability(sale({ amount: -1 }))).toThrow();
    expect(() =>
      evaluateAffordability(
        sale({ profile: { assets: 1.5, annualIncome: 1, existingAnnualDebtPayment: 0 } }),
      ),
    ).toThrow();
  });

  it('대출 기준값은 기본값이 없어 누락 시 거부한다', () => {
    const withoutLoan: Record<string, unknown> = { ...sale() };
    delete withoutLoan.loan;
    expect(() => evaluateAffordability(withoutLoan)).toThrow();
  });

  it('같은 입력이면 같은 결과', () => {
    expect(evaluateAffordability(sale())).toEqual(evaluateAffordability(sale()));
  });
});
