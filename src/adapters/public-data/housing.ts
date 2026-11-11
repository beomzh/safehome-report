/**
 * 매매 실거래 API 종류. 아파트·오피스텔·단독다가구는 실제 응답으로 필드를 확인했다(오피스텔 2026-11-09, 단독다가구 2026-11-11).
 * 연립다세대도 실제 응답으로 확인했다(2026-11-11, 엔드포인트는 RTMSDataSvcRHTrade2 — 구버전 RTMSDataSvcRHTrade 는 폐기됨).
 */
export const HOUSING_TYPES = ['apt', 'rowhouse', 'officetel', 'house'] as const;
export type HousingType = (typeof HOUSING_TYPES)[number];

export interface HousingSpec {
  label: string;
  endpoint: string;
  /** 단지(건물)명을 담은 응답 태그. 단독·다가구는 건물명이 없어 법정동명(umdNm)을 쓴다 */
  nameTag: string;
  /** 면적을 담은 응답 태그 (단독·다가구는 전용면적이 없어 연면적) */
  areaTag: string;
  /** 설정되면 면적 허용 오차를 목표 면적의 이 비율로 쓴다 (연면적은 ㎡ 단위 오차가 의미 없음) */
  areaToleranceRatio?: number;
  /** 같은 면적대 다른 단지 비교를 지원하는가 */
  supportsSimilar: boolean;
  /** 활용신청 페이지 (키에 이 API 권한이 없으면 안내한다) */
  applyUrl: string;
  /** 실제 응답으로 필드를 확인했는가 */
  verified: boolean;
}

const BASE = 'https://apis.data.go.kr/1613000';

export const HOUSING: Record<HousingType, HousingSpec> = {
  apt: {
    label: '아파트',
    endpoint: `${BASE}/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev`,
    nameTag: 'aptNm',
    areaTag: 'excluUseAr',
    supportsSimilar: true,
    applyUrl: 'https://www.data.go.kr/data/15126468/openapi.do',
    verified: true,
  },
  rowhouse: {
    label: '연립·다세대(빌라)',
    endpoint: `${BASE}/RTMSDataSvcRHTrade2/getRTMSDataSvcRHTrade2`,
    nameTag: 'mhouseNm',
    areaTag: 'excluUseAr',
    supportsSimilar: true,
    applyUrl: 'https://www.data.go.kr/data/15126467/openapi.do',
    verified: true,
  },
  officetel: {
    label: '오피스텔',
    endpoint: `${BASE}/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade`,
    nameTag: 'offiNm',
    areaTag: 'excluUseAr',
    supportsSimilar: true,
    applyUrl: 'https://www.data.go.kr/data/15126464/openapi.do',
    verified: true,
  },
  house: {
    label: '단독·다가구',
    endpoint: `${BASE}/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade`,
    nameTag: 'umdNm',
    areaTag: 'totalFloorAr',
    areaToleranceRatio: 0.2,
    supportsSimilar: false,
    applyUrl: 'https://www.data.go.kr/data/15126465/openapi.do',
    verified: true,
  },
};

export const isHousingType = (v: string): v is HousingType =>
  (HOUSING_TYPES as readonly string[]).includes(v);
