import { describe, expect, it } from 'vitest';
import { evaluateRisk } from '../../src/core';
import { config, input, mortgage, registry } from '../helpers/builders';

const result = (ruleId: string, raw = input()) =>
  evaluateRisk(raw, config).results.find((r) => r.ruleId === ruleId)!;

describe('R-MORT-01 근저당 합산', () => {
  it('미말소 근저당만 합산한다 (말소 항목 제외)', () => {
    const r = result(
      'R-MORT-01',
      input({
        registry: registry({
          eul: [
            mortgage({ maxClaimAmount: 100_000_000 }),
            mortgage({ rank: '2', maxClaimAmount: 50_000_000 }),
            mortgage({ rank: '3', maxClaimAmount: 999_000_000, cancelled: true }),
          ],
        }),
      }),
    );
    expect(r.data).toEqual({ count: 2, totalMaxClaim: 150_000_000 });
  });

  it('채권최고액을 인식하지 못한 근저당이 있으면 판단 보류(info 등급 영향 없음)', () => {
    const r = result(
      'R-MORT-01',
      input({ registry: registry({ eul: [mortgage({ maxClaimAmount: undefined })] }) }),
    );
    expect(r.status).toBe('unknown');
  });
});

describe('R-LTV-01 보증금 대비 담보 비율', () => {
  // 시세 10억 고정, 보증금 = 비율 × 10억 (근저당 없음) 으로 경계값 검증
  const at = (percentOfValue: number) =>
    result(
      'R-LTV-01',
      input({
        contract: { kind: 'jeonse', amount: percentOfValue * 10_000_000 },
        market: { estimatedValue: 1_000_000_000, source: 'user', confidence: 'high' },
      }),
    );

  it('70% 는 안전(clear) — 경계 포함', () => {
    expect(at(70).status).toBe('clear');
  });

  it('70% 초과(70.1%) 는 yellow', () => {
    const r = result(
      'R-LTV-01',
      input({
        contract: { kind: 'jeonse', amount: 701_000_000 },
        market: { estimatedValue: 1_000_000_000, source: 'user', confidence: 'high' },
      }),
    );
    expect(r.status).toBe('triggered');
    expect(r.severity).toBe('yellow');
  });

  it('80% 는 yellow(경계 포함), 80% 초과는 red', () => {
    expect(at(80).severity).toBe('yellow');
    const red = result(
      'R-LTV-01',
      input({
        contract: { kind: 'jeonse', amount: 801_000_000 },
        market: { estimatedValue: 1_000_000_000, source: 'user', confidence: 'high' },
      }),
    );
    expect(red.status).toBe('triggered');
    expect(red.severity).toBe('red');
  });

  it('선순위 근저당이 비율에 합산된다', () => {
    // (2억 근저당 + 3억 보증금) / 5억 시세 = 100% → red
    const r = result(
      'R-LTV-01',
      input({ registry: registry({ eul: [mortgage({ maxClaimAmount: 200_000_000 })] }) }),
    );
    expect(r.data?.ratioPercent).toBe(100);
    expect(r.severity).toBe('red');
  });

  it('말소된 근저당은 비율에 반영하지 않는다', () => {
    const r = result(
      'R-LTV-01',
      input({ registry: registry({ eul: [mortgage({ maxClaimAmount: 900_000_000, cancelled: true })] }) }),
    );
    expect(r.data?.ratioPercent).toBe(60);
    expect(r.status).toBe('clear');
  });

  it('시세가 없으면 판단 보류', () => {
    expect(result('R-LTV-01', input({ market: undefined })).status).toBe('unknown');
  });

  it('시세 신뢰도가 낮으면 근거에 경고가 붙는다', () => {
    const r = result(
      'R-LTV-01',
      input({ market: { estimatedValue: 500_000_000, source: 'official_price', confidence: 'low' } }),
    );
    expect(r.evidence.join(' ')).toContain('신뢰도가 낮아');
  });

  it('매매 계약에는 적용하지 않는다', () => {
    const base = input();
    const r = result('R-LTV-01', input({ contract: { ...base.contract, kind: 'sale' } }));
    expect(r.status).toBe('not_applicable');
  });
});
