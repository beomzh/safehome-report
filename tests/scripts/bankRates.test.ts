import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRequestBody, monthsAgo, parseBankRates, parseBankValues } from '../../scripts/bankRates.mjs';

const bytes = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../fixtures/kfb/${name}`, import.meta.url)));

describe('은행연합회 비교공시 읽기 (실제 응답 2026-10 전세자금대출)', () => {
  const r = parseBankRates(bytes('jeonse-202610.html'));

  it('신용점수 구간 9개를 읽는다', () => {
    expect(r.scoreBands).toHaveLength(9);
    expect(r.scoreBands[0]).toContain('1000');
    expect(r.scoreBands[8]).toContain('600');
  });

  it('금리가 있는 은행만 남기고(산업은행은 공시 없음) 은행별 평균금리를 읽는다', () => {
    expect(r.banks.length).toBe(16);
    expect(r.banks.find((b) => b.name.includes('산업'))).toBeUndefined();
    const nh = r.banks.find((b) => b.name === 'NH농협은행')!;
    expect(nh.avgPercent).toBe(4.65);
    expect(nh.avgScore).toBe(939);
    expect(nh.byBand).toEqual([4.63, 4.66, 4.66, 4.71, 4.67, 4.78, 4.91, 5.51, 4.72]);
  });

  it('금리가 "-" 인 구간은 null 로 둔다', () => {
    const shinhan = r.banks.find((b) => b.name === '신한은행')!;
    expect(shinhan.byBand.slice(-2)).toEqual([null, null]);
    expect(shinhan.avgPercent).toBe(4.87);
  });

  it('은행 수와 구간 수가 맞는다', () => {
    for (const b of r.banks) expect(b.byBand).toHaveLength(r.scoreBands.length);
  });

  it('표가 없는 응답은 빈 결과', () => {
    expect(parseBankRates(new TextEncoder().encode('<html>오류</html>'))).toEqual({
      scoreBands: [],
      banks: [],
    });
  });
});

describe('요청 만들기', () => {
  it('페이지의 은행 체크박스 값(EUC-KR 퍼센트 인코딩)을 그대로 쓴다', () => {
    const values = parseBankValues(bytes('loan-household-page.html'));
    expect(values).toHaveLength(19);
    expect(values[0]).toBe('%C7%D1%B1%B9%BB%EA%BE%F7%C0%BA%C7%E0');
    const body = buildRequestBody({
      year: '2026',
      month: '10',
      loanType: '5',
      bankValues: values.slice(0, 2),
    });
    expect(body).toBe(
      'year=2026&month=10&opt_1=5&detail=0&str=%C7%D1%B1%B9%BB%EA%BE%F7%C0%BA%C7%E0%7CNH%B3%F3%C7%F9%C0%BA%C7%E0&select_new_balance=1',
    );
  });
  it('monthsAgo 는 연도 경계를 넘는다', () => {
    expect(monthsAgo('202611', 1)).toBe('202610');
    expect(monthsAgo('202601', 2)).toBe('202511');
  });
});
