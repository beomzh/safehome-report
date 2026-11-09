import { describe, expect, it } from 'vitest';
import { acquisitionTax, brokerageFee, propertyTax } from '../../src/core';
import { config } from '../helpers/builders';

const acq = (price: number, area?: number, override?: number) =>
  acquisitionTax(price, area, config.acquisitionTax, override);
const fee = (kind: 'sale' | 'jeonse' | 'monthly', amount: number, rent?: number) =>
  brokerageFee(kind, amount, rent, config.brokerage);

describe('acquisitionTax — 주택 유상취득 표준세율 (손계산 검증)', () => {
  it('6억 이하는 1%: 5억 → 취득세 500만 + 지방교육세 50만', () => {
    const r = acq(500_000_000, 84);
    expect(r.taxRatePercent).toBe(1);
    expect([r.acquisitionTax, r.localEducationTax, r.ruralSpecialTax, r.total]).toEqual([
      5_000_000, 500_000, 0, 5_500_000,
    ]);
  });

  it('경계: 6억은 1%, 9억은 3%', () => {
    expect(acq(600_000_000).taxRatePercent).toBe(1);
    expect(acq(900_000_000).taxRatePercent).toBe(3);
    expect(acq(1_200_000_000).taxRatePercent).toBe(3);
  });

  it('6~9억 구간은 선형 산식을 소수 둘째 자리(%)까지 반올림: 7억 → 1.67%, 8억 → 2.33%', () => {
    expect(acq(700_000_000).taxRatePercent).toBe(1.67);
    expect(acq(800_000_000).taxRatePercent).toBe(2.33);
    const r = acq(700_000_000, 84);
    expect([r.acquisitionTax, r.localEducationTax]).toEqual([11_690_000, 1_169_000]);
  });

  it('전용 85㎡ 초과면 농어촌특별세 0.2% (85㎡는 제외)', () => {
    expect(acq(500_000_000, 85).ruralSpecialTax).toBe(0);
    expect(acq(500_000_000, 85.01).ruralSpecialTax).toBe(1_000_000);
    expect(acq(500_000_000, 85.01).total).toBe(5_000_000 + 500_000 + 1_000_000);
  });

  it('면적이 없으면 농특세를 제외하고 알린다', () => {
    const r = acq(500_000_000);
    expect(r.ruralSpecialTax).toBe(0);
    expect(r.notes.join(' ')).toContain('전용면적이 없어');
  });

  it('중과 세율을 직접 입력하면 본세만 계산하고 부가세 제외를 알린다', () => {
    const r = acq(500_000_000, 84, 8);
    expect([r.acquisitionTax, r.localEducationTax, r.ruralSpecialTax, r.total]).toEqual([
      40_000_000, 0, 0, 40_000_000,
    ]);
    expect(r.notes.join(' ')).toContain('중과');
  });

  it('일반 세율 기준임을 항상 밝힌다', () => {
    expect(acq(500_000_000, 84).notes.join(' ')).toContain('중과');
  });
});

describe('brokerageFee — 상한 요율 (손계산 검증)', () => {
  it.each([
    ['매매 3천만 → 0.6% = 18만', 'sale', 30_000_000, 180_000, false],
    ['매매 1.5억 → 0.5% = 75만 (한도 80만 이내)', 'sale', 150_000_000, 750_000, false],
    ['매매 1.9억 → 0.5% = 95만 → 한도 80만', 'sale', 190_000_000, 800_000, true],
    ['매매 5억 → 0.4% = 200만', 'sale', 500_000_000, 2_000_000, false],
    ['매매 10억 → 0.5% = 500만', 'sale', 1_000_000_000, 5_000_000, false],
    ['매매 20억 → 0.7% = 1,400만', 'sale', 2_000_000_000, 14_000_000, false],
    ['전세 3억 → 0.3% = 90만', 'jeonse', 300_000_000, 900_000, false],
    ['전세 4천만 → 0.5% = 20만', 'jeonse', 40_000_000, 200_000, false],
    ['전세 4,900만 → 0.5% = 24.5만 → 한도 20만', 'jeonse', 49_000_000, 200_000, true],
    ['전세 8천만 → 0.4% = 32만 → 한도 30만', 'jeonse', 80_000_000, 300_000, true],
    ['전세 8억 → 0.4% = 320만', 'jeonse', 800_000_000, 3_200_000, false],
  ] as const)('%s', (_label, kind, amount, expected, capped) => {
    const r = fee(kind, amount);
    expect(r.feeWon).toBe(expected);
    expect(r.capped).toBe(capped);
  });

  it('구간 경계는 "미만": 매매 5천만 정확히는 두 번째 구간(0.5%)', () => {
    expect(fee('sale', 50_000_000).ratePercent).toBe(0.5);
    expect(fee('sale', 49_999_999).ratePercent).toBe(0.6);
    expect(fee('sale', 900_000_000).ratePercent).toBe(0.5);
  });

  it('월세는 환산보증금: 1천만 + 월 50만 → 6천만 (0.4%, 한도 30만) = 24만', () => {
    const r = fee('monthly', 10_000_000, 500_000);
    expect(r.basisWon).toBe(60_000_000);
    expect(r.feeWon).toBe(240_000);
  });

  it('환산액이 5천만 미만이면 월세 × 70: 500만 + 월 30만 → 2,600만 (0.5%) = 13만', () => {
    const r = fee('monthly', 5_000_000, 300_000);
    expect(r.basisWon).toBe(26_000_000);
    expect(r.feeWon).toBe(130_000);
  });

  it('월세를 입력하지 않으면 보증금만으로 계산하고 알린다', () => {
    const r = fee('monthly', 100_000_000);
    expect(r.basisWon).toBe(100_000_000);
    expect(r.notes.join(' ')).toContain('월세를 입력하지 않아');
  });

  it('부가세 미포함·협의 가능을 알린다', () => {
    expect(fee('jeonse', 300_000_000).notes.join(' ')).toContain('부가세');
  });
});

describe('propertyTax — 주택 재산세 (손계산 검증)', () => {
  const tax = (price: number, single: boolean) => propertyTax(price, single, config.propertyTax);

  it('1세대 1주택 공시가격 5억: 과세표준 2.2억(44%), 재산세 26만 + 도시지역분 30.8만, 지방교육세 20%', () => {
    const r = tax(500_000_000, true);
    expect(r.singleHomeApplied).toBe(true);
    expect([r.fairMarketPercent, r.taxBaseWon, r.baseTaxWon, r.urbanAreaWon]).toEqual([
      44, 220_000_000, 260_000, 308_000,
    ]);
    expect([r.propertyTaxWon, r.localEducationTaxWon, r.totalWon]).toEqual([568_000, 113_600, 681_600]);
  });

  it('일반(다주택 등) 공시가격 5억: 과세표준 3억(60%), 재산세 57만 + 도시지역분 42만', () => {
    const r = tax(500_000_000, false);
    expect(r.singleHomeApplied).toBe(false);
    expect([r.taxBaseWon, r.baseTaxWon, r.urbanAreaWon, r.totalWon]).toEqual([
      300_000_000, 570_000, 420_000, 1_188_000,
    ]);
  });

  it('공정시장가액비율 경계: 3억 이하 43%, 6억 이하 44%, 초과 45%', () => {
    expect(tax(300_000_000, true).fairMarketPercent).toBe(43);
    expect(tax(300_000_001, true).fairMarketPercent).toBe(44);
    expect(tax(600_000_000, true).fairMarketPercent).toBe(44);
    expect(tax(600_000_001, true).fairMarketPercent).toBe(45);
  });

  it('공시가격 9억 초과는 1주택이어도 특례를 쓰지 않고 안내한다', () => {
    const r = tax(900_000_001, true);
    expect(r.singleHomeApplied).toBe(false);
    expect(r.fairMarketPercent).toBe(60);
    expect(r.notes.join(' ')).toContain('9억');
  });

  it('과세표준 3억 초과 구간(0.4%)까지 누진 적용: 공시가격 20억 일반 → 과세표준 12억', () => {
    // 6천만×0.1% + 9천만×0.15% + 1.5억×0.25% + 9억×0.4% = 6만+13.5만+37.5만+360만 = 417만
    expect(tax(2_000_000_000, false).baseTaxWon).toBe(4_170_000);
  });
});
