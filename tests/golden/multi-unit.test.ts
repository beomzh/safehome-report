import { describe, expect, it } from 'vitest';
import { evaluateRisk } from '../../src/core';
import type { RiskInput } from '../../src/core';
import { buildRiskInput, emptyForm } from '../../src/web/form';
import { config, input } from '../helpers/builders';

const rule = (over: Partial<RiskInput>, id = 'R-MULTI-01') =>
  evaluateRisk(input(over), config).results.find((r) => r.ruleId === id)!;

describe('R-MULTI-01 다가구·단독주택의 다른 임차인 보증금', () => {
  it('단독·다가구 전세는 주의(yellow)로 확인할 일을 알린다', () => {
    const r = rule({ housingType: 'house' });
    expect([r.status, r.severity]).toEqual(['triggered', 'yellow']);
    expect(r.evidence.join(' ')).toContain('다른 임차인');
    expect(r.action).toContain('전입세대 확인서');
    expect(r.action).toContain('확정일자 부여 현황');
  });

  it('종합 등급을 yellow 로 올린다 (다른 위험이 없을 때)', () => {
    const base = evaluateRisk(input(), config).grade;
    const house = evaluateRisk(input({ housingType: 'house' }), config).grade;
    expect(base).not.toBe('yellow');
    expect(house).toBe('yellow');
  });

  it('아파트·빌라·오피스텔이나 유형 미지정, 매매는 해당 없음', () => {
    for (const housingType of ['apt', 'rowhouse', 'officetel', undefined] as const) {
      expect(rule({ housingType }).status).toBe('not_applicable');
    }
    const sale = rule({ housingType: 'house', contract: { ...input().contract, kind: 'sale' } });
    expect(sale.status).toBe('not_applicable');
  });

  it('회수 시나리오에도 다른 임차인 보증금이 빠졌다고 밝힌다', () => {
    const r = rule({ housingType: 'house' }, 'R-RECOV-01');
    expect(r.evidence.join(' ')).toContain('다른 임차인의 보증금이 선순위일 수 있습니다');
    expect(rule({ housingType: 'apt' }, 'R-RECOV-01').evidence.join(' ')).not.toContain(
      '다른 임차인의 보증금이 선순위',
    );
  });

  it('입력 화면의 주택 유형이 위험 입력으로 전달된다', () => {
    const built = buildRiskInput(
      { ...emptyForm(), amountManwon: '30000', lookupHousing: 'house' },
      '2026-11-16',
    );
    expect(built.ok && built.input.housingType).toBe('house');
  });
});
