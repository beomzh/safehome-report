import { describe, expect, it } from 'vitest';
import { evaluateProduct, gridRate, parseKoreanAmount, recommendLoans, upperBound } from '../../src/core';
import type { LoanDeal, LoanProfile } from '../../src/core';
import { LOAN_ELIGIBILITY } from '../../src/web/loanEligibility';
import { LOAN_RATES, rateInfoFor } from '../../src/web/loanRates';
import { LOAN_PRODUCTS } from '../../src/web/loans';

const profile = (over: Partial<LoanProfile> = {}): LoanProfile => ({
  incomeWon: 40_000_000,
  netAssetWon: 100_000_000,
  age: 30,
  homeless: true,
  householdHead: true,
  newlywed: false,
  newbornWithin2y: false,
  minorChildren: 0,
  firstHome: false,
  dualIncome: false,
  ...over,
});
const jeonse = (over: Partial<LoanDeal> = {}): LoanDeal => ({
  kind: 'jeonse',
  amountWon: 200_000_000,
  capital: true,
  areaM2: 59,
  ...over,
});
const product = (id: string) => LOAN_ELIGIBILITY.products.find((p) => p.productId === id)!;
const status = (id: string, p: LoanProfile, d: LoanDeal) => evaluateProduct(product(id), p, d).status;
const result = (id: string, p: LoanProfile, d: LoanDeal, label: string) =>
  evaluateProduct(product(id), p, d).checks.find((c) => c.label === label)?.result;

describe('금액·구간 표기 읽기', () => {
  it('parseKoreanAmount', () => {
    expect(parseKoreanAmount('7.5천만원')).toBe(75_000_000);
    expect(parseKoreanAmount('1.3억원')).toBe(130_000_000);
    expect(parseKoreanAmount('5천만원 이하')).toBe(50_000_000);
    expect(parseKoreanAmount('abc')).toBeUndefined();
  });
  it('upperBound: 구간의 위쪽 끝', () => {
    expect(upperBound('2천만원 이하')).toBe(20_000_000);
    expect(upperBound('~ 2천만원 이하')).toBe(20_000_000);
    expect(upperBound('2천만원 초과 ~ 4천만원 이하')).toBe(40_000_000);
    expect(upperBound('(맞벌이) 1.3억원 초과 ~ 1.5억원 이하')).toBe(150_000_000);
    expect(upperBound('1억원 초과 ~ ~ 1.3억원 이하')).toBe(130_000_000);
    expect(upperBound('1.5억원 초과')).toBe(Infinity);
    expect(upperBound('10년')).toBeUndefined();
  });
  it('저장된 모든 칸별 금리표의 행·열 라벨을 읽을 수 있다 (열이 대출기간이면 제외)', () => {
    for (const p of LOAN_RATES.products) {
      if (!p.grid) continue;
      for (const r of p.grid.rows) expect(upperBound(r.label), `${p.productId} ${r.label}`).toBeDefined();
      if (!p.grid.cols.every((c) => /년$/.test(c)))
        for (const c of p.grid.cols) expect(upperBound(c), `${p.productId} ${c}`).toBeDefined();
    }
  });
});

describe('gridRate — 소득·보증금에 맞는 기본금리', () => {
  const g = rateInfoFor('newborn-buteommok')!.grid!;
  it('연소득 5천만원·보증금 3억원 → 4천~6천 행, 1.5억 초과 열 = 2.2%', () => {
    expect(gridRate(g, 50_000_000, false, 300_000_000)).toEqual({ minPercent: 2.2, maxPercent: 2.2 });
  });
  it('맞벌이 구간은 맞벌이일 때만 쓴다', () => {
    expect(gridRate(g, 160_000_000, false, 300_000_000)).toBeUndefined();
    expect(gridRate(g, 160_000_000, true, 300_000_000)).toMatchObject({ minPercent: 3.9, maxPercent: 3.9 }); // 1.5~1.7억 행, 1.5억 초과 열;
  });
  it('열이 대출기간인 상품은 그 행의 범위를 돌려준다', () => {
    const d = rateInfoFor('newborn-didimdol')!.grid!;
    expect(gridRate(d, 30_000_000, false, undefined)).toEqual({ minPercent: 2.15, maxPercent: 2.4 }); // 2천~4천만원 행;
  });
});

describe('버팀목 (일반) 요건', () => {
  it('소득 5천 이하·무주택 세대주·수도권 3억 이하·전용 85㎡ 이하·순자산 입력 → 해당 가능', () => {
    expect(status('buteommok', profile(), jeonse())).toBe('likely');
  });
  it('소득이 상한을 넘으면 해당 안 됨 (신혼이면 상한이 올라 해당)', () => {
    const rich = profile({ incomeWon: 70_000_000 });
    expect(status('buteommok', rich, jeonse())).toBe('unlikely');
    expect(status('buteommok', { ...rich, newlywed: true }, jeonse())).toBe('likely');
  });
  it('보증금이 일반 가구 상한(수도권 3억)을 넘으면 해당 안 됨, 신혼은 4억까지', () => {
    expect(status('buteommok', profile(), jeonse({ amountWon: 350_000_000 }))).toBe('unlikely');
    expect(status('buteommok', profile({ newlywed: true }), jeonse({ amountWon: 350_000_000 }))).toBe(
      'likely',
    );
  });
  it('수도권 여부를 모르면 낮은 상한 이하는 통과, 중간 구간은 확인 필요', () => {
    expect(
      result('buteommok', profile(), jeonse({ capital: undefined, amountWon: 150_000_000 }), '임차보증금'),
    ).toBe('ok');
    expect(
      result('buteommok', profile(), jeonse({ capital: undefined, amountWon: 250_000_000 }), '임차보증금'),
    ).toBe('unknown');
    expect(
      result('buteommok', profile(), jeonse({ capital: undefined, amountWon: 350_000_000 }), '임차보증금'),
    ).toBe('fail');
  });
  it('수도권 외는 2억 상한', () => {
    expect(
      result('buteommok', profile(), jeonse({ capital: false, amountWon: 250_000_000 }), '임차보증금'),
    ).toBe('fail');
  });
  it('입력하지 않은 항목은 단정하지 않고 확인 필요', () => {
    const r = evaluateProduct(
      product('buteommok'),
      profile({ incomeWon: undefined, netAssetWon: undefined }),
      jeonse({ areaM2: undefined }),
    );
    expect(r.status).toBe('check');
    expect(r.checks.filter((c) => c.result === 'unknown').map((c) => c.label)).toEqual([
      '소득',
      '순자산',
      '전용면적',
    ]);
  });
  it('유주택이면 대출 대상이 아니다', () => {
    expect(status('buteommok', profile({ homeless: false }), jeonse())).toBe('unlikely');
  });
});

describe('청년·신혼·신생아 상품', () => {
  it('청년 버팀목은 만 19~34세만', () => {
    expect(status('youth-buteommok', profile({ age: 36 }), jeonse())).toBe('unlikely');
    expect(status('youth-buteommok', profile({ age: undefined }), jeonse())).toBe('check');
    expect(status('youth-buteommok', profile({ age: 28 }), jeonse())).toBe('likely');
  });
  it('신혼부부 전세는 신혼이어야 하고, 합산 소득이 넘어도 맞벌이 신혼이면 1인 소득 확인', () => {
    expect(status('newlywed-jeonse', profile(), jeonse())).toBe('unlikely');
    const couple = profile({ newlywed: true, incomeWon: 90_000_000, dualIncome: true });
    expect(result('newlywed-jeonse', couple, jeonse(), '소득')).toBe('unknown');
    expect(result('newlywed-jeonse', { ...couple, dualIncome: false }, jeonse(), '소득')).toBe('fail');
  });
  it('신생아 특례는 2년 내 출산 가구만, 소득 1.3억(맞벌이 2억)', () => {
    expect(status('newborn-buteommok', profile(), jeonse())).toBe('unlikely');
    const baby = profile({ newbornWithin2y: true, incomeWon: 150_000_000 });
    expect(result('newborn-buteommok', baby, jeonse(), '소득')).toBe('fail');
    expect(result('newborn-buteommok', { ...baby, dualIncome: true }, jeonse(), '소득')).toBe('ok');
    expect(
      status('newborn-buteommok', { ...baby, incomeWon: 120_000_000 }, jeonse({ amountWon: 450_000_000 })),
    ).toBe('likely');
  });
});

describe('월세·매매', () => {
  const monthly = (over: Partial<LoanDeal> = {}): LoanDeal => ({
    kind: 'monthly',
    amountWon: 50_000_000,
    monthlyRentWon: 500_000,
    capital: true,
    areaM2: 40,
    ...over,
  });
  it('주거안정월세: 보증금 1억·월세 60만 이하', () => {
    expect(status('housing-stable-wolse', profile(), monthly())).toBe('likely');
    expect(result('housing-stable-wolse', profile(), monthly({ monthlyRentWon: 700_000 }), '월세')).toBe(
      'fail',
    );
    expect(result('housing-stable-wolse', profile(), monthly({ amountWon: 120_000_000 }), '임차보증금')).toBe(
      'fail',
    );
    expect(result('housing-stable-wolse', profile(), monthly({ monthlyRentWon: undefined }), '월세')).toBe(
      'unknown',
    );
  });
  it('청년 보증부월세: 전용 60㎡·보증금 6.5천·월세 70만 이하, 만 19~34세', () => {
    expect(
      status('youth-wolse', profile(), monthly({ amountWon: 60_000_000, monthlyRentWon: 600_000 })),
    ).toBe('likely');
    expect(result('youth-wolse', profile(), monthly({ areaM2: 70 }), '전용면적')).toBe('fail');
  });
  it('디딤돌: 소득 6천(생애최초 7천, 신혼 8.5천), 주택가격 5억(신혼 6억)', () => {
    const sale: LoanDeal = { kind: 'sale', amountWon: 450_000_000, capital: true, areaM2: 59 };
    const mid = profile({ incomeWon: 65_000_000 });
    expect(result('didimdol', mid, sale, '소득')).toBe('fail');
    expect(result('didimdol', { ...mid, firstHome: true }, sale, '소득')).toBe('ok');
    expect(result('didimdol', profile(), { ...sale, amountWon: 550_000_000 }, '주택가격')).toBe('fail');
    expect(
      result('didimdol', profile({ newlywed: true }), { ...sale, amountWon: 550_000_000 }, '주택가격'),
    ).toBe('ok');
  });
});

describe('recommendLoans — 정렬과 금리', () => {
  it('해당 가능 → 확인 필요 → 해당 안 됨 순, 같은 상태에서는 기본금리가 낮은 순', () => {
    const out = recommendLoans(
      LOAN_ELIGIBILITY.products,
      profile({ newlywed: true, newbornWithin2y: true, incomeWon: 60_000_000 }),
      jeonse({ amountWon: 300_000_000 }),
      (id) => rateInfoFor(id),
    );
    expect(out.map((r) => r.status)).toEqual(
      [...out.map((r) => r.status)].sort(
        (a, b) => ['likely', 'check', 'unlikely'].indexOf(a) - ['likely', 'check', 'unlikely'].indexOf(b),
      ),
    );
    const likely = out.filter((r) => r.status === 'likely');
    expect(likely.length).toBeGreaterThan(1);
    for (let i = 1; i < likely.length; i++)
      expect(likely[i]!.rate!.minPercent).toBeGreaterThanOrEqual(likely[i - 1]!.rate!.minPercent);
    expect(out.every((r) => r.productId !== 'didimdol')).toBe(true); // 전세 계약에는 구입 상품을 넣지 않는다
  });
  it('소득을 모르면 칸별 금리 대신 상품 전체 범위를 보여준다', () => {
    const out = recommendLoans(LOAN_ELIGIBILITY.products, profile({ incomeWon: undefined }), jeonse(), (id) =>
      rateInfoFor(id),
    );
    expect(out.find((r) => r.productId === 'buteommok')?.rate?.basis).toBe('range');
  });
});

describe('데이터 정합성', () => {
  it('요건 데이터의 모든 상품은 loans 목록과 금리 데이터에 있고 계약 유형이 같다', () => {
    for (const p of LOAN_ELIGIBILITY.products) {
      const l = LOAN_PRODUCTS.find((x) => x.id === p.productId);
      expect(l, p.productId).toBeDefined();
      expect(l!.kinds).toEqual([p.kind]);
      expect(rateInfoFor(p.productId), p.productId).toBeDefined();
      expect(p.source.url.startsWith('https://nhuf.molit.go.kr/')).toBe(true);
    }
  });
});
