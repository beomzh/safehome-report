export interface ChecklistItem {
  id: string;
  text: string;
  /** 어떤 계약 유형에 보이는지 */
  kinds: ('jeonse' | 'monthly' | 'sale')[];
}

/** 계약 전·후 확인할 일. 룰 판정과 무관하게 항상 표시한다 (PRD RP-04) */
export const CHECKLIST: readonly ChecklistItem[] = [
  {
    id: 'owner-id',
    text: '계약 상대방이 등기부상 소유자 본인인지 신분증으로 확인(대리인이면 위임장·인감증명서 확인)',
    kinds: ['jeonse', 'monthly', 'sale'],
  },
  {
    id: 'tax-cert',
    text: '임대인에게 국세·지방세 완납(납세) 증명서 제시 요청',
    kinds: ['jeonse', 'monthly'],
  },
  {
    id: 'guarantee',
    text: '전세보증보험 가입 가능 여부를 보증기관에 사전 확인 (거절 시 사유 확인)',
    kinds: ['jeonse'],
  },
  {
    id: 'other-tenants',
    text: '선순위 임차인(다른 세입자)의 보증금·전입 현황 확인',
    kinds: ['jeonse', 'monthly'],
  },
  {
    id: 'trust-consent',
    text: '신탁 물건이면 신탁원부와 수탁자(신탁회사)의 임대·매매 동의서 확인',
    kinds: ['jeonse', 'monthly', 'sale'],
  },
  { id: 'broker', text: '공인중개사 등록 여부와 중개사무소 정보 확인', kinds: ['jeonse', 'monthly', 'sale'] },
  {
    id: 'reconfirm-contract',
    text: '계약 당일 등기부등본을 다시 발급해 변동 여부 확인',
    kinds: ['jeonse', 'monthly', 'sale'],
  },
  {
    id: 'reconfirm-balance',
    text: '잔금 지급 직전 등기부등본 재확인 (새 근저당·압류 여부)',
    kinds: ['jeonse', 'monthly', 'sale'],
  },
  {
    id: 'move-in',
    text: '잔금일 당일 전입신고와 확정일자 받기 (전입 다음 날 등기부 재확인)',
    kinds: ['jeonse', 'monthly'],
  },
  {
    id: 'mortgage-release',
    text: '근저당이 있다면 잔금 시 말소 조건(대출 상환·말소 서류)을 계약서에 명시',
    kinds: ['sale'],
  },
];
