import { describe, expect, it } from 'vitest';
import { evaluateRisk } from '../../src/core';
import { config, input, mortgage, registry } from '../helpers/builders';

const base = input({ registry: undefined });
const lite = (amount: number, over: Record<string, unknown> = {}) =>
  evaluateRisk(
    {
      ...base,
      contract: { ...base.contract, amount },
      market: { estimatedValue: 1_000_000_000, source: 'trade_median', confidence: 'high' },
      ...over,
    },
    config,
  );
const ratio = (r: ReturnType<typeof lite>) => r.results.find((x) => x.ruleId === 'R-RATIO-01')!;

describe('R-RATIO-01 사전 점검 (등기부 없이)', () => {
  it('70% 이하는 clear (경계 포함)', () => {
    expect(ratio(lite(700_000_000)).status).toBe('clear');
  });

  it('70% 초과 80% 이하는 yellow', () => {
    const r = ratio(lite(701_000_000));
    expect([r.status, r.severity]).toEqual(['triggered', 'yellow']);
    expect(ratio(lite(800_000_000)).severity).toBe('yellow');
  });

  it('80% 초과는 등기부 없이도 red, 종합 등급도 red', () => {
    const report = lite(801_000_000);
    const r = ratio(report);
    expect([r.status, r.severity]).toEqual(['triggered', 'red']);
    expect(report.grade).toBe('red');
  });

  it('등기부가 없어 선순위를 모른다는 점을 근거에 밝힌다', () => {
    expect(ratio(lite(900_000_000)).evidence.join(' ')).toContain('하한값');
  });

  it('매물 설명의 융자금을 더해 하한값을 계산하고 미확인임을 밝힌다', () => {
    // 보증금 6.5억(65%)은 clear 이지만 융자금 2억을 더하면 85% → red
    const r = ratio(lite(650_000_000, { statedPriorLoan: 200_000_000 }));
    expect([r.status, r.severity]).toEqual(['triggered', 'red']);
    expect(r.data?.ratioPercent).toBe(85);
    expect(r.evidence.join(' ')).toContain('등기부로 확인되지 않았');
  });

  it('융자금이 0 이거나 없으면 결과가 달라지지 않는다', () => {
    expect(ratio(lite(650_000_000, { statedPriorLoan: 0 })).status).toBe('clear');
  });

  it('등기부가 있으면 융자금은 무시한다 (R-LTV-01 이 판정)', () => {
    const withReg = evaluateRisk(
      {
        ...input({ registry: registry() }),
        market: { estimatedValue: 1_000_000_000, source: 'trade_median', confidence: 'high' },
        statedPriorLoan: 900_000_000,
      },
      config,
    );
    expect(ratio(withReg).status).toBe('not_applicable');
  });

  it('시세가 없으면 판단 보류', () => {
    expect(ratio(lite(500_000_000, { market: undefined })).status).toBe('unknown');
  });

  it('등기부 정보가 있으면 적용하지 않고 R-LTV-01 이 판정한다', () => {
    const report = evaluateRisk(
      input({ registry: registry({ eul: [mortgage({ maxClaimAmount: 100_000_000 })] }) }),
      config,
    );
    expect(ratio(report).status).toBe('not_applicable');
    expect(report.results.find((x) => x.ruleId === 'R-LTV-01')?.status).not.toBe('not_applicable');
  });

  it('매매 계약에는 적용하지 않는다', () => {
    const report = lite(500_000_000, { contract: { ...base.contract, kind: 'sale' } });
    expect(ratio(report).status).toBe('not_applicable');
  });

  it('위험 비율이 아니면 등기부가 없는 한 판단 보류(Green 불가)', () => {
    expect(lite(500_000_000).grade).toBe('inconclusive');
  });
});
