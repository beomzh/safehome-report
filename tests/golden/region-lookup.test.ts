import { describe, expect, it } from 'vitest';
import { findDongName, findSigungu } from '../../src/core';

describe('findSigungu — 주소 → 시군구 법정동코드 (검증된 표)', () => {
  it('붙여넣은 매물 주소: 서울특별시 영등포구 신길동 → 11560', () => {
    const r = findSigungu('서울특별시 영등포구 신길동 98-17');
    expect(r).toEqual({ ok: true, match: { code: '11560', name: '서울특별시 영등포구' } });
  });

  it('시도 약칭·생략을 처리한다 (이름이 하나로 정해질 때만)', () => {
    expect(findSigungu('서울 강남구 역삼동')).toMatchObject({ ok: true, match: { code: '11680' } });
    expect(findSigungu('영등포구 신길동')).toMatchObject({ ok: true, match: { code: '11560' } });
  });

  it('구가 있는 시는 구까지 일치해야 한다 (수원시 장안구)', () => {
    const r = findSigungu('경기도 수원시 장안구 파장동');
    expect(r).toMatchObject({ ok: true, match: { name: '경기도 수원시 장안구' } });
  });

  it('시도 없는 중구·동구처럼 여러 곳에 일치하면 추측하지 않는다', () => {
    expect(findSigungu('중구 신당동')).toEqual({ ok: false, reason: 'ambiguous' });
    expect(findSigungu('부산광역시 중구 중앙동')).toMatchObject({ ok: true });
  });

  it('표에 없는 지역(2026 개편 등)은 not_found', () => {
    expect(findSigungu('인천광역시 서구 검단동')).toEqual({ ok: false, reason: 'not_found' });
    expect(findSigungu('아무 말')).toEqual({ ok: false, reason: 'not_found' });
    expect(findSigungu('세종특별자치시 한솔동')).toMatchObject({ ok: true });
  });
});

describe('findDongName', () => {
  it('주소에서 법정동을 뽑고 번지·호수는 제외한다', () => {
    expect(findDongName('서울특별시 영등포구 신길동 98-17')).toBe('신길동');
    expect(findDongName('서울특별시 동작구 여의대방로24다길 40, 101동 1305호 (대방동)')).toBe('대방동');
    expect(findDongName('경기도 수원시 장안구')).toBeUndefined();
  });
});

describe('2026-07-01 행정구역 개편 반영 (행정안전부 법정동코드 KIKcd_B.20260701)', () => {
  it.each([
    ['인천광역시 서해구 가정동', '28275'],
    ['인천 검단구 당하동', '28290'],
    ['인천광역시 제물포구 송월동1가', '28125'],
    ['인천광역시 영종구 운서동', '28155'],
    ['인천광역시 남동구 구월동', '28200'],
    ['경기도 부천시 원미구 중동', '41192'],
    ['경기도 화성시 동탄구 반송동', '41597'],
    ['경기도 화성시 만세구 향남읍', '41591'],
  ])('%s → %s', (addr, code) => {
    expect(findSigungu(addr)).toMatchObject({ ok: true, match: { code } });
  });

  it('광주광역시·전라남도 표기는 전남광주통합특별시 코드(12xxx)로 찾는다', () => {
    expect(findSigungu('광주광역시 북구 용봉동')).toMatchObject({ ok: true, match: { code: '12300' } });
    expect(findSigungu('전남 순천시 연향동')).toMatchObject({ ok: true, match: { code: '12150' } });
    expect(findSigungu('전남광주통합특별시 광산구 수완동')).toMatchObject({
      ok: true,
      match: { code: '12330' },
    });
  });

  it('경기도 광주시는 광주광역시 표기와 헷갈리지 않는다', () => {
    expect(findSigungu('경기도 광주시 오포읍')).toMatchObject({ ok: true, match: { code: '41610' } });
  });

  it('폐지된 옛 구(인천 서구·중구 등)는 찾지 않는다', () => {
    expect(findSigungu('인천광역시 서구 가정동')).toEqual({ ok: false, reason: 'not_found' });
    expect(findSigungu('인천광역시 동구 송림동')).toEqual({ ok: false, reason: 'not_found' });
  });
});
