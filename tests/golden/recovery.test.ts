import { describe, expect, it } from 'vitest';
import { evaluateRecovery, evaluateRisk, smallTenantRegion } from '../../src/core';
import { config, input, mortgage, registry } from '../helpers/builders';

const R = config.recovery;
const run = (a: Partial<Parameters<typeof evaluateRecovery>[0]> = {}) =>
  evaluateRecovery(
    { depositWon: 300_000_000, marketWon: 400_000_000, priorClaimsWon: 0, region: 'seoul', ...a },
    R,
  );
const at = (r: ReturnType<typeof run>, percent: number) => r.scenarios.find((s) => s.percent === percent)!;

describe('설정 값 (주택임대차보호법 시행령 제10·11조)', () => {
  it('지역별 소액임차인 기준이 법령 값과 같다', () => {
    expect(R.smallTenant.seoul).toEqual({ depositLimitWon: 165_000_000, amountWon: 55_000_000 });
    expect(R.smallTenant.capital).toEqual({ depositLimitWon: 145_000_000, amountWon: 48_000_000 });
    expect(R.smallTenant.metro).toEqual({ depositLimitWon: 85_000_000, amountWon: 28_000_000 });
    expect(R.smallTenant.other).toEqual({ depositLimitWon: 75_000_000, amountWon: 25_000_000 });
  });
});

describe('evaluateRecovery', () => {
  it('선순위가 없고 낙찰가가 충분하면 보증금 전액', () => {
    const r = run();
    expect(at(r, 100).recoverableWon).toBe(300_000_000);
    expect(at(r, 70).recoverableWon).toBe(280_000_000); // 낙찰가 2.8억이 한도
  });

  it('선순위가 있으면 낙찰가에서 차감한 나머지가 회수액', () => {
    const r = run({ priorClaimsWon: 200_000_000 });
    expect(at(r, 100)).toMatchObject({ priorPaidWon: 200_000_000, recoverableWon: 200_000_000 });
    expect(at(r, 100).recoveryPercent).toBe(66.7);
    expect(at(r, 70).recoverableWon).toBe(80_000_000);
  });

  it('소액임차인(서울 1.65억 이하)은 선순위보다 먼저 5,500만원을 받는다', () => {
    const r = run({ depositWon: 100_000_000, marketWon: 300_000_000, priorClaimsWon: 250_000_000 });
    expect(r.smallTenantEligible).toBe(true);
    expect(at(r, 100)).toMatchObject({ smallTenantWon: 55_000_000, recoverableWon: 55_000_000 });
    expect(at(r, 70).recoverableWon).toBe(55_000_000);
  });

  it('최우선변제는 낙찰가의 1/2 을 넘지 못한다', () => {
    const r = run({ depositWon: 100_000_000, marketWon: 60_000_000, priorClaimsWon: 0 });
    expect(at(r, 100).smallTenantWon).toBe(30_000_000);
  });

  it('보증금이 기준을 넘으면 최우선변제 대상이 아니다', () => {
    const r = run({ depositWon: 166_000_000, marketWon: 300_000_000, priorClaimsWon: 250_000_000 });
    expect(r.smallTenantEligible).toBe(false);
    expect(at(r, 100).smallTenantWon).toBe(0);
    expect(at(r, 100).recoverableWon).toBe(50_000_000);
  });

  it('지역을 모르면 최우선변제를 계산하지 않는다', () => {
    const r = run({
      depositWon: 100_000_000,
      marketWon: 300_000_000,
      priorClaimsWon: 250_000_000,
      region: 'unknown',
    });
    expect(r.smallTenantEligible).toBe('unknown');
    expect(at(r, 100).smallTenantWon).toBe(0);
  });
});

describe('smallTenantRegion', () => {
  it.each([
    ['11680', 'seoul'],
    ['41135', 'capital'], // 성남 분당
    ['41570', 'capital'], // 김포
    ['36110', 'capital'], // 세종
    ['26110', 'metro'], // 부산
    ['41271', 'metro'], // 안산
    ['26710', 'other'], // 부산 기장군(군 지역)
    ['28710', 'other'], // 인천 강화군(군 지역)
    ['43111', 'other'], // 청주
    ['28177', 'unknown'], // 인천 미추홀구(부분 지역 예외)
    ['41360', 'unknown'], // 남양주
    ['abc', 'unknown'],
  ])('%s → %s', (code, want) => {
    expect(smallTenantRegion(code)).toBe(want);
  });
});

describe('R-RECOV-01', () => {
  const rule = (over: Record<string, unknown> = {}) => {
    const rep = evaluateRisk(
      {
        ...input({ registry: undefined }),
        market: { estimatedValue: 400_000_000, source: 'trade_median', confidence: 'high' },
        regionCode: '11680',
        ...over,
      },
      config,
    );
    return { rep, r: rep.results.find((x) => x.ruleId === 'R-RECOV-01')! };
  };

  it('시나리오를 정보로 제공하고 종합 등급에는 영향이 없다', () => {
    const { rep, r } = rule();
    const base = evaluateRisk(
      {
        ...input({ registry: undefined }),
        market: { estimatedValue: 400_000_000, source: 'trade_median', confidence: 'high' },
      },
      config,
    );
    expect([r.status, r.severity]).toEqual(['info', 'info']);
    expect(r.evidence.join(' ')).toContain('낙찰가가 시세의 70%');
    expect(rep.grade).toBe(base.grade);
  });

  it('등기부가 있으면 미말소 근저당을, 없으면 융자금을 선순위로 쓰고 출처를 밝힌다', () => {
    const withReg = rule({ registry: registry({ eul: [mortgage({ maxClaimAmount: 200_000_000 })] }) }).r;
    expect(withReg.evidence.join(' ')).toContain('등기부의 미말소 근저당');
    const withLoan = rule({ statedPriorLoan: 200_000_000 }).r;
    expect(withLoan.evidence.join(' ')).toContain('확인되지 않은 값');
    const none = rule().r;
    expect(none.evidence.join(' ')).toContain('최선의 경우');
  });

  it('매매는 해당 없음, 시세 없으면 판단 보류(등급 영향 없음)', () => {
    const sale = evaluateRisk(
      { ...input({ registry: undefined }), contract: { ...input().contract, kind: 'sale' } },
      config,
    );
    expect(sale.results.find((x) => x.ruleId === 'R-RECOV-01')!.status).toBe('not_applicable');
    const noMarket = evaluateRisk({ ...input({ registry: undefined }), market: undefined }, config);
    const r = noMarket.results.find((x) => x.ruleId === 'R-RECOV-01')!;
    expect([r.status, r.severity]).toEqual(['unknown', 'info']);
  });
});
