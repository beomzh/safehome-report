import type { RulesConfig } from '../config';
import type { EulEntry, GapEntry, RegistryFacts, RiskInput, RuleResult, Won } from '../types';

export interface RuleContext {
  input: RiskInput;
  config: RulesConfig;
}
export type Rule = (ctx: RuleContext) => RuleResult;

export const RULE_VERSION = 1;

/** 성명 비교용 정규화: 공백 제거 + NFC */
export function normalizeName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '');
}

export const activeGap = (r: RegistryFacts): GapEntry[] => r.gap.filter((e) => !e.cancelled);
export const activeMortgages = (r: RegistryFacts): EulEntry[] =>
  r.eul.filter((e) => e.type === 'mortgage' && !e.cancelled);

/** 말소되지 않은 근저당의 채권최고액 합계(원). 금액 누락 항목이 있으면 undefined (합계를 신뢰할 수 없음) */
export function sumActiveMortgages(r: RegistryFacts): Won | undefined {
  let total = 0;
  for (const m of activeMortgages(r)) {
    if (m.maxClaimAmount === undefined) return undefined;
    total += m.maxClaimAmount;
  }
  return total;
}

export type RegistryUse = { ok: true; registry: RegistryFacts } | { ok: false; reason: string };

/** 등기부가 없거나 파싱 신뢰도가 낮으면 등기부 기반 룰은 판단 보류 처리한다 */
export function useRegistry({ input, config }: RuleContext): RegistryUse {
  if (!input.registry) return { ok: false, reason: '등기부 정보 없음 (등기부 업로드 필요)' };
  if (input.registry.parseConfidence < config.minParseConfidence.value) {
    return {
      ok: false,
      reason: `등기부 파싱 신뢰도 낮음 (${input.registry.parseConfidence} < ${config.minParseConfidence.value})`,
    };
  }
  return { ok: true, registry: input.registry };
}

export function unknownResult(
  ruleId: string,
  title: string,
  reason: string,
  severity: RuleResult['severity'] = 'red',
): RuleResult {
  return {
    ruleId,
    ruleVersion: RULE_VERSION,
    status: 'unknown',
    severity,
    title,
    evidence: [reason],
    action: '판단 보류: 필요한 정보를 보완한 뒤 다시 분석하세요.',
  };
}

/** YYYY-MM-DD 두 날짜 사이의 경과 개월 수 (일자 미달 시 1개월 차감) */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
}

export function percent(numerator: number, denominator: number): number {
  return Math.round(((numerator * 100) / denominator) * 10) / 10;
}
