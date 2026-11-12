import { evaluateRecovery } from '../recovery';
import { smallTenantRegion } from '../region/smallTenant';
import type { SmallTenantRegion } from '../region/smallTenant';
import { RULE_VERSION, sumActiveMortgages, useRegistry } from './helpers';
import type { Rule } from './helpers';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const REGION_LABEL: Record<SmallTenantRegion, string> = {
  seoul: '서울특별시',
  capital: '과밀억제권역(서울 제외)·세종·용인·화성·김포',
  metro: '광역시 등',
  other: '그 밖의 지역',
  unknown: '확인 불가',
};

/**
 * R-RECOV-01: 경매 시 보증금 회수 가능액 (시나리오, 정보).
 * 낙찰가율은 예측이 아니라 가정이고 종합 등급에는 영향을 주지 않는다(severity info). 판정은 R-LTV-01·R-RATIO-01 이 한다.
 * 계산 순서와 한계는 evaluateRecovery 참고. 월세는 환산보증금 기준이라 지원하지 않는다.
 */
export const recoverableDeposit: Rule = (ctx) => {
  const { input, config } = ctx;
  const id = 'R-RECOV-01';
  const title = '경매 시 보증금 회수 가능액 (시나리오)';
  const base = { ruleId: id, ruleVersion: RULE_VERSION, title };
  const unknown = (reason: string) => ({
    ...base,
    status: 'unknown' as const,
    severity: 'info' as const,
    evidence: [reason],
  });

  if (input.contract.kind === 'sale') {
    return { ...base, status: 'not_applicable', severity: 'info', evidence: ['매매 계약에는 적용하지 않음'] };
  }
  if (input.contract.kind === 'monthly') {
    return unknown('월세는 환산보증금(보증금 + 월세 × 100) 기준으로 소액임차인을 가려야 해 지원하지 않음');
  }
  if (!input.market) return unknown('시세 정보 없음 (시세 입력 또는 실거래가 조회 필요)');

  let prior = 0;
  const notes: string[] = [];
  const reg = useRegistry(ctx);
  if (reg.ok) {
    const sum = sumActiveMortgages(reg.registry);
    if (sum === undefined) return unknown('채권최고액을 인식하지 못한 근저당이 있음');
    prior = sum;
    notes.push(`선순위: 등기부의 미말소 근저당 채권최고액 ${won(prior)}`);
  } else if (input.statedPriorLoan !== undefined && input.statedPriorLoan > 0) {
    prior = input.statedPriorLoan;
    notes.push(
      `선순위: 매물 설명의 융자금 ${won(prior)} (등기부로 확인되지 않은 값, 채권최고액은 보통 더 큼)`,
    );
  } else {
    notes.push(
      '선순위 근저당을 알 수 없어 0 으로 계산했습니다. 실제 회수액은 이보다 적을 수 있습니다(최선의 경우).',
    );
  }

  const region = input.regionCode ? smallTenantRegion(input.regionCode) : 'unknown';
  const r = evaluateRecovery(
    {
      depositWon: input.contract.amount,
      marketWon: input.market.estimatedValue,
      priorClaimsWon: prior,
      region,
    },
    config.recovery,
  );

  const evidence = [
    `보증금 ${won(input.contract.amount)}, 시세 ${won(input.market.estimatedValue)}`,
    ...notes,
    region === 'unknown'
      ? '지역 구분(소액임차인 기준)을 정하지 못해 최우선변제는 계산하지 않았습니다.'
      : `소액임차인 지역 구분: ${REGION_LABEL[region]} — 보증금 ${
          r.smallTenantEligible === true ? '기준 이하라 최우선변제 대상' : '기준 초과라 최우선변제 대상 아님'
        }`,
    ...r.scenarios.map(
      (s) =>
        `낙찰가가 시세의 ${s.percent}%(${won(s.auctionPriceWon)})면: ${
          s.smallTenantWon > 0 ? `최우선변제 ${won(s.smallTenantWon)} + ` : ''
        }선순위 ${won(s.priorPaidWon)} 차감 후 회수 가능 ${won(s.recoverableWon)} (보증금의 ${s.recoveryPercent}%)`,
    ),
    '낙찰가율은 예측이 아니라 가정입니다. 국세·당해세, 경매비용, 다른 임차인은 반영하지 않았고, 전입신고·점유·확정일자를 갖춘 경우의 계산입니다.',
  ];
  return {
    ...base,
    status: 'info',
    severity: 'info',
    evidence,
    data: { region, worstRecoveryPercent: Math.min(...r.scenarios.map((s) => s.recoveryPercent)) },
    action: '회수율이 100% 미만인 시나리오가 있으면 보증보험 가입 가능 여부와 선순위 권리를 확인하세요.',
  };
};
