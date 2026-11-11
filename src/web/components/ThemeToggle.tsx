'use client';

import { useEffect, useState } from 'react';
import { parseTheme, THEME_KEY } from '../theme';
import type { ThemeChoice } from '../theme';

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

/** 화면 색상: 시스템 설정을 따르거나 라이트/다크로 고정한다 (선택은 이 브라우저에만 저장) */
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>('system');

  useEffect(() => {
    try {
      setTheme(parseTheme(localStorage.getItem(THEME_KEY)));
    } catch {
      // 저장소를 쓸 수 없으면 시스템 설정을 따른다
    }
  }, []);

  const choose = (value: ThemeChoice) => {
    setTheme(value);
    const root = document.documentElement;
    if (value === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', value);
    try {
      if (value === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, value);
    } catch {
      // 저장 실패는 무시한다 (이번 방문에서만 적용)
    }
  };

  return (
    <div className="theme-toggle" role="group" aria-label="화면 색상">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" aria-pressed={theme === o.value} onClick={() => choose(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
