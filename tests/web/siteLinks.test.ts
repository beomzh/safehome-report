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
