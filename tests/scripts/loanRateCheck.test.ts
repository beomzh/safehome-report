import { describe, expect, it } from 'vitest';
import {
  daysSince,
  diffGrid,
  diffWolse,
  flattenGrid,
  GRID_PRODUCTS,
  parseHousingStableWolse,
  parseLoanRates,
  parseYouthWolse,
} from '../../scripts/loanRateCheck.mjs';
import { rateInfoFor } from '../../src/web/loanRates';

describe('parseLoanRates', () => {
  it('LOANRATE, LOANRATE1, … 을 번호 순서로 읽는다', () => {
    const text =
      '{arrJson : [{"LOANRATE" : "1.30","LOANRATE1" : "1.40","LOANRATE10" : "2.10","LOANRATE2" : "1.50"}]}';
    expect(parseLoanRates(text)).toEqual([1.3, 1.4, 1.5, 2.1]);
  });
  it('금리가 없으면 빈 목록', () => {
    expect(parseLoanRates('<html>오류</html>')).toEqual([]);
  });
});

describe('diffGrid', () => {
  const saved = [1.3, 1.4, 1.5];
  it('같으면 차이 없음', () => {
    expect(diffGrid('x', saved, [1.3, 1.4, 1.5])).toEqual([]);
  });
  it('값이 바뀌면 몇 번째 칸이 얼마에서 얼마로 바뀌었는지 알린다', () => {
    expect(diffGrid('x', saved, [1.3, 1.5, 1.5])).toEqual(['x: 2번째 칸 1.4% → 1.5%']);
  });
  it('칸 수가 다르거나 읽지 못하면 구조 변경으로 알린다', () => {
    expect(diffGrid('x', saved, [1.3, 1.4])[0]).toContain('칸 수가 다릅니다');
    expect(diffGrid('x', saved, [])[0]).toContain('읽지 못했습니다');
  });
});

describe('저장된 칸별 금리표 ↔ 점검 대상', () => {
  it('점검 대상 5개 상품은 모두 저장된 grid 를 갖고 있다', () => {
    for (const g of GRID_PRODUCTS) {
      const info = rateInfoFor(g.id);
      expect(info?.grid, g.id).toBeDefined();
      expect(flattenGrid(info!.grid!).length).toBe(info!.grid!.rows.length * info!.grid!.cols.length);
    }
  });
});

describe('월세 상품 페이지 문구', () => {
  it('주거안정월세대출: 우대형·일반형 금리를 읽는다 (태그·공백 섞인 HTML)', () => {
    const html = '<p>(우대형) 연 1.3%</p> <p>(일반형)&nbsp;연 1.8%</p>';
    expect(parseHousingStableWolse(html)).toEqual({ preferred: 1.3, general: 1.8 });
  });
  it('청년전용 보증부월세대출: 보증금·월세금 금리와 한도를 읽는다', () => {
    const html = '(보증금) 연 1.3% (월세금) 연0% (20만원 한도),  1.0%';
    expect(parseYouthWolse(html)).toEqual({
      deposit: 1.3,
      rentWithinLimit: 0,
      limitManwon: 20,
      rentOverLimit: 1.0,
    });
  });
  it('문구가 없으면 undefined', () => {
    expect(parseHousingStableWolse('<p>준비 중</p>')).toBeUndefined();
    expect(parseYouthWolse('')).toBeUndefined();
  });

  it('저장값과 같으면 차이 없고, 금리가 바뀌면 알린다', () => {
    const stable = rateInfoFor('housing-stable-wolse')!;
    expect(diffWolse('housing-stable-wolse', stable, { preferred: 1.3, general: 1.8 })).toEqual([]);
    expect(diffWolse('housing-stable-wolse', stable, { preferred: 1.3, general: 2.0 })).toEqual([
      'housing-stable-wolse 일반형: 1.8% → 2%',
    ]);
    const youth = rateInfoFor('youth-wolse')!;
    expect(
      diffWolse('youth-wolse', youth, {
        deposit: 1.3,
        rentWithinLimit: 0,
        limitManwon: 20,
        rentOverLimit: 1.0,
      }),
    ).toEqual([]);
    expect(diffWolse('youth-wolse', youth, undefined)[0]).toContain('읽지 못했습니다');
  });
});

describe('daysSince', () => {
  it('두 날짜 사이 일수', () => {
    expect(daysSince('2026-11-09', '2026-11-12')).toBe(3);
  });
});
