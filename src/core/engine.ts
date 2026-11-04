import type { RulesConfig } from './config';
import { taxChecklist } from './rules/checklist';
import type { Rule } from './rules/helpers';
import { ltvRatio, mortgageSum } from './rules/mortgage';
import { frequentTransfer, ownerMismatch, rightsRestriction, trustRegistered } from './rules/ownership';
import { priorityDate } from './rules/priority';
import { riskInputSchema } from './types';
import type { Grade, RiskReport, RuleResult } from './types';

/** 실행 순서 = 리포트 표시 순서. 새 룰은 여기에 등록한다 */
export const RULES: readonly Rule[] = [
  ownerMismatch,
  trustRegistered,
  rightsRestriction,
  frequentTransfer,
  mortgageSum,
  ltvRatio,
  priorityDate,
  taxChecklist,
];

/**
 * 종합 등급 (PRD §5.1)
 * - triggered red 가 하나라도 있으면 red, 없고 triggered yellow 가 있으면 yellow
 * - 판단 보류(unknown) 룰이 하나라도 있으면 green 이 될 수 없고 inconclusive
 * - 그 외 green("탐지된 위험 신호 없음" — 안전 보증이 아님)
 */
export function computeGrade(results: readonly RuleResult[]): Grade {
  const triggered = results.filter((r) => r.status === 'triggered');
  if (triggered.some((r) => r.severity === 'red')) return 'red';
  if (triggered.some((r) => r.severity === 'yellow')) return 'yellow';
  if (results.some((r) => r.status === 'unknown' && r.severity !== 'info')) return 'inconclusive';
  return 'green';
}

/** 입력을 검증하고 모든 룰을 실행한다. 같은 입력·설정이면 항상 같은 결과를 낸다(순수 함수) */
export function evaluateRisk(rawInput: unknown, config: RulesConfig): RiskReport {
  const input = riskInputSchema.parse(rawInput);
  const results = RULES.map((rule) => rule({ input, config }));
  return {
    rulesetVersion: config.rulesetVersion,
    asOf: input.asOf,
    grade: computeGrade(results),
    results,
  };
}
