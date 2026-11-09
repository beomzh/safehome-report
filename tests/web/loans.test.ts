import { describe, expect, it } from 'vitest';
import { LOAN_PRODUCTS, loansFor, OFFICIAL_SOURCES } from '../../src/web/loans';

describe('대출 종류 안내', () => {
  it('계약 유형별로 최소 1개 이상 안내한다', () => {
    for (const kind of ['jeonse', 'monthly', 'sale'] as const)
      expect(loansFor(kind).length).toBeGreaterThan(0);
  });

  it('전세에는 매매 상품이, 매매에는 전세 상품이 섞이지 않는다', () => {
    expect(loansFor('jeonse').some((p) => p.kinds.includes('sale'))).toBe(false);
    expect(loansFor('sale').some((p) => p.kinds.includes('jeonse'))).toBe(false);
  });

  it('id 가 중복되지 않고 모든 항목에 설명과 확인 포인트가 있다', () => {
    const ids = LOAN_PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of LOAN_PRODUCTS) {
      expect(p.summary.length).toBeGreaterThan(10);
      expect(p.checkpoints.length).toBeGreaterThan(0);
    }
  });

  it('낡기 쉬운 숫자(금리·한도·소득 기준)를 담지 않는다', () => {
    const text = LOAN_PRODUCTS.flatMap((p) => [p.summary, ...p.checkpoints]).join(' ');
    expect(text).not.toMatch(/\d+(\.\d+)?\s*%/);
    expect(text).not.toMatch(/\d[\d,]*\s*(억|만원|원)/);
  });

  it('공식 확인처를 안내한다', () => {
    expect(OFFICIAL_SOURCES.length).toBeGreaterThan(0);
  });
});
