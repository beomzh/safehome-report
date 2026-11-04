import { percent, RULE_VERSION, sumActiveMortgages, unknownResult, useRegistry } from './helpers';
import type { Rule } from './helpers';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

/** R-MORT-01: 선순위 근저당 채권최고액 합산 (정보). 말소된 근저당은 제외 */
export const mortgageSum: Rule = (ctx) => {
  const id = 'R-MORT-01';
  const title = '근저당 채권최고액 합계';
  const reg = useRegistry(ctx);
  if (!reg.ok) return unknownResult(id, title, reg.reason, 'info');
  const total = sumActiveMortgages(reg.registry);
  if (total === undefined) {
    return unknownResult(id, title, '채권최고액을 인식하지 못한 근저당이 있음', 'info');
  }
  const count = reg.registry.eul.filter((e) => e.type === 'mortgage' && !e.cancelled).length;
  return {
    ruleId: id,
    ruleVersion: RULE_VERSION,
    status: 'info',
    severity: 'info',
    title,
    evidence: [`미말소 근저당 ${count}건, 채권최고액 합계 ${won(total)}`],
    data: { count, totalMaxClaim: total },
  };
};

/**
 * R-LTV-01: (선순위 채권최고액 + 보증금) / 시세 × 100
 * 채권최고액은 실제 대출액보다 크게 설정되는 것이 일반적이므로 보수적(전액 반영) 계산이다.
 */
export const ltvRatio: Rule = (ctx) => {
  const id = 'R-LTV-01';
  const title = '보증금 대비 담보 비율(깡통전세 위험)';
  const { contract, market } = ctx.input;
  if (contract.kind === 'sale') {
    return {
      ruleId: id,
      ruleVersion: RULE_VERSION,
      status: 'not_applicable',
      severity: 'red',
      title,
      evidence: ['매매 계약에는 적용하지 않음'],
    };
  }
  const reg = useRegistry(ctx);
  if (!reg.ok) return unknownResult(id, title, reg.reason);
  if (!market) return unknownResult(id, title, '시세 정보 없음 (시세 입력 또는 실거래가 조회 필요)');
  const prior = sumActiveMortgages(reg.registry);
  if (prior === undefined) return unknownResult(id, title, '채권최고액을 인식하지 못한 근저당이 있음');

  const ratio = percent(prior + contract.amount, market.estimatedValue);
  const { cautionAbovePercent, dangerAbovePercent } = ctx.config.ltv;
  const evidence = [
    `(선순위 채권최고액 ${won(prior)} + 보증금 ${won(contract.amount)}) / 시세 ${won(market.estimatedValue)} = ${ratio}%`,
    `시세 출처: ${market.source}, 신뢰도: ${market.confidence}`,
  ];
  if (market.confidence === 'low') evidence.push('시세 신뢰도가 낮아 실제 비율과 차이가 클 수 있음');

  const base = {
    ruleId: id,
    ruleVersion: RULE_VERSION,
    title,
    evidence,
    data: { ratioPercent: ratio, priorClaims: prior },
  };
  if (ratio > dangerAbovePercent) {
    return {
      ...base,
      status: 'triggered',
      severity: 'red',
      action:
        '경매 시 보증금 전액을 돌려받지 못할 가능성이 큽니다. 계약 조건 재협상 또는 보증보험 가입 가능 여부를 먼저 확인하세요.',
    };
  }
  if (ratio > cautionAbovePercent) {
    return {
      ...base,
      status: 'triggered',
      severity: 'yellow',
      action: '시세 하락 시 위험할 수 있습니다. 보증보험 가입 가능 여부와 시세 근거를 확인하세요.',
    };
  }
  return { ...base, status: 'clear', severity: 'red' };
};
