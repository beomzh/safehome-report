import { describe, expect, it } from 'vitest';
import { parseMarketQuery } from '../../src/web/marketQuery';

const q = (s: string) => parseMarketQuery(new URLSearchParams(s));

describe('parseMarketQuery', () => {
  it('정상 입력', () => {
    expect(q('lawdCd=11680&areaM2=84.99&complexName= 래미안 ')).toEqual({
      ok: true,
      query: { lawdCd: '11680', areaM2: 84.99, complexName: '래미안' },
    });
  });
  it('단지명은 선택', () => {
    const r = q('lawdCd=11680&areaM2=59');
    expect(r.ok && r.query.complexName).toBeUndefined();
  });
  it.each(['lawdCd=1168&areaM2=84', 'lawdCd=116800&areaM2=84', 'lawdCd=abcde&areaM2=84', 'areaM2=84'])(
    '법정동코드가 5자리 숫자가 아니면 거부: %s',
    (s) => expect(q(s).ok).toBe(false),
  );
  it.each([
    'lawdCd=11680',
    'lawdCd=11680&areaM2=0',
    'lawdCd=11680&areaM2=-5',
    'lawdCd=11680&areaM2=abc',
    'lawdCd=11680&areaM2=1.2345',
  ])('면적이 올바르지 않으면 거부: %s', (s) => expect(q(s).ok).toBe(false));
});
