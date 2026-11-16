import { describe, expect, it } from 'vitest';
import { gridRateAtTerm, policyAssumptions } from '../../src/core';
import type { LoanDeal, LoanProfile } from '../../src/core';
import { defaultFinanceForm } from '../../src/web/financeForm';
import { applyPolicyBasis } from '../../src/web/policyFinance';
import { LOAN_ELIGIBILITY } from '../../src/web/loanEligibility';
import { rateInfoFor } from '../../src/web/loanRates';

const profile = (over: Partial<LoanProfile> = {}): LoanProfile => ({
  incomeWon: 30_000_000,
  netAssetWon: 100_000_000,
  age: 32,
  homeless: true,
  householdHead: true,
  newlywed: false,
  newbornWithin2y: false,
  minorChildren: 0,
  firstHome: false,
  dualIncome: false,
  ...over,
});
const sale = (over: Partial<LoanDeal> = {}): LoanDeal => ({
  kind: 'sale',
  amountWon: 400_000_000,
  capital: true,
  areaM2: 59,
  ...over,
});
const jeonse = (over: Partial<LoanDeal> = {}): LoanDeal => ({
  kind: 'jeonse',
  amountWon: 300_000_000,
  capital: true,
  areaM2: 59,
  ...over,
});
const product = (id: string) => LOAN_ELIGIBILITY.products.find((p) => p.productId === id)!;
const policy = (id: string, p: LoanProfile, d: LoanDeal) =>
  policyAssumptions(product(id), p, d, rateInfoFor(id));

describe('디딤돌: 공식 안내(LTV 70%·DTI 60%, 금리 2.85~4.15%, 한도 2억/2.4억/3.2억)', () => {
  it('일반: LTV 70%, DTI 60%, 한도 2억, 30년, 금리는 공식 표의 범위 안', () => {
    const r = policy('didimdol', profile(), sale())!;
    expect(r).toMatchObject({
      ltvPercent: 70,
      dtiPercent: 60,
      capWon: 200_000_000,
      termYears: 30,
      rateBasis: 'grid',
    });
    expect(r.annualRatePercent).toBeGreaterThanOrEqual(2.85);
    expect(r.annualRatePercent).toBeLessThanOrEqual(4.15);
    expect(r.annualRatePercent).toBe(gridRateAtTerm(rateInfoFor('didimdol')!.grid!, 30_000_000, false, 30));
  });

  it('생애최초는 한도 2.4억, LTV 80% 는 수도권 밖에서만(수도권은 70%)', () => {
    const first = profile({ firstHome: true });
    expect(policy('didimdol', first, sale({ capital: true }))).toMatchObject({
      ltvPercent: 70,
      capWon: 240_000_000,
    });
    expect(policy('didimdol', first, sale({ capital: false }))).toMatchObject({
      ltvPercent: 80,
      capWon: 240_000_000,
    });
    expect(policy('didimdol', first, sale({ capital: undefined }))!.ltvPercent).toBe(70); // 모르면 낮은 쪽
  });

  it('신혼·2자녀 이상은 한도 3.2억', () => {
    expect(policy('didimdol', profile({ newlywed: true }), sale())!.capWon).toBe(320_000_000);
    expect(policy('didimdol', profile({ minorChildren: 2 }), sale())!.capWon).toBe(320_000_000);
  });

  it('소득을 모르면 상품 금리 범위의 상단(4.15%)을 쓰고 이유를 밝힌다', () => {
    const r = policy('didimdol', profile({ incomeWon: undefined }), sale())!;
    expect([r.rateBasis, r.annualRatePercent]).toEqual(['range-max', 4.15]);
    expect(r.notes.join(' ')).toContain('소득을 입력하지 않아');
  });
});

describe('신생아 특례 디딤돌: 금리 1.8~4.5%, 한도 4억', () => {
  it('한도 4억, DTI 60%, 금리는 표 안', () => {
    const r = policy(
      'newborn-didimdol',
      profile({ newbornWithin2y: true, incomeWon: 90_000_000 }),
      sale({ amountWon: 700_000_000 }),
    )!;
    expect(r).toMatchObject({ ltvPercent: 70, dtiPercent: 60, capWon: 400_000_000 });
    expect(r.annualRatePercent).toBeGreaterThanOrEqual(1.8);
    expect(r.annualRatePercent).toBeLessThanOrEqual(4.5);
  });
});

describe('전세 상품', () => {
  it('버팀목(일반): LTV 70%, 수도권 한도 1.2억 / 그 외 8천만, 신혼이면 80%·2.5억/1.6억', () => {
    expect(policy('buteommok', profile(), jeonse())).toMatchObject({ ltvPercent: 70, capWon: 120_000_000 });
    expect(policy('buteommok', profile(), jeonse({ capital: false }))!.capWon).toBe(80_000_000);
    expect(policy('buteommok', profile({ newlywed: true }), jeonse())).toMatchObject({
      ltvPercent: 80,
      capWon: 250_000_000,
    });
    expect(policy('buteommok', profile({ newlywed: true }), jeonse({ capital: false }))!.capWon).toBe(
      160_000_000,
    );
  });

  it('수도권 여부를 모르면 낮은 한도를 쓰고 알린다. 전세는 DTI·대출기간이 없다', () => {
    const r = policy('buteommok', profile(), jeonse({ capital: undefined }))!;
    expect(r.capWon).toBe(80_000_000);
    expect(r.notes.join(' ')).toContain('수도권 여부를 몰라');
    expect([r.dtiPercent, r.termYears]).toEqual([undefined, undefined]);
  });

  it('신생아 특례 버팀목: LTV 80%, 한도 2.4억, 금리는 보증금 구간 열에서', () => {
    const r = policy(
      'newborn-buteommok',
      profile({ newbornWithin2y: true }),
      jeonse({ amountWon: 400_000_000 }),
    )!;
    expect(r).toMatchObject({ ltvPercent: 80, capWon: 240_000_000, rateBasis: 'grid' });
  });

  it('월세 상품은 조건이 없어 undefined', () => {
    expect(
      policy('housing-stable-wolse', profile(), { kind: 'monthly', amountWon: 50_000_000 }),
    ).toBeUndefined();
  });
});

describe('applyPolicyBasis — 사용자 값을 존중한다', () => {
  const p = policy('didimdol', profile({ firstHome: true }), sale({ capital: false }))!;

  it('예시 값 그대로면 공식 조건으로 바꾸고 출처를 밝힌다', () => {
    const out = applyPolicyBasis(defaultFinanceForm(), p, '내집마련 디딤돌대출');
    expect(out.applied).toBe(true);
    expect(out.fin).toMatchObject({
      ltvLimitPercent: '80',
      dsrLimitPercent: '60',
      stressAddPercent: '0',
      termYears: '30',
      productCapManwon: '24000',
    });
    expect(out.notes.join(' ')).toContain('정책 대출 기준 적용');
    expect(out.notes.join(' ')).toContain('스트레스 가산');
  });

  it('직접 고친 값·AI 제안·상품 한도 입력이 있으면 건드리지 않는다', () => {
    const edited = { ...defaultFinanceForm(), ltvLimitPercent: '60' };
    const ai = { ...defaultFinanceForm(), aiFields: ['ltvLimitPercent' as const] };
    const cap = { ...defaultFinanceForm(), productCapManwon: '10000' };
    for (const f of [edited, ai, cap]) {
      const out = applyPolicyBasis(f, p, 'x');
      expect(out.applied).toBe(false);
      expect(out.fin).toBe(f);
    }
  });

  it('DTI 한도가 없는 전세 상품은 DSR 예시 40%를 유지하고 그렇게 밝힌다', () => {
    const j = policy('buteommok', profile({ newlywed: true }), jeonse())!;
    const out = applyPolicyBasis(defaultFinanceForm(), j, '버팀목');
    expect(out.fin.dsrLimitPercent).toBe('40');
    expect(out.fin.ltvLimitPercent).toBe('80');
    expect(out.notes.join(' ')).toContain('예시 가정(40%)');
  });
});
