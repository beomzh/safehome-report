import type { LoanDeal, LoanProfile } from '../core';
import { parseManwon } from './form';
import type { Kind } from './form';

/** 대출 추천에 쓰는 "내 상황" 입력. 연소득은 대출·자금 계획의 연소득 칸(fin.annualIncomeManwon)을 같이 쓴다 */
export interface ProfileState {
  /** 순자산 = 자산 − 부채 (만원) */
  netAssetManwon: string;
  age: string;
  homeless: boolean;
  householdHead: boolean;
  newlywed: boolean;
  newbornWithin2y: boolean;
  minorChildren: '0' | '1' | '2' | '3';
  firstHome: boolean;
  dualIncome: boolean;
}

/** 무주택·세대주는 가장 흔한 경우로 미리 체크해 두고 화면에서 바꾸게 한다 */
export const defaultProfile = (): ProfileState => ({
  netAssetManwon: '',
  age: '',
  homeless: true,
  householdHead: true,
  newlywed: false,
  newbornWithin2y: false,
  minorChildren: '0',
  firstHome: false,
  dualIncome: false,
});

const optionalWon = (raw: string): number | undefined => {
  if (!raw.trim()) return undefined;
  const w = parseManwon(raw);
  return w.ok ? w.won : undefined;
};

export function toLoanProfile(p: ProfileState, incomeManwon: string): LoanProfile {
  const age = /^\d{1,3}$/.test(p.age.trim()) ? Number(p.age) : undefined;
  return {
    incomeWon: optionalWon(incomeManwon),
    netAssetWon: optionalWon(p.netAssetManwon),
    age: age !== undefined && age >= 0 && age <= 120 ? age : undefined,
    homeless: p.homeless,
    householdHead: p.householdHead,
    newlywed: p.newlywed,
    newbornWithin2y: p.newbornWithin2y,
    minorChildren: Number(p.minorChildren),
    firstHome: p.firstHome,
    dualIncome: p.dualIncome,
  };
}

/** 수도권(서울·인천·경기) 시군구 코드 앞 두 자리. 코드를 모르면 undefined */
export function isCapitalRegion(lawdCd: string): boolean | undefined {
  if (!/^\d{5}$/.test(lawdCd.trim())) return undefined;
  return /^(11|28|41)/.test(lawdCd.trim());
}

export function buildLoanDeal(args: {
  kind: Kind;
  amountWon: number;
  monthlyRentManwon: string;
  lawdCd: string;
  areaM2: string;
}): LoanDeal {
  const area = /^\d+(\.\d+)?$/.test(args.areaM2.trim()) ? Number(args.areaM2) : undefined;
  return {
    kind: args.kind,
    amountWon: args.amountWon,
    monthlyRentWon: optionalWon(args.monthlyRentManwon),
    capital: isCapitalRegion(args.lawdCd),
    areaM2: area !== undefined && area > 0 ? area : undefined,
  };
}
