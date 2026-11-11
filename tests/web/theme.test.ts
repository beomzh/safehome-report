import { describe, expect, it } from 'vitest';
import { parseTheme, THEME_INIT_SCRIPT, THEME_KEY } from '../../src/web/theme';

describe('theme', () => {
  it('저장값이 없거나 잘못되면 시스템 설정을 따른다', () => {
    expect(parseTheme(null)).toBe('system');
    expect(parseTheme('blue')).toBe('system');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
  });

  it('초기화 스크립트는 저장소 오류를 삼키고 light/dark 만 적용한다', () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_KEY);
    expect(THEME_INIT_SCRIPT).toContain('try{');
    expect(THEME_INIT_SCRIPT).toContain('catch');
    expect(THEME_INIT_SCRIPT).not.toContain("'system'");
  });
});
