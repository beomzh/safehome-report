import { describe, expect, it } from 'vitest';
import { parseTradeXml } from '../../src/adapters/public-data/aptTrade';
import { HOUSING } from '../../src/adapters/public-data/housing';
import { createTradeService } from '../../src/adapters/public-data/tradeService';
import { parseMarketQuery } from '../../src/web/marketQuery';

// 연립다세대·오피스텔 응답 필드는 공식 명세 기준 추정이다 (실제 응답 미검증). 합성 응답으로 동작만 확인한다.
const item = (nameTag: string, name: string, amount: string) =>
  `<item><${nameTag}>${name}</${nameTag}><cdealType> </cdealType><dealAmount>${amount}</dealAmount>` +
  `<dealDay>10</dealDay><dealMonth>10</dealMonth><dealYear>2026</dealYear><excluUseAr>45.5</excluUseAr></item>`;
const body = (items: string) =>
  `<response><header><resultCode>000</resultCode></header><body><items>${items}</items><totalCount>1</totalCount></body></response>`;

describe('주택 유형별 매매 실거래', () => {
  it('건물명 태그를 유형별로 읽는다', () => {
    const r = parseTradeXml(body(item('mhouseNm', '합성빌라', '25,000')), 'mhouseNm');
    expect(r.records).toHaveLength(1);
    expect(r.records[0]).toMatchObject({ complexName: '합성빌라', amountWon: 250_000_000, areaM2: 45.5 });
    expect(
      parseTradeXml(body(item('offiNm', '합성오피스텔', '18,000')), 'offiNm').records[0]?.complexName,
    ).toBe('합성오피스텔');
  });

  it('유형에 맞는 엔드포인트를 호출하고 캐시를 유형별로 나눈다', async () => {
    const urls: string[] = [];
    const fn = (async (u: RequestInfo | URL) => {
      urls.push(String(u));
      return new Response(body(item('offiNm', 'x', '18,000')));
    }) as typeof fetch;
    const s = createTradeService({ apiKey: 'k', fetchFn: fn });
    await s.fetchMonth('11680', '202610', 'officetel');
    await s.fetchMonth('11680', '202610', 'apt');
    await s.fetchMonth('11680', '202610', 'officetel'); // 캐시 적중
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('RTMSDataSvcOffiTrade');
    expect(urls[1]).toContain('RTMSDataSvcAptTradeDev');
  });

  it('권한 없는 키(오류 30)는 빌라·오피스텔에서 활용신청 안내로 바뀐다', async () => {
    const denied = `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>X</errMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;
    const fn = (async () => new Response(denied)) as typeof fetch;
    const s = createTradeService({ apiKey: 'k', fetchFn: fn, retries: 0 });
    await expect(s.fetchMonth('11680', '202610', 'rowhouse')).rejects.toThrow(/활용신청/);
    await expect(s.fetchMonth('11680', '202610', 'apt')).rejects.toThrow(/등록되지 않은 서비스 키/);
  });

  it('명세: 아파트만 검증됨으로 표시된다', () => {
    expect(
      Object.entries(HOUSING)
        .filter(([, v]) => v.verified)
        .map(([k]) => k),
    ).toEqual(['apt']);
  });

  it('쿼리의 housing 은 기본 apt 이고 알 수 없는 값은 거부한다', () => {
    const base = 'lawdCd=11680&areaM2=45';
    const ok = parseMarketQuery(new URLSearchParams(base));
    expect(ok.ok && ok.query.housing).toBe('apt');
    const r = parseMarketQuery(new URLSearchParams(`${base}&housing=officetel`));
    expect(r.ok && r.query.housing).toBe('officetel');
    expect(parseMarketQuery(new URLSearchParams(`${base}&housing=villa`)).ok).toBe(false);
  });
});
