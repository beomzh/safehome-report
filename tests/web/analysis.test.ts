import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAnalysis } from '../../src/web/analysis';
import { defaultFinanceForm } from '../../src/web/financeForm';
import { emptyForm } from '../../src/web/form';
import { defaultProfile } from '../../src/web/profile';
import { clearSession, loadSession, saveSession } from '../../src/web/sessionState';

describe('runAnalysis (방문 전 점검의 실시간 계산)', () => {
  it('금액이 없으면 오류를 돌려준다', () => {
    const out = runAnalysis(emptyForm(), defaultFinanceForm(), defaultProfile(), '2026-11-16');
    expect(out.ok).toBe(false);
  });

  it('보증금만 있어도 결론과 필요 조건을 계산한다', () => {
    const form = { ...emptyForm(), amountManwon: '30000' };
    const out = runAnalysis(form, defaultFinanceForm(), defaultProfile(), '2026-11-16');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(['go', 'conditional', 'avoid']).toContain(out.result.verdict.verdict);
    expect(out.result.requirements?.maxLoan).toBeGreaterThan(0);
  });
});

describe('sessionState (탭 안 임시 보관)', () => {
  const store = new Map<string, string>();
  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });
  const stub = () =>
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });

  it('저장한 값을 그대로 읽고, 지우면 null 이다', () => {
    stub();
    const s = {
      form: { ...emptyForm(), amountManwon: '1' },
      fin: defaultFinanceForm(),
      profile: defaultProfile(),
    };
    saveSession(s);
    expect(loadSession()?.form.amountManwon).toBe('1');
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it('깨진 값이나 접근 불가여도 던지지 않는다', () => {
    stub();
    store.set('safehome.session.v1', '{broken');
    expect(loadSession()).toBeNull();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
    });
    expect(loadSession()).toBeNull();
    expect(() =>
      saveSession({ form: emptyForm(), fin: defaultFinanceForm(), profile: defaultProfile() }),
    ).not.toThrow();
  });
});
