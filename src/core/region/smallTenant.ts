/**
 * 시군구 법정동코드로 소액임차인(최우선변제) 지역 구분을 정한다 (주택임대차보호법 시행령 제10조·제11조).
 * 구분이 부분 지역에 따라 갈리는 곳(인천 대부분의 구, 남양주, 시흥 등 과밀억제권역의 일부 지역·제외 지역)과
 * 2026 개편으로 코드가 바뀐 곳은 추측하지 않고 'unknown' 으로 돌려준다.
 */
export type SmallTenantRegion = 'seoul' | 'capital' | 'metro' | 'other' | 'unknown';

/** 서울 외 과밀억제권역(전부 포함되는 시·구), 세종·용인·화성·김포 → 4,800 구간 */
const CAPITAL = new Set([
  '36110', // 세종
  '41461',
  '41463',
  '41465', // 용인
  '41570', // 김포
  '41150', // 의정부
  '41310', // 구리
  '41450', // 하남
  '41281',
  '41285',
  '41287', // 고양
  '41111',
  '41113',
  '41115',
  '41117', // 수원
  '41131',
  '41133',
  '41135', // 성남
  '41171',
  '41173', // 안양
  '41210', // 광명
  '41290', // 과천
  '41430', // 의왕
  '41410', // 군포
]);

/** 부분 지역만 과밀억제권역이라 코드만으로 정할 수 없는 곳 */
const PARTIAL = new Set([
  '41360', // 남양주 (일부 동만 과밀억제권역)
  '41390', // 시흥 (반월특수지역 제외)
  '28110',
  '28140',
  '28177',
  '28185',
  '28200',
  '28237',
  '28245',
  '28260', // 인천 (서구 일부·남동 산단 등 예외)
]);

/** 광역시 구분이지만 군 지역이라 "그 밖의 지역"인 곳 */
const COUNTY_OF_METRO = new Set(['26710', '27710', '27720', '31710', '28710', '28720']);

/** 경기도의 2,800 구간: 안산, 광주, 파주, 이천, 평택 */
const GYEONGGI_METRO = new Set(['41271', '41273', '41610', '41480', '41500', '41220']);

export function smallTenantRegion(sigunguCode: string): SmallTenantRegion {
  if (!/^\d{5}$/.test(sigunguCode)) return 'unknown';
  if (sigunguCode.startsWith('11')) return 'seoul';
  if (PARTIAL.has(sigunguCode)) return 'unknown';
  if (COUNTY_OF_METRO.has(sigunguCode)) return 'other';
  if (CAPITAL.has(sigunguCode)) return 'capital';
  if (GYEONGGI_METRO.has(sigunguCode)) return 'metro';
  // 부산·대구·광주·대전·울산 광역시(군 지역 제외), 인천은 위에서 처리
  if (/^(26|27|29|30|31)/.test(sigunguCode)) return 'metro';
  if (sigunguCode.startsWith('28')) return 'unknown';
  return 'other';
}
