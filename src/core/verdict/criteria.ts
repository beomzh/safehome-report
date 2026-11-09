import type { RulesConfig } from '../config';
import type { Affordability } from '../finance';
import type { Grade } from '../types';

/**
 * "보러 갈지 말지" 기준표 (C1~C6). 판정은 이 코드가 기준표로 먼저 정하고, LLM 은 그 위에서 해석만 한다.
 * 임계치는 rules.config 의 verdict·ltv 에서 온다(잠정값). 기준표는 화면에 그대로 공개한다.
 */
export type CriterionStatus = 'pass' | 'caution' | 'fail' | 'unknown';
export type Verdict = 'go' | 'conditional' | 'avoid';

export interface Criterion {
  id: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
  title: string;
  status: CriterionStatus;
  /** 화면에 보여주는 설명 (금액 포함 가능, 서버로 보내지 않는다) */
  detail: string;
  /** LLM 에 보내는 사실. 금액 없이 비율·상태만 담는다 */
  facts: string;
  /** 이 기준을 충족하는 조건(기준표) */
  rule: string;
}

export interface VerdictInput {
  kind: 'jeonse' | 'monthly' | 'sale';
  marketWon?: number;
  marketConfidence?: 'high' | 'low';
  amountWon: number;
  grade: Grade;
  affordability?: Affordability;
  dsrLimitPercent?: number;
}

export interface VerdictResult {
  verdict: Verdict;
  criteria: Criterion[];
  /** 결론의 이유 (미달·주의 기준) */
  reasons: string[];
}

const pct = (n: number): string => `${Math.round(n * 10) / 10}%`;

export const VERDICT_LABEL: Record<Verdict, string> = {
  go: '보러 가도 됨',
  conditional: '조건부 (확인 후 방문)',
  avoid: '보러 가지 않음 권장',
};

export const STATUS_LABEL: Record<CriterionStatus, string> = {
  pass: '충족',
  caution: '주의',
  fail: '미달',
  unknown: '판단 불가',
};

function shortfallCriterion(
  id: 'C1' | 'C2',
  title: string,
  surplus: number | undefined,
  needed: number | undefined,
  cautionPercent: number,
): Criterion {
  const rule = `보유 자산이 필요 자기자금 이상이면 충족, 부족액이 필요액의 ${cautionPercent}% 이내면 주의, 초과면 미달`;
  if (surplus === undefined || needed === undefined) {
    return {
      id,
      title,
      status: 'unknown',
      detail: '보유 자산·연소득을 입력하지 않았습니다.',
      facts: '미입력',
      rule,
    };
  }
  if (surplus >= 0) {
    return {
      id,
      title,
      status: 'pass',
      detail: '보유 자산이 필요 자기자금 이상입니다.',
      facts: '충족',
      rule,
    };
  }
  const short = (-surplus / needed) * 100;
  const status = short <= cautionPercent ? 'caution' : 'fail';
  return {
    id,
    title,
    status,
    detail: `필요 자기자금보다 ${pct(short)} 부족합니다.`,
    facts: `부족률 ${pct(short)}`,
    rule,
  };
}

/** 기준표로 결론을 낸다 (순수 함수) */
export function evaluateVerdict(input: VerdictInput, config: RulesConfig): VerdictResult {
  const v = config.verdict;
  const a = input.affordability;
  const criteria: Criterion[] = [];

  criteria.push(
    shortfallCriterion(
      'C1',
      '필요 자기자금 대비 보유 자산 (기준 금리)',
      a?.fundingBase.surplus,
      a?.fundingBase.ownFundsNeeded,
      v.shortfallCautionPercent,
    ),
  );
  criteria.push(
    shortfallCriterion(
      'C2',
      '필요 자기자금 대비 보유 자산 (스트레스 금리)',
      a?.fundingConservative.surplus,
      a?.fundingConservative.ownFundsNeeded,
      v.shortfallCautionPercent,
    ),
  );

  // C3 상환 부담: 총부채 상환 비율이 DSR 한도 안인지
  const c3rule = `연 상환 비율이 DSR 한도의 ${v.debtServiceCautionRatioPercent}% 이하면 충족, 한도 이하면 주의, 초과면 미달`;
  if (a?.debtServicePercent == null || input.dsrLimitPercent === undefined) {
    criteria.push({
      id: 'C3',
      title: '연소득 대비 상환 부담',
      status: 'unknown',
      detail: '보유 자산·연소득을 입력하지 않았습니다.',
      facts: '미입력',
      rule: c3rule,
    });
  } else {
    const ratio = (a.debtServicePercent / input.dsrLimitPercent) * 100;
    const status: CriterionStatus =
      ratio <= v.debtServiceCautionRatioPercent
        ? 'pass'
        : a.debtServicePercent <= input.dsrLimitPercent
          ? 'caution'
          : 'fail';
    criteria.push({
      id: 'C3',
      title: '연소득 대비 상환 부담',
      status,
      detail: `연 상환액이 연소득의 ${pct(a.debtServicePercent)}로, DSR 한도 ${pct(input.dsrLimitPercent)}의 ${pct(ratio)}입니다.`,
      facts: `연 상환 비율 ${pct(a.debtServicePercent)}, DSR 한도 ${pct(input.dsrLimitPercent)}`,
      rule: c3rule,
    });
  }

  // C4 보증금/시세 (전세·월세만)
  const c4rule = `보증금/시세가 ${config.ltv.cautionAbovePercent}% 이하면 충족, ${config.ltv.dangerAbovePercent}% 이하면 주의, 초과면 미달 (매매는 해당 없음)`;
  if (input.kind === 'sale') {
    criteria.push({
      id: 'C4',
      title: '보증금/시세 비율',
      status: 'pass',
      detail: '매매는 해당하지 않습니다.',
      facts: '해당 없음',
      rule: c4rule,
    });
  } else if (input.marketWon === undefined) {
    criteria.push({
      id: 'C4',
      title: '보증금/시세 비율',
      status: 'unknown',
      detail: '시세가 없어 계산하지 못했습니다.',
      facts: '시세 없음',
      rule: c4rule,
    });
  } else {
    const r = (input.amountWon / input.marketWon) * 100;
    const status: CriterionStatus =
      r <= config.ltv.cautionAbovePercent ? 'pass' : r <= config.ltv.dangerAbovePercent ? 'caution' : 'fail';
    criteria.push({
      id: 'C4',
      title: '보증금/시세 비율',
      status,
      detail: `보증금이 시세의 ${pct(r)}입니다.`,
      facts: `보증금/시세 ${pct(r)}`,
      rule: c4rule,
    });
  }

  // C5 시세 신뢰도
  const c5rule = '시세 신뢰도가 높음이면 충족, 낮음이거나 시세가 없으면 주의';
  if (input.marketWon === undefined) {
    criteria.push({
      id: 'C5',
      title: '시세 신뢰도',
      status: 'caution',
      detail: '시세가 없습니다. 시세를 조회하거나 입력하세요.',
      facts: '시세 없음',
      rule: c5rule,
    });
  } else if (input.marketConfidence === 'low') {
    criteria.push({
      id: 'C5',
      title: '시세 신뢰도',
      status: 'caution',
      detail: '시세 신뢰도가 낮습니다(표본 적음·직접 입력·지역 전체 등).',
      facts: '신뢰도 낮음',
      rule: c5rule,
    });
  } else {
    criteria.push({
      id: 'C5',
      title: '시세 신뢰도',
      status: 'pass',
      detail: '시세 신뢰도가 높습니다.',
      facts: '신뢰도 높음',
      rule: c5rule,
    });
  }

  // C6 규칙 점검 등급
  const gradeStatus: CriterionStatus =
    input.grade === 'green' ? 'pass' : input.grade === 'red' ? 'fail' : 'caution';
  criteria.push({
    id: 'C6',
    title: '규칙 점검 등급',
    status: gradeStatus,
    detail: {
      green: '탐지된 위험 신호가 없습니다.',
      yellow: '주의 신호가 있습니다.',
      red: '위험 신호가 있습니다.',
      inconclusive: '판단 보류 항목이 있습니다.',
    }[input.grade],
    facts: `규칙 점검 등급 ${input.grade}`,
    rule: '위험 신호 없음이면 충족, 주의·판단 보류면 주의, 위험이면 미달',
  });

  const failed = criteria.filter((c) => c.status === 'fail');
  const soft = criteria.filter((c) => c.status === 'caution' || c.status === 'unknown');
  const verdict: Verdict = failed.length > 0 ? 'avoid' : soft.length > 0 ? 'conditional' : 'go';
  const reasons = [...failed, ...soft].map((c) => `${c.id} ${STATUS_LABEL[c.status]}: ${c.detail}`);
  return { verdict, criteria, reasons };
}
