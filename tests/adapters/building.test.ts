import { describe, expect, it } from 'vitest';
import { createBuildingService, parseBuildingJson } from '../../src/adapters/public-data/building';
import { parseJibun, resolveBjdong } from '../../src/adapters/public-data/dongLookup';
import { PublicDataError } from '../../src/adapters/public-data/aptTrade';

const body = (item: unknown) =>
  JSON.stringify({
    response: {
      header: { resultCode: '00', resultMsg: 'NORMAL SERVICE' },
      body: { items: item === undefined ? '' : { item }, totalCount: 1 },
    },
  });
// 응답 구조 검증용 합성 데이터
const sample = {
  bldNm: '가나다빌라',
  dongNm: '101',
  mainPurpsCdNm: '공동주택',
  etcPurps: '다세대주택',
  hhldCnt: 8,
  grndFlrCnt: 4,
  ugrndFlrCnt: 1,
  totArea: 512.3,
  useAprDay: '20050110',
};

describe('parseBuildingJson', () => {
  it('한 건은 배열이 아니라 객체로 와도 읽는다', () => {
    const [b] = parseBuildingJson(body(sample));
    expect(b).toMatchObject({
      label: '가나다빌라 101동',
      mainPurpose: '공동주택',
      etcPurpose: '다세대주택',
      hhldCnt: 8,
      grndFlrCnt: 4,
      useAprDay: '20050110',
    });
  });
  it('여러 건 배열과 결과 없음(빈 items)을 처리한다', () => {
    expect(parseBuildingJson(body([sample, sample]))).toHaveLength(2);
    expect(parseBuildingJson(body(undefined))).toEqual([]);
  });
  it('오류 응답은 PublicDataError', () => {
    const noKey = JSON.stringify({
      OpenAPI_ServiceResponse: {
        cmmMsgHeader: { returnReasonCode: '30', returnAuthMsg: '등록되지 않은 서비스키' },
      },
    });
    expect(() => parseBuildingJson(noKey)).toThrow(PublicDataError);
    expect(() => parseBuildingJson('not json')).toThrow(PublicDataError);
  });
});

describe('createBuildingService', () => {
  it('요청 변수를 만들고 같은 지번은 캐시한다', async () => {
    const urls: string[] = [];
    const fn = (async (u: RequestInfo | URL) => {
      urls.push(String(u));
      return new Response(body(sample));
    }) as typeof fetch;
    const s = createBuildingService({ apiKey: 'a+b', fetchFn: fn });
    const args = { sigunguCd: '11680', bjdongCd: '10300', platGbCd: '0', bun: '0012', ji: '0000' } as const;
    await s.lookup(args);
    await s.lookup(args);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('serviceKey=a%2Bb&');
    expect(urls[0]).toContain('sigunguCd=11680');
    expect(urls[0]).toContain('bjdongCd=10300');
    expect(urls[0]).toContain('_type=json');
  });
});

describe('resolveBjdong / parseJibun', () => {
  it('주소에서 시군구 아래 법정동 코드를 찾는다 (강남구 개포동 = 10300)', () => {
    expect(resolveBjdong('11680', '서울특별시 강남구 개포동 12')).toEqual({
      ok: true,
      bjdongCd: '10300',
      name: '개포동',
    });
  });
  it('2026 개편으로 새로 생긴 구도 찾는다 (서해구 가정동, 동탄구 반송동)', () => {
    expect(resolveBjdong('28275', '인천광역시 서해구 가정동')).toMatchObject({ ok: true, name: '가정동' });
    expect(resolveBjdong('41597', '경기도 화성시 동탄구 반송동')).toMatchObject({ ok: true, name: '반송동' });
  });
  it('없는 동·없는 시군구는 not_found', () => {
    expect(resolveBjdong('11680', '서울 강남구 없는동')).toEqual({ ok: false, reason: 'not_found' });
    expect(resolveBjdong('99999', '개포동')).toEqual({ ok: false, reason: 'not_found' });
  });
  it('지번을 4자리로 맞춘다', () => {
    expect(parseJibun('12')).toEqual({ platGbCd: '0', bun: '0012', ji: '0000' });
    expect(parseJibun('12-3')).toEqual({ platGbCd: '0', bun: '0012', ji: '0003' });
    expect(parseJibun('산 5-1')).toEqual({ platGbCd: '1', bun: '0005', ji: '0001' });
    expect(parseJibun('역삼로 12')).toBeNull();
    expect(parseJibun('')).toBeNull();
  });
});
