import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRentXml, PublicDataError } from '../../src/adapters/public-data/aptTrade';

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/public-data/${name}`, import.meta.url), 'utf-8');

describe('parseRentXml — 실제 응답 샘플(2025-10, 강남구)', () => {
  it.each([
    ['apt-rent-11680-202510.xml', 'aptNm', 'excluUseAr'],
    ['offi-rent-11680-202510.xml', 'offiNm', 'excluUseAr'],
    ['rowhouse-rent-11680-202510.xml', 'mhouseNm', 'excluUseAr'],
    ['house-rent-11680-202510.xml', 'umdNm', 'totalFloorAr'],
  ])('%s 를 정규화한다', (file, nameTag, areaTag) => {
    const r = parseRentXml(fixture(file), nameTag, areaTag);
    expect(r.records.length).toBeGreaterThan(0);
    expect(r.skipped).toBe(0);
    for (const x of r.records) {
      expect(x.depositWon).toBeGreaterThan(0);
      expect(x.monthlyRentWon).toBeGreaterThanOrEqual(0);
      expect(x.dealDate).toMatch(/^2025-10-\d{2}$/);
    }
  });

  it('쉼표가 든 금액을 원 단위로 바꾸고 갱신 여부를 읽는다', () => {
    const xml =
      '<response><header><resultCode>000</resultCode></header><body><items>' +
      '<item><aptNm>가나다</aptNm><contractType>갱신</contractType><dealDay>3</dealDay><dealMonth>10</dealMonth><dealYear>2025</dealYear><deposit>50,000</deposit><monthlyRent>0</monthlyRent><excluUseAr>84.9</excluUseAr></item>' +
      '<item><aptNm>가나다</aptNm><contractType> </contractType><dealDay>4</dealDay><dealMonth>10</dealMonth><dealYear>2025</dealYear><deposit>1,000</deposit><monthlyRent>120</monthlyRent><excluUseAr>84.9</excluUseAr></item>' +
      '</items><totalCount>2</totalCount></body></response>';
    const { records } = parseRentXml(xml, 'aptNm');
    expect(records[0]).toMatchObject({ depositWon: 500_000_000, monthlyRentWon: 0, renewal: true });
    expect(records[1]).toMatchObject({ depositWon: 10_000_000, monthlyRentWon: 1_200_000, renewal: false });
  });

  it('오류 응답은 PublicDataError 로 던진다', () => {
    const err =
      '<response><header><resultCode>30</resultCode><resultMsg>SERVICE KEY IS NOT REGISTERED</resultMsg></header></response>';
    expect(() => parseRentXml(err, 'aptNm')).toThrow(PublicDataError);
  });
});
