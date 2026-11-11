import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAptTradeXml, PublicDataError } from '../../src/adapters/public-data/aptTrade';

/** 실제 API 응답(강남구 2025-10, numOfRows=3)을 저장한 픽스처 */
const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/public-data/${name}`, import.meta.url), 'utf-8');

const item = (o: { name?: string; amount?: string; cdeal?: string } = {}) =>
  `<item><aptNm>${o.name ?? '테스트단지'}</aptNm><cdealType>${o.cdeal ?? ' '}</cdealType><dealAmount>${o.amount ?? '50,000'}</dealAmount>` +
  `<dealDay>5</dealDay><dealMonth>9</dealMonth><dealYear>2026</dealYear><excluUseAr>84.99</excluUseAr></item>`;
const wrap = (items: string, total = 1) =>
  `<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>${items}</items><totalCount>${total}</totalCount></body></response>`;

describe('parseAptTradeXml — 실제 응답 픽스처', () => {
  const r = parseAptTradeXml(fixture('apt-trade-11680-202510.xml'));

  it('3건을 모두 정규화하고 전체 건수를 읽는다', () => {
    expect(r.records).toHaveLength(3);
    expect(r.skipped).toBe(0);
    expect(r.totalCount).toBe(311);
  });

  it('거래금액(만원, 쉼표)을 원 단위 정수로, 날짜를 YYYY-MM-DD 로 변환한다', () => {
    expect(r.records[0]).toEqual({
      amountWon: 1_540_000_000,
      areaM2: 31.402,
      dealDate: '2025-10-23',
      complexName: '삼성동힐스테이트 1단지',
      dongName: '삼성동',
      cancelled: false,
    });
  });

  it('모든 금액은 안전한 양의 정수(원)', () => {
    for (const rec of r.records) {
      expect(Number.isSafeInteger(rec.amountWon)).toBe(true);
      expect(rec.amountWon % 10_000).toBe(0);
      expect(rec.amountWon).toBeGreaterThan(0);
    }
  });
});

describe('parseAptTradeXml — 변형 케이스', () => {
  it('cdealType 이 채워진 거래는 해제로 표시한다', () => {
    const r = parseAptTradeXml(wrap(item({ cdeal: 'O' }) + item()));
    expect(r.records.map((x) => x.cancelled)).toEqual([true, false]);
  });

  it('XML 엔티티를 복원한다', () => {
    const r = parseAptTradeXml(wrap(item({ name: 'A&amp;B 아파트' })));
    expect(r.records[0]?.complexName).toBe('A&B 아파트');
  });

  it('금액이 비었거나 형식이 틀린 항목은 건너뛰고 개수를 센다', () => {
    const r = parseAptTradeXml(wrap(item({ amount: ' ' }) + item({ amount: 'abc' }) + item(), 3));
    expect(r.records).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });

  it('결과가 없으면 빈 목록', () => {
    const r = parseAptTradeXml(wrap('', 0));
    expect(r).toEqual({ records: [], totalCount: 0, skipped: 0 });
  });

  it('resultCode 가 000 이 아니면 코드를 담은 오류', () => {
    const xml =
      '<response><header><resultCode>22</resultCode><resultMsg>LIMIT</resultMsg></header></response>';
    expect(() => parseAptTradeXml(xml)).toThrow(PublicDataError);
    try {
      parseAptTradeXml(xml);
    } catch (e) {
      expect((e as PublicDataError).code).toBe('22');
      expect((e as PublicDataError).message).toContain('한도');
    }
  });

  it('게이트웨이 인증 오류 형식(returnReasonCode)도 처리한다', () => {
    const xml =
      '<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>';
    expect(() => parseAptTradeXml(xml)).toThrow(/30/);
  });

  it('XML 이 아닌 응답은 거부한다', () => {
    expect(() => parseAptTradeXml('<html>502 Bad Gateway</html>')).toThrow(PublicDataError);
  });
});
