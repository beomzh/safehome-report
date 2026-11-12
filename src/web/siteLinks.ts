/**
 * 방문 전 점검에 쓰는 외부 사이트. 이 앱은 해당 사이트를 호출하지 않고 링크만 제공한다
 * (매물 목록은 공개 API가 없고 스크래핑은 약관상 위험하다). 2026-11-09 접속 확인.
 */
export interface SiteLink {
  name: string;
  url: string;
  note: string;
}

export interface SiteGroup {
  title: string;
  links: SiteLink[];
}

export const SITE_GROUPS: SiteGroup[] = [
  {
    title: '매물 찾기',
    links: [
      { name: '네이버 부동산', url: 'https://land.naver.com', note: '매물·단지 정보' },
      { name: '직방', url: 'https://www.zigbang.com', note: '아파트·빌라·오피스텔 매물' },
      { name: '다방', url: 'https://www.dabangapp.com', note: '원룸·오피스텔·빌라 매물' },
      { name: '호갱노노', url: 'https://hogangnono.com', note: '단지별 시세·실거래·주변 환경' },
      { name: 'KB부동산', url: 'https://kbland.kr', note: 'KB시세·단지 정보' },
    ],
  },
  {
    title: '가격·건물 확인',
    links: [
      { name: '실거래가 공개시스템', url: 'https://rt.molit.go.kr', note: '국토교통부 실거래가 원본' },
      {
        name: '부동산 공시가격 알리미',
        url: 'https://www.realtyprice.kr',
        note: '공시가격(재산세 계산에 사용)',
      },
      { name: '건축HUB', url: 'https://www.hub.go.kr', note: '건축물대장·위반건축물 확인' },
    ],
  },
  {
    title: '계약 전 확인',
    links: [
      { name: '인터넷등기소', url: 'https://www.iros.go.kr', note: '등기사항전부증명서 열람' },
      {
        name: '주택도시보증공사(HUG)',
        url: 'https://www.khug.or.kr',
        note: '전세보증금반환보증 가입 가능 여부',
      },
      { name: '위택스', url: 'https://www.wetax.go.kr', note: '재산세 등 지방세 조회' },
      { name: '홈택스', url: 'https://www.hometax.go.kr', note: '종합부동산세·임대인 국세 체납 확인 안내' },
    ],
  },
];
