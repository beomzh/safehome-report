import { describe, expect, it } from 'vitest';
import { estimateRent, jeonseRatioPercent } from '../../src/core';
import { config } from '../helpers/builders';

const m = config.marketEstimate;
const params = (over: Record<string, unknown> = {}) => ({
  asOf: '2026-11-09',
  targetAreaM2: 84,
  areaToleranceM2: m.areaToleranceM2,
  windowMonths: m.rentWindowMonths,
  minSamples: m.minSamples,
  ...over,
});
// 계산 검증용 합성 데이터이며 실제 거래가 아니다
const rec = (depositWon: number, over: Record<string, unknown> = {}) => ({
  depositWon,
  monthlyRentWon: 0,
  areaM2: 84,
  dealDate: '2026-10-15',
  complexName: '가나다 아파트',
  renewal: false,
  ...over,
});

describe('estimateRent — 전세', () => {
  it('신규 전세 표본이 충분하면 신규만으로 중앙값을 낸다', () => {
    const r = estimateRent(
      [rec(300_000_000), rec(320_000_000), rec(340_000_000), rec(200_000_000, { renewal: true })],
      params(),
    );
    expect(r.jeonse).toMatchObject({
      medianWon: 320_000_000,
      sampleCount: 3,
      confidence: 'high',
      includesRenewal: false,
    });
  });

  it('신규가 부족하면 갱신을 포함하되 신뢰도를 낮춘다', () => {
    const r = estimateRent(
      [rec(300_000_000), rec(200_000_000, { renewal: true }), rec(220_000_000, { renewal: true })],
      params(),
    );
    expect(r.jeonse).toMatchObject({ sampleCount: 3, confidence: 'low', includesRenewal: true });
    expect(r.jeonse?.medianWon).toBe(220_000_000);
  });

  it('월세 거래는 전세 표본에서 빼고, 기간·면적·단지 밖은 제외한다', () => {
    const r = estimateRent(
      [
        rec(300_000_000),
        rec(100_000_000, { monthlyRentWon: 1_000_000 }),
        rec(999_000_000, { dealDate: '2026-01-01' }),
        rec(999_000_000, { areaM2: 59 }),
        rec(999_000_000, { complexName: '다른 단지' }),
      ],
      params({ complexName: '가나다아파트' }),
    );
    expect(r.jeonse?.sampleCount).toBe(1);
    expect(r.jeonse?.medianWon).toBe(300_000_000);
  });

  it('거래가 없으면 비어 있다', () => {
    expect(estimateRent([], params())).toEqual({});
  });
});

describe('estimateRent — 월세', () => {
  it('보증금과 월세 각각의 중앙값을 낸다', () => {
    const r = estimateRent(
      [
        rec(10_000_000, { monthlyRentWon: 800_000 }),
        rec(20_000_000, { monthlyRentWon: 700_000 }),
        rec(30_000_000, { monthlyRentWon: 600_000 }),
      ],
      params(),
    );
    expect(r.monthly).toEqual({ medianDepositWon: 20_000_000, medianRentWon: 700_000, sampleCount: 3 });
    expect(r.jeonse).toBeUndefined();
  });
});

describe('jeonseRatioPercent', () => {
  it('전세 ÷ 매매 × 100 (소수 첫째 자리)', () => {
    expect(jeonseRatioPercent(300_000_000, 400_000_000)).toBe(75);
    expect(jeonseRatioPercent(310_000_000, 400_000_000)).toBe(77.5);
  });
  it('한쪽이 없으면 undefined', () => {
    expect(jeonseRatioPercent(undefined, 400_000_000)).toBeUndefined();
    expect(jeonseRatioPercent(300_000_000, undefined)).toBeUndefined();
  });
});
