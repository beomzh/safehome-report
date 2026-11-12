import type { RulesConfig } from './config';
import type { SmallTenantRegion } from './region/smallTenant';

export interface RecoveryScenario {
  /** 시세 대비 낙찰가 가정 (%) */
  percent: number;
  auctionPriceWon: number;
  /** 소액임차인 최우선변제로 받는 금액 (해당 없으면 0) */
  smallTenantWon: number;
  /** 선순위 채권(근저당 채권최고액 등)으로 빠지는 금액 */
  priorPaidWon: number;
  recoverableWon: number;
  /** 회수 가능액 ÷ 보증금 (%) */
  recoveryPercent: number;
}

export interface RecoveryResult {
  smallTenantEligible: boolean | 'unknown';
  scenarios: RecoveryScenario[];
}

/**
 * 경매로 넘어갈 때 보증금을 얼마나 돌려받을 수 있는지 시나리오별로 계산한다 (순수 함수).
 * 순서: ① 소액임차인 최우선변제(낙찰가의 1/2 한도) → ② 선순위 채권 → ③ 확정일자 임차인(보증금 나머지).
 * 임차인이 대항력(전입·점유)과 확정일자를 갖췄고 선순위 채권이 임차인보다 앞선다고 가정한다.
 * 국세·당해세, 경매비용, 다른 소액임차인, 후순위 권리자 배당은 계산하지 않는다(실제 회수액은 더 적을 수 있다).
 */
export function evaluateRecovery(
  args: {
    depositWon: number;
    marketWon: number;
    priorClaimsWon: number;
    region: SmallTenantRegion;
  },
  config: RulesConfig['recovery'],
): RecoveryResult {
  const bracket = args.region === 'unknown' ? undefined : config.smallTenant[args.region];
  const eligible: boolean | 'unknown' = bracket ? args.depositWon <= bracket.depositLimitWon : 'unknown';

  const scenarios = config.scenarioPercents.map((percent): RecoveryScenario => {
    const price = Math.floor((args.marketWon * percent) / 100);
    const small =
      bracket && eligible === true ? Math.min(bracket.amountWon, Math.floor(price / 2), args.depositWon) : 0;
    const afterSmall = price - small;
    const prior = Math.min(args.priorClaimsWon, afterSmall);
    const rest = Math.max(0, args.depositWon - small);
    const fixed = Math.min(rest, afterSmall - prior);
    const recoverable = small + fixed;
    return {
      percent,
      auctionPriceWon: price,
      smallTenantWon: small,
      priorPaidWon: prior,
      recoverableWon: recoverable,
      recoveryPercent: Math.round((recoverable * 1000) / args.depositWon) / 10,
    };
  });
  return { smallTenantEligible: eligible, scenarios };
}
