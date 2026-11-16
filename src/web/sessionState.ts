import type { FinanceFormState } from './financeForm';
import type { FormState } from './form';
import type { ProfileState } from './profile';

/**
 * 방문 전 점검에서 입력한 값을 같은 탭의 정밀 분석 화면으로 넘기기 위해 sessionStorage 에 잠시 둔다.
 * 이 브라우저 탭에만 남고(탭을 닫으면 사라짐) 서버로 보내지 않는다. 저장소 접근이 막혀도 동작해야 한다.
 */
const KEY = 'safehome.session.v1';

export interface SessionState {
  form: FormState;
  fin: FinanceFormState;
  profile: ProfileState;
}

export function saveSession(s: SessionState): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장 실패는 무시 (시크릿 창 등) */
  }
}

export function loadSession(): SessionState | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<SessionState>;
    return s.form && s.fin && s.profile ? (s as SessionState) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}
