import { RULE_VERSION, unknownResult, useRegistry } from './helpers';
import type { Rule } from './helpers';

/** 'YYYY-MM-DD'의 다음 날 (대항력은 전입·점유 다음 날부터 발생) */
export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * R-PRIO-01: 대항력 발생 시점 vs 근저당 설정일 (정보)
 * 전입(점유)일·확정일자 중 늦은 날의 다음 날을 기준으로, 그 이전에 설정된 근저당을 "선순위"로 안내한다.
 * 이 룰은 등급에 영향을 주지 않는 정보 룰이다 (회수 순위 이해용).
 */
export const priorityDate: Rule = (ctx) => {
  const id = 'R-PRIO-01';
  const title = '대항력 발생 시점 대비 선순위 근저당';
  const { contract } = ctx.input;
  if (contract.kind === 'sale') {
    return {
      ruleId: id,
      ruleVersion: RULE_VERSION,
      status: 'not_applicable',
      severity: 'info',
      title,
      evidence: ['매매 계약에는 적용하지 않음'],
    };
  }
  const reg = useRegistry(ctx);
  if (!reg.ok) return unknownResult(id, title, reg.reason, 'info');
  const { moveInDate, fixedDate } = contract;
  if (!moveInDate || !fixedDate) {
    return unknownResult(id, title, '전입일 또는 확정일자(예정) 미입력', 'info');
  }

  // 대항력은 전입(+점유) 다음 날부터, 확정일자가 전입보다 늦으면 확정일자를 받은 날부터 우선변제 효력이 생긴다.
  // 같은 날 접수된 근저당은 접수 시각까지 봐야 해서 여기서는 보수적으로 선순위로 본다.
  const effectiveFrom = fixedDate > moveInDate ? fixedDate : nextDay(moveInDate);
  const mortgages = reg.registry.eul.filter((e) => e.type === 'mortgage' && !e.cancelled);
  if (mortgages.some((m) => !m.registeredAt)) {
    return unknownResult(id, title, '설정일을 인식하지 못한 근저당이 있음', 'info');
  }
  const prior = mortgages.filter((m) => (m.registeredAt as string) <= effectiveFrom);

  return {
    ruleId: id,
    ruleVersion: RULE_VERSION,
    status: 'info',
    severity: 'info',
    title,
    evidence: [
      `대항력·우선변제 효력이 생기는 날로 계산한 기준일: ${effectiveFrom} (예정일을 입력했다면 예상일이며, 같은 날 접수된 근저당은 접수 시각까지 확인해야 함)`,
      prior.length === 0
        ? '기준일 이전에 설정된 미말소 근저당 없음'
        : `기준일 이전 설정 근저당 ${prior.length}건 (보증금보다 선순위로 봄)`,
    ],
    data: { effectiveFrom, priorMortgageCount: prior.length },
    action: '계약 후에도 잔금·전입 전까지 새 근저당이 설정되지 않았는지 등기부를 재확인하세요.',
  };
};
