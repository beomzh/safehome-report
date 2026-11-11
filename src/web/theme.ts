export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_KEY = 'safehome-theme';

export const isThemeChoice = (v: unknown): v is ThemeChoice =>
  v === 'system' || v === 'light' || v === 'dark';

/** 저장된 값이 없거나 잘못되면 시스템 설정을 따른다 */
export function parseTheme(raw: string | null): ThemeChoice {
  return isThemeChoice(raw) ? raw : 'system';
}

/** 페이지가 그려지기 전에 실행해 깜빡임을 막는 인라인 스크립트 (저장소 접근 실패 시 아무것도 하지 않음) */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
