import type { Kind } from './form';

/**
 * 대출 상품 종류 안내. 한도·소득/자산 기준은 수시로 바뀌고 자료마다 달라 **숫자를 담지 않는다**.
 * 금리는 공식 출처·확인일이 붙은 별도 데이터(`loanRates.ts`, rules.config/loan-rates.json)로만 보여준다.
 * 어떤 종류가 있고 무엇을 확인해야 하는지만 안내하며, 자격과 조건은 공식 사이트에서 확인하게 한다.
 * (공식 사이트 원문은 이번 조사에서 확인하지 못했다 — 상품명은 여러 2차 자료에서 일치하는 것만 담았다.)
 */
export interface LoanProduct {
  id: string;
  name: string;
  kinds: Kind[];
  /** 취급·보증 주체 */
  provider: string;
  /** 숫자 없는 설명 */
  summary: string;
  /** 매물 점검과 연결되는 확인 포인트 */
  checkpoints: string[];
}

export const LOAN_PRODUCTS: readonly LoanProduct[] = [
  {
    id: 'buteommok',
    name: '버팀목 전세자금대출',
    kinds: ['jeonse'],
    provider: '주택도시기금 (수탁은행 취급)',
    summary: '무주택 세대주를 위한 정책형 전세자금대출. 소득·자산·보증금·전용면적 요건이 있다.',
    checkpoints: [
      '임차 보증금과 전용면적이 상품 요건 안인지 확인',
      '임대인(소유자) 확인과 등기부 권리관계가 심사 대상',
    ],
  },
  {
    id: 'youth-buteommok',
    name: '청년전용 버팀목 전세자금대출',
    kinds: ['jeonse'],
    provider: '주택도시기금 (수탁은행 취급)',
    summary: '일정 연령 범위의 무주택 청년을 위한 전세자금대출. 연령·소득 요건이 있다.',
    checkpoints: ['연령·소득·자산 요건은 공식 안내로 확인', '일반 버팀목과 중복해서 받을 수 없는지 확인'],
  },
  {
    id: 'newlywed-jeonse',
    name: '신혼부부전용 전세자금 (주택도시기금)',
    kinds: ['jeonse'],
    provider: '주택도시기금 (수탁은행 취급)',
    summary: '혼인 기간 요건을 갖춘 신혼부부를 위한 전세자금대출. 소득·자산·보증금 요건이 있다.',
    checkpoints: ['혼인 기간 등 가구 요건 확인', '해당 상품의 최신 지원 대상이 바뀌었는지 확인'],
  },
  {
    id: 'newborn-buteommok',
    name: '신생아 특례 버팀목대출 (주택도시기금)',
    kinds: ['jeonse'],
    provider: '주택도시기금 (수탁은행 취급)',
    summary: '출산 가구를 위한 특례금리 전세자금대출. 자녀 출생 시기·소득·자산·보증금 요건이 있다.',
    checkpoints: [
      '자녀 출생일 요건과 소득·자산 요건은 공식 안내로 확인',
      '특례금리 적용 기간이 끝난 뒤의 금리가 달라지므로 종료 후 금리도 확인',
    ],
  },
  {
    id: 'bank-jeonse',
    name: '시중은행 전세자금대출 (보증기관 보증)',
    kinds: ['jeonse'],
    provider: '시중은행 + 보증기관(주택도시보증공사·한국주택금융공사·서울보증보험 등)',
    summary:
      '은행이 취급하고 보증기관의 보증서를 받아 실행하는 일반 전세대출. 소득과 보증기관 심사 기준에 따른다.',
    checkpoints: [
      '보증기관이 매물의 권리관계(근저당·전세가율 등)로 보증을 거절할 수 있으므로 계약 전에 가능 여부를 먼저 확인',
      '이 도구에서 "위험"이 나온 매물은 보증이 거절될 가능성을 염두에 둘 것',
    ],
  },
  {
    id: 'housing-stable-wolse',
    name: '주거안정월세대출 (주택도시기금)',
    kinds: ['monthly'],
    provider: '주택도시기금 (수탁은행 취급)',
    summary: '월세를 매달 대출로 지원받는 상품. 우대형과 일반형이 있고 대상 요건이 한정적이다.',
    checkpoints: [
      '우대형·일반형 대상 요건은 공식 안내로 확인',
      '임대인(소유자) 확인과 월세 계약 요건이 심사 대상',
    ],
  },
  {
    id: 'youth-wolse',
    name: '청년전용 보증부월세대출 (주택도시기금)',
    kinds: ['monthly'],
    provider: '주택도시기금 (수탁은행 취급)',
    summary: '보증금과 월세금을 함께 지원하는 청년 대상 대출. 연령·소득·자산 요건이 있다.',
    checkpoints: [
      '보증금 부분 대출은 전세대출과 같은 권리관계 심사를 받을 수 있음',
      '청년 연령·소득 요건은 공식 안내로 확인',
    ],
  },
  {
    id: 'newborn-didimdol',
    name: '신생아 특례 디딤돌대출 (주택 구입)',
    kinds: ['sale'],
    provider: '주택도시기금 (수탁은행 취급)',
    summary: '출산 가구를 위한 특례금리 주택담보대출. 자녀 출생 시기·소득·주택가격 요건이 있다.',
    checkpoints: [
      '자녀 출생일 요건과 소득·주택가격 요건은 공식 안내로 확인',
      '특례금리 적용 기간이 끝난 뒤의 금리가 달라지므로 종료 후 금리도 확인',
    ],
  },
  {
    id: 'didimdol',
    name: '디딤돌대출 (주택 구입)',
    kinds: ['sale'],
    provider: '주택도시기금 (수탁은행 취급)',
    summary: '무주택 세대주의 주택 구입을 지원하는 정책형 주택담보대출. 소득·주택가격 요건이 있다.',
    checkpoints: [
      '매매가와 주택 유형이 상품 요건 안인지 확인',
      '잔금 시 기존 근저당 말소 조건을 계약서에 명시',
    ],
  },
  {
    id: 'bogeumjari',
    name: '보금자리론 (주택 구입)',
    kinds: ['sale'],
    provider: '한국주택금융공사 (은행 대리 취급)',
    summary: '장기 고정금리 주택담보대출. 주택가격·소득 요건이 있다.',
    checkpoints: [
      '주택가격·소득 요건과 신청 가능 시기를 공식 안내로 확인',
      '담보 평가가 매매가와 다를 수 있음',
    ],
  },
  {
    id: 'bank-mortgage',
    name: '시중은행 주택담보대출',
    kinds: ['sale'],
    provider: '시중은행',
    summary: '은행별 심사로 실행되는 일반 주택담보대출. LTV·DSR 등 규제와 은행 내규를 모두 받는다.',
    checkpoints: [
      '규제지역·보유 주택 수·생애최초 여부에 따라 한도가 달라지므로 은행에 개별 확인',
      '이 도구의 "대출·자금 계획" 섹션에 은행 안내값을 넣어 한도를 추정',
    ],
  },
];

export function loansFor(kind: Kind): LoanProduct[] {
  return LOAN_PRODUCTS.filter((p) => p.kinds.includes(kind));
}

/** 확인할 공식 사이트 (이름만 안내하고 주소는 사용자가 직접 검색해 확인) */
export const OFFICIAL_SOURCES = [
  '주택도시기금 (국토교통부)',
  '기금e든든',
  '한국주택금융공사',
  '각 은행·보증기관 안내',
] as const;
