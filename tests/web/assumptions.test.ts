import { describe, expect, it } from 'vitest';
import type { AssumptionSuggestion } from '../../src/adapters/llm/assumptions';
import { AI_FIELDS, applySuggestion, editField, isAiField } from '../../src/web/assumptions';
import { aiAssumptionNote, buildFinancePlan, emptyFinanceForm } from '../../src/web/financeForm';

const suggestion = (over: Partial<AssumptionSuggestion> = {}): AssumptionSuggestion => ({
  ltvLimitPercent: 70,
  dsrLimitPercent: 40,
  annualRatePercent: 4.2,
  stressAddPercent: 1.5,
  termYears: 30,
  rationale: [],
  caveats: [],
  confidence: 'medium',
  ...over,
});

describe('applySuggestion', () => {
  it('제안 값을 입력 칸 문자열로 채우고 AI 표시를 켠다', () => {
    const f = applySuggestion(emptyFinanceForm(), suggestion());
    expect([
      f.ltvLimitPercent,
      f.dsrLimitPercent,
      f.annualRatePercent,
      f.stressAddPercent,
      f.termYears,
    ]).toEqual(['70', '40', '4.2', '1.5', '30']);
    expect(f.aiFields.sort()).toEqual([...AI_FIELDS].sort());
  });

  it('AI 가 모른다고 한(null) 칸은 기존 입력을 덮어쓰지 않는다', () => {
    const base = { ...emptyFinanceForm(), ltvLimitPercent: '60', dsrLimitPercent: '35' };
    const f = applySuggestion(base, suggestion({ ltvLimitPercent: null, annualRatePercent: null }));
    expect(f.ltvLimitPercent).toBe('60');
    expect(f.dsrLimitPercent).toBe('40');
    expect(f.annualRatePercent).toBe('');
  });

  it('전부 null 이면 아무것도 바뀌지 않고 AI 표시도 없다', () => {
    const none = suggestion({
      ltvLimitPercent: null,
      dsrLimitPercent: null,
      annualRatePercent: null,
      stressAddPercent: null,
      termYears: null,
    });
    const f = applySuggestion(emptyFinanceForm(), none);
    expect(f).toEqual(emptyFinanceForm());
  });

  it('소득·자산·세금 칸은 건드리지 않는다', () => {
    const base = {
      ...emptyFinanceForm(),
      assetsManwon: '20000',
      annualIncomeManwon: '6000',
      acquisitionTaxPercent: '8',
    };
    const f = applySuggestion(base, suggestion());
    expect([f.assetsManwon, f.annualIncomeManwon, f.acquisitionTaxPercent]).toEqual(['20000', '6000', '8']);
  });

  it('AI 가 채우는 칸 목록', () => {
    expect(AI_FIELDS).toHaveLength(5);
    expect(isAiField('ltvLimitPercent')).toBe(true);
    expect(isAiField('assetsManwon')).toBe(false);
  });
});

describe('칸별 AI 표시', () => {
  it('AI 가 채운 칸 중 하나를 직접 고치면 그 칸만 AI 표시에서 빠지고 나머지는 유지된다', () => {
    const filled = applySuggestion(
      emptyFinanceForm(),
      suggestion({ ltvLimitPercent: null, annualRatePercent: null }),
    );
    expect(filled.aiFields.sort()).toEqual(['dsrLimitPercent', 'stressAddPercent', 'termYears']);
    const edited = editField(filled, 'dsrLimitPercent', '35');
    expect(edited.dsrLimitPercent).toBe('35');
    expect(edited.aiFields.sort()).toEqual(['stressAddPercent', 'termYears']);
  });

  it('AI 와 무관한 칸을 고쳐도 AI 표시는 그대로다', () => {
    const filled = applySuggestion(emptyFinanceForm(), suggestion());
    const edited = editField(filled, 'assetsManwon', '20000');
    expect(edited.aiFields).toHaveLength(5);
  });

  it('사용자가 직접 입력해 채운 칸은 AI 표시가 생기지 않는다', () => {
    const edited = editField(emptyFinanceForm(), 'ltvLimitPercent', '70');
    expect(edited.aiFields).toEqual([]);
  });

  it('제안을 다시 받아 적용하면 고쳤던 칸도 다시 AI 표시가 된다', () => {
    let f = applySuggestion(emptyFinanceForm(), suggestion());
    f = editField(f, 'ltvLimitPercent', '60');
    expect(f.aiFields).not.toContain('ltvLimitPercent');
    f = applySuggestion(f, suggestion());
    expect(f.aiFields).toContain('ltvLimitPercent');
    expect(f.ltvLimitPercent).toBe('70');
  });
});

describe('AI 제안 표시가 리포트 입력에 전달된다', () => {
  const ctx = { kind: 'sale' as const, amountWon: 500_000_000 };
  it('AI 제안이 남아 있는 항목을 이름으로 밝히는 주의가 plan 에 담긴다', () => {
    const form = applySuggestion(
      emptyFinanceForm(),
      suggestion({ ltvLimitPercent: null, annualRatePercent: null }),
    );
    const filled = { ...form, ltvLimitPercent: '70', annualRatePercent: '4' }; // 직접 입력으로 채운 칸
    const plan = buildFinancePlan(filled, ctx);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.assumptionNotes).toHaveLength(1);
      const note = plan.assumptionNotes[0]!;
      expect(note).toContain('DSR 한도');
      expect(note).toContain('대출 기간');
      expect(note).not.toContain('LTV 한도');
      expect(note).toContain('공식 값이 아니며');
    }
  });
  it('직접 입력한 값뿐이면 주의가 없다', () => {
    const form = {
      ...emptyFinanceForm(),
      ltvLimitPercent: '70',
      dsrLimitPercent: '40',
      annualRatePercent: '4',
      termYears: '30',
    };
    const plan = buildFinancePlan(form, ctx);
    expect(plan.ok && plan.assumptionNotes).toEqual([]);
  });
  it('주의 문구는 항목 이름을 한글로 쓴다', () => {
    expect(aiAssumptionNote(['termYears'])).toContain('대출 기간');
  });
});
