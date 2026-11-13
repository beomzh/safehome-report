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
  it('기준일 이전(같은 날 포함) 설정 근저당을 선순위로 센다', () => {
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

  it('전입이 늦거나 같으면 전입 다음 날, 확정일자가 더 늦으면 확정일자를 받은 날이 기준일', () => {
    const at = (moveInDate: string, fixedDate: string) =>
      priority(
        input({
          contract: {
            kind: 'jeonse',
            amount: 300_000_000,
            counterpartyName: '홍길동',
            moveInDate,
            fixedDate,
          },
        }),
      ).data?.effectiveFrom;
    expect(at('2026-12-01', '2026-12-01')).toBe('2026-12-02'); // 같은 날: 전입 다음 날
    expect(at('2026-12-01', '2026-11-20')).toBe('2026-12-02'); // 확정일자가 먼저: 전입 다음 날
    expect(at('2026-12-01', '2026-12-05')).toBe('2026-12-05'); // 확정일자가 나중: 그날 (하루를 더하지 않는다)
  });

  it('근거 문구는 "먼저 변제됨"으로 단정하지 않고 선순위로 본다고 쓴다', () => {
    const r = priority(input({ registry: registry({ eul: [mortgage({ registeredAt: '2020-01-01' })] }) }));
    expect(r.evidence.join(' ')).toContain('선순위로 봄');
    expect(r.evidence.join(' ')).not.toContain('먼저 변제됨');
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
