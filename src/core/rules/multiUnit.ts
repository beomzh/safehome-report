import { RULE_VERSION } from './helpers';
import type { Rule } from './helpers';

/**
 * R-MULTI-01: 다가구·단독주택의 다른 임차인 보증금(선순위) 확인.
 * 다가구는 한 건물(토지·건물 등기)에 임차인이 여러 명이라, 등기부의 근저당만으로는 선순위 채권을 다 알 수 없다.
 * 먼저 전입·확정일자를 받은 다른 임차인의 보증금이 내 보증금보다 먼저 변제될 수 있다. 이 도구는 그 금액을 알 수 없으므로
 * 주택 유형이 단독·다가구인 전세·월세 계약에서는 확인 조건으로 올려 yellow 로 알린다(판단 보류가 아니라 반드시 확인할 일).
 * 다른 유형이거나 매매면 해당 없음.
 */
export const multiUnitTenants: Rule = ({ input }) => {
  const id = 'R-MULTI-01';
  const title = '다가구·단독주택의 다른 임차인 보증금(선순위) 확인';
  const base = { ruleId: id, ruleVersion: RULE_VERSION, title };
  if (input.contract.kind === 'sale' || input.housingType !== 'house') {
    return {
      ...base,
      status: 'not_applicable',
      severity: 'yellow',
      evidence: [
        input.contract.kind === 'sale' ? '매매 계약에는 적용하지 않음' : '주택 유형이 단독·다가구가 아님',
      ],
    };
  }
  return {
    ...base,
    status: 'triggered',
    severity: 'yellow',
    evidence: [
      '단독·다가구는 한 건물에 임차인이 여러 명이라, 등기부의 근저당만으로는 선순위 채권을 알 수 없습니다.',
      '먼저 전입신고와 확정일자를 받은 다른 임차인의 보증금(그리고 국세·지방세 체납)이 내 보증금보다 먼저 변제될 수 있고, 이 도구는 그 금액을 계산하지 못합니다.',
    ],
    action:
      '계약 전에 임대인의 동의를 받아 건물의 전입세대 확인서와 다른 임차인의 확정일자 부여 현황(보증금 합계), 임대인의 국세·지방세 완납 여부를 확인하고, 선순위 근저당과 다른 임차인 보증금을 모두 더한 금액이 시세에 비해 높지 않은지 따져 보세요.',
  };
};
