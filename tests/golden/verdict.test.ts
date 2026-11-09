import { describe, expect, it } from 'vitest';
import { evaluateAffordability, evaluateVerdict } from '../../src/core';
import type { VerdictInput } from '../../src/core';
import { config } from '../helpers/builders';

const afford = (assets: number, income: number) =>
  evaluateAffordability({
    kind: 'sale',
    amount: 500_000_000,
    collateralValue: 500_000_000,
    loan: {
      ltvLimitPercent: 70,
      dsrLimitPercent: 40,
      annualRatePercent: 4,
      stressAddPercent: 1.5,
      termMonths: 360,
    },
    profile: { assets, annualIncome: income, existingAnnualDebtPayment: 0 },
  });

const base = (over: Partial<VerdictInput> = {}): VerdictInput => ({
  kind: 'sale',
  amountWon: 500_000_000,
  marketWon: 500_000_000,
  marketConfidence: 'high',
  grade: 'green',
  affordability: afford(300_000_000, 200_000_000),
  dsrLimitPercent: 40,
  ...over,
});
const byId = (r: ReturnType<typeof evaluateVerdict>, id: string) => r.criteria.find((c) => c.id === id)!;

describe('evaluateVerdict — 기준표 C1~C6', () => {
  it('모두 충족이면 보러 가도 됨', () => {
    const r = evaluateVerdict(base(), config);
    expect(r.criteria.map((c) => c.status)).toEqual(['pass', 'pass', 'pass', 'pass', 'pass', 'pass']);
    expect(r.verdict).toBe('go');
  });

  it('미달이 하나라도 있으면 보러 가지 않음 권장 (규칙 등급 위험)', () => {
    const r = evaluateVerdict(base({ grade: 'red' }), config);
    expect(byId(r, 'C6').status).toBe('fail');
    expect(r.verdict).toBe('avoid');
  });

  it('자기자금 부족률: 10% 이내는 주의, 초과는 미달', () => {
    const a = afford(0, 200_000_000);
    const need = a.fundingBase.ownFundsNeeded;
    const small = evaluateVerdict(
      base({ affordability: afford(Math.floor(need * 0.95), 200_000_000) }),
      config,
    );
    expect(byId(small, 'C1').status).toBe('caution');
    const big = evaluateVerdict(base({ affordability: afford(Math.floor(need * 0.5), 200_000_000) }), config);
    expect(byId(big, 'C1').status).toBe('fail');
    expect(big.verdict).toBe('avoid');
  });

  it('재무 정보가 없으면 C1~C3 은 판단 불가이고 결론은 조건부', () => {
    const r = evaluateVerdict(base({ affordability: undefined }), config);
    expect(['C1', 'C2', 'C3'].map((id) => byId(r, id).status)).toEqual(['unknown', 'unknown', 'unknown']);
    expect(r.verdict).toBe('conditional');
  });

  it('전세 보증금/시세: 70% 이하 충족, 80% 이하 주의, 초과 미달', () => {
    const j = (amount: number) => evaluateVerdict(base({ kind: 'jeonse', amountWon: amount }), config);
    expect(byId(j(350_000_000), 'C4').status).toBe('pass');
    expect(byId(j(400_000_000), 'C4').status).toBe('caution');
    expect(byId(j(450_000_000), 'C4').status).toBe('fail');
  });

  it('시세 없음·신뢰도 낮음은 주의(미달 아님)', () => {
    expect(byId(evaluateVerdict(base({ marketWon: undefined }), config), 'C5').status).toBe('caution');
    expect(byId(evaluateVerdict(base({ marketConfidence: 'low' }), config), 'C5').status).toBe('caution');
  });

  it('LLM 에 보내는 facts 에는 금액(원·만원)이 없다', () => {
    const r = evaluateVerdict(base({ affordability: afford(100_000_000, 50_000_000) }), config);
    expect(r.criteria.every((c) => !/원|만/.test(c.facts))).toBe(true);
  });

  it('규칙 등급은 영어 대신 한글로 LLM 에 전달한다', () => {
    const r = evaluateVerdict(base({ grade: 'yellow' }), config);
    expect(byId(r, 'C6').facts).toBe('규칙 점검 등급 주의');
  });
});
