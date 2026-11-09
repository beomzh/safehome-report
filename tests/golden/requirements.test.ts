import { describe, expect, it } from 'vitest';
import { evaluateAffordability, evaluateRequirements, monthlyPayment } from '../../src/core';

/** 매매 5억 — LTV 70%, DSR 40%, 금리 4%, 30년, 스트레스 1.5%p (core 골든셋과 같은 비용 가정) */
const sale = (over: Record<string, unknown> = {}) => ({
  kind: 'sale' as const,
  amount: 500_000_000,
  collateralValue: 500_000_000,
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

describe('evaluateRequirements (역산)', () => {
  it('최대 대출·총 필요 자금·필요 자기자금을 계산한다', () => {
    const r = evaluateRequirements(sale());
    expect(r.totalRequired).toBe(512_500_000);
    expect(r.maxLoan).toBe(350_000_000);
    expect(r.maxLoanBottleneck).toBe('ltv');
    const top = r.rows[0]!;
    expect(top.loanSharePercent).toBe(100);
    expect(top.loan).toBe(350_000_000);
    expect(top.ownFundsNeeded).toBe(162_500_000); // 5.125억 − 3.5억
  });

  it('대출을 줄일수록 필요 자기자금은 늘고 필요 연소득은 줄어든다', () => {
    const rows = evaluateRequirements(sale()).rows;
    expect(rows.map((x) => x.loanSharePercent)).toEqual([100, 80, 60, 40, 20, 0]);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.ownFundsNeeded).toBeGreaterThan(rows[i - 1]!.ownFundsNeeded);
      expect(rows[i]!.minIncomeBase).toBeLessThanOrEqual(rows[i - 1]!.minIncomeBase);
    }
    const none = rows[5]!;
    expect(none.loan).toBe(0);
    expect(none.ownFundsNeeded).toBe(512_500_000);
    expect(none.minIncomeBase).toBe(0);
  });

  it('월 상환액은 core 의 상환 공식과 일치한다', () => {
    const top = evaluateRequirements(sale()).rows[0]!;
    expect(top.monthlyPayment).toBe(monthlyPayment(350_000_000, 4, 360));
  });

  it('보수 시나리오(가산 금리)는 필요 연소득이 더 크다', () => {
    const top = evaluateRequirements(sale()).rows[0]!;
    expect(top.minIncomeConservative).toBeGreaterThan(top.minIncomeBase);
  });

  it('정방향 계산과 서로 맞는다: 필요 연소득이면 그 대출이 DSR 한도 안, 1백만원 모자라면 밖', () => {
    const r = evaluateRequirements(sale());
    const top = r.rows[0]!;
    const forward = (income: number) =>
      evaluateAffordability({
        ...sale(),
        profile: { assets: 0, annualIncome: income, existingAnnualDebtPayment: 0 },
      }).base.byDsr;
    expect(forward(top.minIncomeBase)).toBeGreaterThanOrEqual(top.loan);
    expect(forward(top.minIncomeBase - 1_000_000)).toBeLessThan(top.loan);
  });

  it('기존 대출 상환액이 있으면 필요 연소득이 그만큼 늘어난다', () => {
    const base = evaluateRequirements(sale()).rows[0]!.minIncomeBase;
    const withDebt = evaluateRequirements(sale({ existingAnnualDebtPayment: 6_000_000 })).rows[0]!
      .minIncomeBase;
    expect(withDebt - base).toBe(15_000_000); // 600만원 / 40%
    expect(evaluateRequirements(sale({ existingAnnualDebtPayment: 6_000_000 })).rows[5]!.minIncomeBase).toBe(
      15_000_000,
    );
  });

  it('선순위 채권은 LTV 한도에서 차감한다', () => {
    expect(evaluateRequirements(sale({ seniorClaims: 100_000_000 })).maxLoan).toBe(250_000_000);
    expect(evaluateRequirements(sale({ seniorClaims: 400_000_000 })).maxLoan).toBe(0);
  });

  it('상품 한도가 더 낮으면 병목은 product, 가격이 더 낮으면 price', () => {
    const p = evaluateRequirements(sale({ loan: { ...sale().loan, productCap: 100_000_000 } }));
    expect([p.maxLoan, p.maxLoanBottleneck]).toEqual([100_000_000, 'product']);
    const price = evaluateRequirements(sale({ amount: 300_000_000, collateralValue: 600_000_000 }));
    expect([price.maxLoan, price.maxLoanBottleneck]).toEqual([300_000_000, 'price']);
  });

  it('동률이면 ltv 를 병목으로 본다', () => {
    const r = evaluateRequirements(sale({ loan: { ...sale().loan, productCap: 350_000_000 } }));
    expect(r.maxLoanBottleneck).toBe('ltv');
  });

  it('전세: 보증금 기준, 취득세 항목 없음', () => {
    const r = evaluateRequirements({
      kind: 'jeonse',
      amount: 300_000_000,
      collateralValue: 300_000_000,
      loan: {
        ltvLimitPercent: 80,
        dsrLimitPercent: 40,
        annualRatePercent: 4,
        stressAddPercent: 0,
        termMonths: 240,
      },
      costs: { brokerFeeOverrideWon: 1_000_000, guaranteeFeeRatePercent: 0.126 },
    });
    expect(r.items.map((i) => i.label)).not.toContain('취득세 등');
    expect(r.totalRequired).toBe(301_378_000);
    expect(r.maxLoan).toBe(240_000_000);
    expect(r.rows[0]!.ownFundsNeeded).toBe(61_378_000);
  });

  it('입력 검증: 대출 기준값은 기본값이 없어 누락·0 이면 거부한다', () => {
    const { loan: _loan, ...rest } = sale();
    void _loan;
    expect(() => evaluateRequirements(rest)).toThrow();
    expect(() => evaluateRequirements(sale({ loan: { ...sale().loan, dsrLimitPercent: 0 } }))).toThrow();
    expect(() => evaluateRequirements(sale({ amount: 0 }))).toThrow();
  });

  it('같은 입력이면 같은 결과', () => {
    expect(evaluateRequirements(sale())).toEqual(evaluateRequirements(sale()));
  });
});
