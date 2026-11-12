import { describe, expect, it } from 'vitest';
import { canFrame, normalizeViewUrl } from '../../src/web/siteViewer';
import { fitSize, pickImageFiles } from '../../src/web/imageAttach';

describe('normalizeViewUrl', () => {
  it('https 주소는 그대로, 스킴이 없으면 https 를 붙인다', () => {
    expect(normalizeViewUrl('https://kbland.kr/p/1')).toBe('https://kbland.kr/p/1');
    expect(normalizeViewUrl('kbland.kr/p/1')).toBe('https://kbland.kr/p/1');
  });
  it('javascript:·data:·file: 등과 빈 값은 거부한다', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', '', '  ']) {
      expect(normalizeViewUrl(bad)).toBeNull();
    }
  });
});

describe('canFrame', () => {
  it('프레임을 막는 것으로 확인한 사이트(네이버·호갱노노)는 false', () => {
    expect(canFrame('https://new.land.naver.com/complexes/1')).toBe(false);
    expect(canFrame('https://hogangnono.com/apt/x')).toBe(false);
  });
  it('그 밖의 사이트는 true', () => {
    expect(canFrame('https://kbland.kr/p/1')).toBe(true);
    expect(canFrame('https://www.dabangapp.com/room/1')).toBe(true);
  });
});

describe('imageAttach', () => {
  it('긴 변이 1600 을 넘으면 비율을 지켜 줄인다', () => {
    expect(fitSize(3200, 1600)).toEqual({ width: 1600, height: 800 });
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('PNG·JPEG·WebP 만 고른다', () => {
    const f = (type: string) => new File(['x'], 'a', { type });
    expect(pickImageFiles([f('image/png'), f('image/gif'), f('text/plain'), f('image/jpeg')])).toHaveLength(
      2,
    );
  });
});
