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
