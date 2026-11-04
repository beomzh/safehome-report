import { describe, expect, it } from 'vitest';
import { evaluateRisk } from '../../src/core';
import { config, gap, input, mortgage, registry } from '../helpers/builders';

const priority = (raw = input()) => evaluateRisk(raw, config).results.find((r) => r.ruleId === 'R-PRIO-01')!;

describe('종합 등급', () => {
  it('모든 룰이 clear 이면 green', () => {
    expect(evaluateRisk(input(), config).grade).toBe('green');
  });

  it('red 룰이 하나라도 있으면 red', () => {
    const report = evaluateRisk(input({ registry: registry({ gap: [gap({ type: 'seizure' })] }) }), config);
    expect(report.grade).toBe('red');
  });

  it('red 없이 yellow 만 있으면 yellow', () => {
    const base = input();
    const report = evaluateRisk(
      input({ contract: { ...base.contract, amount: 380_000_000 } }), // 76% → yellow
      config,
    );
    expect(report.grade).toBe('yellow');
  });

  it('등기부가 없으면 green 이 될 수 없고 판단 보류', () => {
    expect(evaluateRisk(input({ registry: undefined }), config).grade).toBe('inconclusive');
  });

  it('시세가 없으면(룰 판단 불가) green 이 될 수 없다', () => {
    expect(evaluateRisk(input({ market: undefined }), config).grade).toBe('inconclusive');
  });

  it('위험 신호가 있으면 판단 보류 룰이 있어도 위험 등급이 우선한다', () => {
    const report = evaluateRisk(
      input({ market: undefined, registry: registry({ gap: [gap({ type: 'trust' })] }) }),
      config,
    );
    expect(report.grade).toBe('red');
  });

  it('같은 입력이면 항상 같은 결과 (결정성)', () => {
    expect(evaluateRisk(input(), config)).toEqual(evaluateRisk(input(), config));
  });

  it('리포트에 룰셋 버전과 기준일이 기록된다', () => {
    const report = evaluateRisk(input(), config);
    expect(report.rulesetVersion).toBe(config.rulesetVersion);
    expect(report.asOf).toBe('2026-11-04');
  });
});

describe('입력 검증', () => {
  it('음수·소수 금액은 거부한다', () => {
    const base = input();
    expect(() => evaluateRisk(input({ contract: { ...base.contract, amount: -1 } }), config)).toThrow();
    expect(() => evaluateRisk(input({ contract: { ...base.contract, amount: 1.5 } }), config)).toThrow();
  });

  it('날짜 형식이 틀리면 거부한다', () => {
    expect(() => evaluateRisk({ ...input(), asOf: '2026/11/04' }, config)).toThrow();
  });
});

describe('R-PRIO-01 대항력 시점', () => {
  it('기준일(전입·확정일자 중 늦은 날의 다음 날) 이전 근저당을 선순위로 센다', () => {
    const r = priority(
      input({
        registry: registry({
          eul: [
            mortgage({ registeredAt: '2020-01-01' }),
            mortgage({ rank: '2', registeredAt: '2027-01-01' }),
          ],
        }),
      }),
    );
    expect(r.data).toEqual({ effectiveFrom: '2026-12-02', priorMortgageCount: 1 });
  });

  it('전입일·확정일자가 없으면 판단 보류(등급 영향 없음)', () => {
    const base = input();
    const raw = input({
      contract: { kind: 'jeonse', amount: base.contract.amount, counterpartyName: '홍길동' },
    });
    expect(priority(raw).status).toBe('unknown');
    expect(evaluateRisk(raw, config).grade).toBe('green');
  });
});
