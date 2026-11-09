import type { AssumptionSuggestion } from '../adapters/llm/assumptions';
import type { FinanceFormState } from './financeForm';

/** AI 제안이 채우는 입력 칸. 이 칸을 사용자가 직접 고치면 "AI 제안" 표시를 해제한다 */
export const AI_FIELDS = [
  'ltvLimitPercent',
  'dsrLimitPercent',
  'annualRatePercent',
  'stressAddPercent',
  'termYears',
] as const;
export type AiField = (typeof AI_FIELDS)[number];

export const isAiField = (key: string): key is AiField => (AI_FIELDS as readonly string[]).includes(key);

/**
 * 사용자가 확인한 AI 제안을 입력 칸에 적용한다. null(AI 가 모른다고 한 값)은 건드리지 않는다.
 * 적용된 칸 이름을 aiFields 에 기록해, 리포트가 어떤 값이 AI 제안인지 밝히게 한다.
 */
export function applySuggestion(fin: FinanceFormState, s: AssumptionSuggestion): FinanceFormState {
  const next: FinanceFormState = { ...fin };
  const fields = new Set(fin.aiFields);
  for (const key of AI_FIELDS) {
    const v = s[key];
    if (v !== null) {
      next[key] = String(v);
      fields.add(key);
    }
  }
  next.aiFields = [...fields];
  return next;
}

/**
 * 입력 칸을 사용자가 직접 고친다. AI 제안으로 채운 칸이었다면 그 칸만 "AI 제안" 목록에서 뺀다
 * (사용자가 그 값을 책임진다). 다른 칸의 AI 표시는 유지한다.
 */
export function editField(
  fin: FinanceFormState,
  key: Exclude<keyof FinanceFormState, 'enabled' | 'autoCosts' | 'aiFields'>,
  value: string,
): FinanceFormState {
  return { ...fin, [key]: value, aiFields: fin.aiFields.filter((k) => k !== key) };
}
