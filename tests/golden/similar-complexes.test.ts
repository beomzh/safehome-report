import { describe, expect, it } from 'vitest';
import { findSimilarComplexes } from '../../src/core';

const t = (complexName: string, won: number, area = 84, date = '2026-09-10', cancelled = false) => ({
  complexName,
  amountWon: won,
  areaM2: area,
  dealDate: date,
  cancelled,
});
const params = {
  asOf: '2026-11-09',
  targetAreaM2: 84,
  areaToleranceM2: 3,
  windowMonths: 12,
  minTrades: 2,
  limit: 5,
};

describe('findSimilarComplexes', () => {
  const records = [
    t('가단지', 900_000_000),
    t('가단지', 920_000_000),
    t('나단지', 1_000_000_000),
    t('나단지', 1_020_000_000),
    t('다단지', 700_000_000), // 1건뿐 → 제외
    t('라단지', 880_000_000, 120), // 면적 밖
    t('마단지', 910_000_000, 84, '2026-10-01', true), // 해제
    t('마단지', 905_000_000, 84, '2026-10-02', true),
    t('조회단지', 950_000_000),
    t('조회단지', 960_000_000),
  ];

  it('조회 단지·1건뿐인 단지·면적 밖·해제 거래를 제외한다', () => {
    const r = findSimilarComplexes(records, { ...params, excludeComplexName: '조회단지' });
    expect(r.map((x) => x.complexName).sort()).toEqual(['가단지', '나단지']);
  });

  it('기준 가격에 가까운 순으로 정렬하고 차이(%)를 계산한다', () => {
    const r = findSimilarComplexes(records, {
      ...params,
      excludeComplexName: '조회단지',
      referenceWon: 950_000_000,
    });
    // 가단지 중앙값 91천만(-4.2%), 나단지 101천만(+6.3%)
    expect(r.map((x) => x.complexName)).toEqual(['가단지', '나단지']);
    expect(r[0]).toMatchObject({ medianWon: 910_000_000, count: 2, diffPercent: -4.2 });
    expect(r[1]!.diffPercent).toBe(6.3);
  });

  it('기준이 없으면 거래 건수가 많은 순, limit 을 지킨다', () => {
    const r = findSimilarComplexes(records, { ...params, limit: 1 });
    expect(r).toHaveLength(1);
  });

  it('기간 밖 거래는 제외한다', () => {
    const old = [t('옛단지', 800_000_000, 84, '2024-01-01'), t('옛단지', 810_000_000, 84, '2024-01-02')];
    expect(findSimilarComplexes(old, params)).toEqual([]);
  });
});
