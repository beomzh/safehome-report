import { describe, expect, it } from 'vitest';
import { evaluateRisk } from '../../src/core';
import { buildRiskInput, emptyForm, isValidDate, parseManwon, todayIso } from '../../src/web/form';
import type { FormState } from '../../src/web/form';
import { formatWon, gradeInfo, groupResults } from '../../src/web/present';
import { rulesConfig } from '../../src/web/rulesConfig';

const ASOF = '2026-11-04';
const base = (over: Partial<FormState> = {}): FormState => ({
  ...emptyForm(),
  amountManwon: '30,000',
  counterpartyName: '홍길동',
  ...over,
});

describe('융자금 입력', () => {
  const f = (over: Record<string, unknown>) => ({
    ...emptyForm(),
    amountManwon: '50000',
    ...over,
  });
  it('전세에서 입력한 융자금은 원 단위로 전달된다', () => {
    const r = buildRiskInput(f({ statedLoanManwon: '20,000' }), '2026-11-12');
    expect(r.ok && r.input.statedPriorLoan).toBe(200_000_000);
  });
  it('비우면 undefined, 잘못된 값은 오류, 매매에는 쓰지 않는다', () => {
    const empty = buildRiskInput(f({}), '2026-11-12');
    expect(empty.ok && empty.input.statedPriorLoan).toBeUndefined();
    expect(buildRiskInput(f({ statedLoanManwon: 'abc' }), '2026-11-12').ok).toBe(false);
    const sale = buildRiskInput(f({ kind: 'sale', statedLoanManwon: '20000' }), '2026-11-12');
    expect(sale.ok && sale.input.statedPriorLoan).toBeUndefined();
  });
});

describe('parseManwon', () => {
  it.each([
    ['35000', 350_000_000],
    ['35,000', 350_000_000],
    ['1,234,567', 12_345_670_000],
    ['0', 0],
  ])('%s → %d원', (raw, won) => {
    expect(parseManwon(raw)).toEqual({ ok: true, won });
  });

  it.each(['', 'abc', '3.5', '-100', '1,00', '1,0000', '３５'])('거부: %j', (raw) => {
    expect(parseManwon(raw).ok).toBe(false);
  });

  it('safe integer 범위를 넘으면 거부', () => {
    expect(parseManwon('9'.repeat(30)).ok).toBe(false);
  });
});

describe('isValidDate / todayIso', () => {
  it('실제 존재하는 날짜만 허용', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026/02/28')).toBe(false);
  });
  it('로컬 날짜를 YYYY-MM-DD 로 만든다', () => {
    expect(todayIso(new Date(2026, 10, 4, 23, 59))).toBe('2026-11-04');
  });
});

describe('buildRiskInput', () => {
  it('금액 필수', () => {
    const r = buildRiskInput(base({ amountManwon: '' }), ASOF);
    expect(r.ok).toBe(false);
  });

  it('Lite: 등기부 없이 만원→원 변환해 입력을 만든다', () => {
    const r = buildRiskInput(base(), ASOF);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.contract.amount).toBe(300_000_000);
      expect(r.input.registry).toBeUndefined();
    }
  });

  it('Full: 소유자·갑구 체크·근저당 행으로 registry 를 만든다', () => {
    const form = base({
      includeRegistry: true,
      owners: '홍길동',
      gapFlags: { ...emptyForm().gapFlags, seizure: true },
      mortgages: [
        { amountManwon: '12,000', registeredAt: '2020-01-01', cancelled: false },
        { amountManwon: '', registeredAt: '', cancelled: false },
      ],
      transfers: [{ registeredAt: '2025-03-01' }],
    });
    const r = buildRiskInput(form, ASOF);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.registry?.eul).toHaveLength(1); // 빈 행 무시
      expect(r.input.registry?.eul[0]?.maxClaimAmount).toBe(120_000_000);
      expect(r.input.registry?.gap.map((g) => g.type)).toEqual(['seizure', 'ownership_transfer']);
    }
  });

  it('Full 인데 소유자 미입력이면 오류', () => {
    expect(buildRiskInput(base({ includeRegistry: true }), ASOF).ok).toBe(false);
  });

  it('공동소유자는 쉼표·줄바꿈으로 구분', () => {
    const r = buildRiskInput(base({ includeRegistry: true, owners: '홍길동, 김영희\n이철수' }), ASOF);
    expect(r.ok && r.input.registry?.owners.map((o) => o.name)).toEqual(['홍길동', '김영희', '이철수']);
  });

  it('잘못된 날짜·금액은 오류 메시지를 모은다', () => {
    const r = buildRiskInput(
      base({
        moveInDate: '2026-13-01',
        marketManwon: '3.5',
        includeRegistry: true,
        owners: '홍길동',
        mortgages: [{ amountManwon: 'x', registeredAt: '', cancelled: false }],
      }),
      ASOF,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('폼 → 엔진 통합', () => {
  it('Lite 입력은 판단 보류가 된다 (Green 불가)', () => {
    const r = buildRiskInput(base({ marketManwon: '50,000' }), ASOF);
    expect(r.ok).toBe(true);
    if (r.ok) expect(evaluateRisk(r.input, rulesConfig).grade).toBe('inconclusive');
  });

  it('소유자 불일치 + 깡통 비율이면 red', () => {
    const r = buildRiskInput(
      base({
        marketManwon: '35,000',
        includeRegistry: true,
        owners: '김철수',
        mortgages: [{ amountManwon: '10,000', registeredAt: '2020-01-01', cancelled: false }],
      }),
      ASOF,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(evaluateRisk(r.input, rulesConfig).grade).toBe('red');
  });

  it('말소된 근저당은 합산되지 않아 green 이 가능하다', () => {
    const r = buildRiskInput(
      base({
        marketManwon: '50,000',
        moveInDate: '2026-12-01',
        fixedDate: '2026-12-01',
        includeRegistry: true,
        owners: '홍길동',
        mortgages: [{ amountManwon: '90,000', registeredAt: '2020-01-01', cancelled: true }],
      }),
      ASOF,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(evaluateRisk(r.input, rulesConfig).grade).toBe('green');
  });
});

describe('present', () => {
  it('등급별 라벨', () => {
    expect(gradeInfo('inconclusive').label).toBe('판단 보류');
    expect(gradeInfo('green').label).toContain('위험 신호 없음');
  });

  it('groupResults: not_applicable 은 숨기고 red 를 먼저 둔다', () => {
    const r = buildRiskInput(
      base({
        kind: 'sale',
        includeRegistry: true,
        owners: '김철수',
        gapFlags: { ...emptyForm().gapFlags, trust: true },
      }),
      ASOF,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const g = groupResults(evaluateRisk(r.input, rulesConfig).results);
      expect(g.risks[0]?.severity).toBe('red');
      const all = [...g.risks, ...g.pending, ...g.info, ...g.clear].map((x) => x.ruleId);
      expect(all).not.toContain('R-LTV-01'); // 매매는 not_applicable
    }
  });

  it('formatWon', () => {
    expect(formatWon(350_000_000)).toBe('3억 5,000만원');
    expect(formatWon(120_000_000)).toBe('1억 2,000만원');
    expect(formatWon(5_000_000)).toBe('500만원');
    expect(formatWon(0)).toBe('0원');
  });
});
