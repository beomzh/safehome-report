import { percent, RULE_VERSION, unknownResult } from './helpers';
import type { Rule } from './helpers';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

/**
 * R-RATIO-01: 보증금 / 시세 (등기부 없이 하는 사전 점검용 전세가율)
 *
 * 매물을 보러 가기 전, 등기부 없이 계산할 수 있는 가장 중요한 신호다. 선순위 근저당을 모르므로
 * 실제 담보 비율(R-LTV-01)의 **하한**이다. 이 값만으로 이미 기준을 넘으면 등기부를 보기 전에도
 * 위험하다고 말할 수 있다. 등기부 정보가 입력되면 R-LTV-01 이 대신 판정하므로 이 룰은 적용하지 않는다.
 * 임계치는 R-LTV-01 과 같은 설정(ltv)을 쓴다.
 */
export const depositToMarketRatio: Rule = ({ input, config }) => {
  const id = 'R-RATIO-01';
  const title = '보증금 대비 시세 비율 (사전 점검, 등기부 없이)';
  const { contract, market, registry } = input;
  const base = { ruleId: id, ruleVersion: RULE_VERSION, title };

  if (contract.kind === 'sale' || registry) {
    return {
      ...base,
      status: 'not_applicable',
      severity: 'red',
      evidence: [
        contract.kind === 'sale' ? '매매 계약에는 적용하지 않음' : '등기부 정보가 있어 R-LTV-01 로 판정',
      ],
    };
  }
  if (!market) return unknownResult(id, title, '시세 정보 없음 (실거래가 조회 또는 시세 입력 필요)');

  const ratio = percent(contract.amount, market.estimatedValue);
  const evidence = [
    `보증금 ${won(contract.amount)} / 시세 ${won(market.estimatedValue)} = ${ratio}%`,
    '선순위 근저당을 알 수 없어 보증금만으로 계산한 하한값입니다. 등기부를 확인하면 실제 비율은 더 높을 수 있습니다.',
  ];
  if (market.confidence === 'low') evidence.push('시세 신뢰도가 낮아 실제 비율과 차이가 클 수 있음');
  const withData = { ...base, evidence, data: { ratioPercent: ratio } };
  const { cautionAbovePercent, dangerAbovePercent } = config.ltv;

  if (ratio > dangerAbovePercent) {
    return {
      ...withData,
      status: 'triggered',
      severity: 'red',
      action:
        '등기부를 보기 전부터 보증금이 시세에 비해 매우 높습니다. 방문 전에 가격 조정 가능성과 보증보험 가입 가능 여부부터 확인하세요.',
    };
  }
  if (ratio > cautionAbovePercent) {
    return {
      ...withData,
      status: 'triggered',
      severity: 'yellow',
      action: '선순위 근저당이 있으면 위험해질 수 있습니다. 방문 전에 등기부를 발급받아 근저당을 확인하세요.',
    };
  }
  return { ...withData, status: 'clear', severity: 'red' };
};
