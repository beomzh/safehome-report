import type { PolicyAssumptions } from '../core';
import type { FinanceFormState } from './financeForm';
import { usesExample } from './financeForm';

const man = (won: number): string => `${Math.round(won / 10_000).toLocaleString('ko-KR')}만원`;

/**
 * 추천된 정책 대출의 공식 조건을 "필요 조건" 계산 기준값으로 쓴다.
 * 사용자가 기준값을 직접 고쳤거나(예시 값이 아님) AI 제안을 적용했거나 상품 한도를 입력했다면 그 값을 존중해 바꾸지 않는다.
 * 값마다 출처(공식 안내 / 예시 가정)를 notes 로 밝힌다.
 */
export function applyPolicyBasis(
  fin: FinanceFormState,
  policy: PolicyAssumptions,
  productName: string,
): { fin: FinanceFormState; notes: string[]; applied: boolean } {
  if (!usesExample(fin) || fin.aiFields.length > 0 || fin.productCapManwon.trim() !== '')
    return { fin, notes: [], applied: false };

  const next: FinanceFormState = {
    ...fin,
    ltvLimitPercent: String(policy.ltvPercent),
    annualRatePercent: String(policy.annualRatePercent),
    stressAddPercent: '0',
    productCapManwon: String(Math.round(policy.capWon / 10_000)),
    ...(policy.termYears !== undefined ? { termYears: String(policy.termYears) } : {}),
    ...(policy.dtiPercent !== undefined ? { dsrLimitPercent: String(policy.dtiPercent) } : {}),
  };
  const notes = [
    `정책 대출 기준 적용 — ${productName}(주택도시기금 공식 안내, 이 상품 요건에 해당할 수 있는 것으로 입력하신 경우): LTV(대출비율) ${policy.ltvPercent}%, 호당 한도 ${man(policy.capWon)}, 기본금리 연 ${policy.annualRatePercent}%${
      policy.rateBasis === 'grid'
        ? '(공식 금리표에서 내 소득 구간 기준, 우대·지방 인하 전)'
        : '(상품 금리 범위의 상단)'
    }${policy.termYears !== undefined ? `, 대출기간 최장 ${policy.termYears}년` : ''}.`,
    policy.dtiPercent !== undefined
      ? `DSR 한도 칸에는 이 상품의 DTI 한도 ${policy.dtiPercent}%를 썼습니다. DTI 는 다른 부채의 원금 상환을 보지 않는 등 DSR 과 계산 방식이 달라 근사입니다.`
      : '이 상품 안내에는 DSR 한도가 없어 DSR 한도는 예시 가정(40%)을 그대로 두었습니다.',
    '스트레스 가산 금리는 정책 대출 안내에서 확인하지 못해 0%로 두었습니다.',
    ...(policy.termYears === undefined
      ? ['전세 상품은 만기일시상환이 기본이지만 이 계산은 원리금 균등 30년 가정을 그대로 씁니다.']
      : []),
    ...policy.notes,
  ];
  return { fin: next, notes, applied: true };
}
