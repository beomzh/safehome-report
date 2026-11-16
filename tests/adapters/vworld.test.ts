import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PublicDataError } from '../../src/adapters/public-data/aptTrade';
import {
  buildPnu,
  createPublicPriceService,
  parsePublicPriceJson,
} from '../../src/adapters/public-data/vworld';

const fixture = readFileSync(
  new URL('../fixtures/public-data/vworld-price-11680-2026.json', import.meta.url),
  'utf-8',
);

describe('parsePublicPriceJson (실제 응답 2026, 강남구 개포동 12번지 107동 704호)', () => {
  it('동·호별 공시가격을 읽고 중복은 한 번만 남긴다', () => {
    const list = parsePublicPriceJson(fixture);
    expect(list).toHaveLength(1); // 응답에 같은 행이 2건 왔다
    expect(list[0]).toMatchObject({
      stdrYear: '2026',
      stdrMt: '01',
      dongNm: '107',
      hoNm: '704',
      floorNm: '7',
      areaM2: 25.35,
      priceWon: 398_000_000,
      complexName: 'SH대치1단지아파트',
    });
  });

  it('결과가 없으면(response 키) 빈 목록', () => {
    const none =
      '{"response" : {"pageNo" : "1", "resultCode" : "", "totalCount" : "0", "numOfRows" : "5", "resultMsg" : ""}}';
    expect(parsePublicPriceJson(none)).toEqual([]);
  });

  it('오류 코드는 PublicDataError 로 던지고 키는 메시지에 담지 않는다', () => {
    const bad =
      '{"apartHousingPrices" : {"resultCode" : "INCORRECT_KEY", "resultMsg" : "인증키 정보가 올바르지 않습니다."}}';
    expect(() => parsePublicPriceJson(bad)).toThrow(PublicDataError);
    expect(() => parsePublicPriceJson('not json')).toThrow(PublicDataError);
  });

  it('가격이 없거나 이상한 행은 건너뛴다', () => {
    const odd = JSON.stringify({
      apartHousingPrices: { resultCode: '', field: [{ pblntfPc: '', hoNm: '1' }, { pblntfPc: 'abc' }] },
    });
    expect(parsePublicPriceJson(odd)).toEqual([]);
  });
});

describe('buildPnu', () => {
  it('법정동코드 10자리 + 구분 + 본번·부번 4자리 (대지는 1, 산은 2)', () => {
    expect(buildPnu('11680', '10300', '0', '0012', '0000')).toBe('1168010300100120000');
    expect(buildPnu('11680', '10300', '1', '0012', '0003')).toBe('1168010300200120003');
  });
});

describe('createPublicPriceService', () => {
  it('올해 자료가 없으면 전년도로 내려가고, domain·pnu·동·호를 보낸다', async () => {
    const urls: string[] = [];
    const empty = '{"response" : {"resultCode" : "", "totalCount" : "0"}}';
    const fn = (async (u: RequestInfo | URL) => {
      urls.push(String(u));
      return new Response(urls.length === 1 ? empty : fixture);
    }) as typeof fetch;
    const s = createPublicPriceService({ apiKey: 'k', fetchFn: fn });
    const list = await s.lookup({ pnu: '1168010300100120000', dong: '107', ho: '704', thisYear: 2027 });
    expect(list).toHaveLength(1);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('stdrYear=2027');
    expect(urls[1]).toContain('stdrYear=2026');
    for (const u of urls) {
      expect(u).toContain('domain=localhost');
      expect(u).toContain('pnu=1168010300100120000');
      expect(u).toContain('dongNm=107');
      expect(u).toContain('hoNm=704');
    }
  });

  it('동을 비우면 dongNm 을 보내지 않는다', async () => {
    const urls: string[] = [];
    const fn = (async (u: RequestInfo | URL) => {
      urls.push(String(u));
      return new Response(fixture);
    }) as typeof fetch;
    await createPublicPriceService({ apiKey: 'k', fetchFn: fn }).lookup({
      pnu: '1168010300100120000',
      dong: '',
      ho: '704',
      thisYear: 2026,
    });
    expect(urls[0]).not.toContain('dongNm');
  });
});
