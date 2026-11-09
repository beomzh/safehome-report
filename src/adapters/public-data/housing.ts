/**
 * 매매 실거래 API 종류. 아파트·오피스텔은 실제 응답으로 필드를 확인했다(오피스텔: 2026-11-09, offiNm).
 * 연립다세대는 활용신청 전이라(오류 코드 30) 응답 필드명이 공식 명세 기준 추정이다.
 */
export const HOUSING_TYPES = ['apt', 'rowhouse', 'officetel'] as const;
export type HousingType = (typeof HOUSING_TYPES)[number];

export interface HousingSpec {
  label: string;
  endpoint: string;
  /** 단지(건물)명을 담은 응답 태그 */
  nameTag: string;
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
    applyUrl: 'https://www.data.go.kr/data/15126468/openapi.do',
    verified: true,
  },
  rowhouse: {
    label: '연립·다세대(빌라)',
    endpoint: `${BASE}/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade`,
    nameTag: 'mhouseNm',
    applyUrl: 'https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=연립다세대 매매 실거래가',
    verified: false,
  },
  officetel: {
    label: '오피스텔',
    endpoint: `${BASE}/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade`,
    nameTag: 'offiNm',
    applyUrl: 'https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=오피스텔 매매 실거래가',
    verified: true,
  },
};

export const isHousingType = (v: string): v is HousingType =>
  (HOUSING_TYPES as readonly string[]).includes(v);
