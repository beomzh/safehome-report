import { describe, expect, it } from 'vitest';
import { SITE_GROUPS } from '../../src/web/siteLinks';

describe('SITE_GROUPS', () => {
  const links = SITE_GROUPS.flatMap((g) => g.links);
  it('모든 링크는 https 이고 중복이 없다', () => {
    expect(links.every((l) => l.url.startsWith('https://'))).toBe(true);
    expect(new Set(links.map((l) => l.url)).size).toBe(links.length);
  });
  it('쿼리 문자열(개인정보 전달 경로)이 없다', () => {
    expect(links.every((l) => !l.url.includes('?'))).toBe(true);
  });
});

describe('complexSearchLinks — 대안 단지 검색 링크', () => {
  it('일반 검색에는 지역을 붙이고, 네이버 부동산 단지 검색은 단지명만 쓴다', async () => {
    const { complexSearchLinks } = await import('../../src/web/siteLinks');
    const [land, search] = complexSearchLinks('더원캐슬', '서울특별시 동대문구');
    expect(land!.url).toBe(`https://new.land.naver.com/search?sk=${encodeURIComponent('더원캐슬')}`);
    expect(decodeURIComponent(search!.url)).toContain('서울특별시 동대문구 더원캐슬');
    expect(decodeURIComponent(complexSearchLinks('더원캐슬')[1]!.url)).toContain('query=더원캐슬+매물');
  });
});
