import { describe, expect, it } from 'vitest';
import { estimateMarketValue, medianWon } from '../../src/core';
import { config } from '../helpers/builders';

const m = config.marketEstimate;
const params = (over: Record<string, unknown> = {}) => ({
  asOf: '2026-11-09',
  targetAreaM2: 84,
  areaToleranceM2: m.areaToleranceM2,
  windowMonths: m.windowMonths,
  minSamples: m.minSamples,
  ...over,
});
// 아래 값은 계산 검증용 합성 데이터이며 실제 거래가 아니다
const rec = (amountWon: number, over: Record<string, unknown> = {}) => ({
  amountWon,
  areaM2: 84,
  dealDate: '2026-09-15',
  complexName: '가나다 아파트',
  cancelled: false,
  ...over,
});

describe('medianWon', () => {
  it('홀수 개는 가운데 값, 짝수 개는 가운데 두 값의 평균(내림)', () => {
    expect(medianWon([300, 100, 200])).toBe(200);
    expect(medianWon([100, 201])).toBe(150);
  });
  it('빈 목록은 거부', () => {
    expect(() => medianWon([])).toThrow();
  });
});

describe('estimateMarketValue', () => {
  it('표본 3건 이상이면 중앙값과 신뢰도 high', () => {
    const r = estimateMarketValue([rec(500_000_000), rec(520_000_000), rec(480_000_000)], params());
    expect(r.market).toEqual({ estimatedValue: 500_000_000, source: 'trade_median', confidence: 'high' });
    expect(r.sampleCount).toBe(3);
    expect(r.minWon).toBe(480_000_000);
    expect(r.maxWon).toBe(520_000_000);
  });

  it('표본이 minSamples 미만이면 신뢰도 low', () => {
    const r = estimateMarketValue([rec(500_000_000), rec(520_000_000)], params());
    expect(r.market?.confidence).toBe('low');
  });

  it('해제된 거래는 제외한다', () => {
    const r = estimateMarketValue([rec(500_000_000), rec(900_000_000, { cancelled: true })], params());
    expect(r.sampleCount).toBe(1);
    expect(r.market?.estimatedValue).toBe(500_000_000);
  });

  it('면적 허용 범위 밖은 제외 (경계값은 포함)', () => {
    const r = estimateMarketValue(
      [
        rec(500_000_000, { areaM2: 87 }),
        rec(600_000_000, { areaM2: 87.1 }),
        rec(700_000_000, { areaM2: 59 }),
      ],
      params(),
    );
    expect(r.sampleCount).toBe(1);
    expect(r.market?.estimatedValue).toBe(500_000_000);
  });

  it('조회 기간 밖이거나 미래 날짜는 제외 (경계값은 포함)', () => {
    const r = estimateMarketValue(
      [
        rec(500_000_000, { dealDate: '2025-11-09' }), // 정확히 12개월 전 → 포함
        rec(600_000_000, { dealDate: '2025-10-09' }), // 13개월 전 → 제외 (기간은 경과 개월 수 기준)
        rec(700_000_000, { dealDate: '2026-12-01' }), // 미래 → 제외
      ],
      params(),
    );
    expect(r.sampleCount).toBe(1);
    expect(r.market?.estimatedValue).toBe(500_000_000);
  });

  it('단지명을 지정하면 같은 단지(공백 무시)만 사용한다', () => {
    const r = estimateMarketValue(
      [
        rec(500_000_000),
        rec(900_000_000, { complexName: '다른 단지' }),
        rec(800_000_000, { complexName: undefined }),
      ],
      params({ complexName: '가나다아파트' }),
    );
    expect(r.sampleCount).toBe(1);
    expect(r.market?.estimatedValue).toBe(500_000_000);
  });

  it('표본이 없으면 market 이 없다', () => {
    expect(estimateMarketValue([], params())).toEqual({ sampleCount: 0 });
  });

  it('잘못된 입력은 거부한다 (음수 금액, 형식 틀린 날짜, 0 이하 면적)', () => {
    expect(() => estimateMarketValue([rec(-1)], params())).toThrow();
    expect(() => estimateMarketValue([rec(1, { dealDate: '2026/09/15' })], params())).toThrow();
    expect(() => estimateMarketValue([], params({ targetAreaM2: 0 }))).toThrow();
  });

  it('같은 입력이면 같은 결과', () => {
    const data = [rec(500_000_000), rec(520_000_000), rec(480_000_000)];
    expect(estimateMarketValue(data, params())).toEqual(estimateMarketValue(data, params()));
  });
});
