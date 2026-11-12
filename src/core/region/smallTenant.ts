/**
 * 시군구 법정동코드로 소액임차인(최우선변제) 지역 구분을 정한다 (주택임대차보호법 시행령 제10조·제11조).
 * 구분이 부분 지역에 따라 갈리는 곳(인천 대부분의 구, 남양주, 시흥 등 과밀억제권역의 일부 지역·제외 지역)과
 * 전남광주통합특별시(2026-07-01)는 추측하지 않고 'unknown' 으로 돌려준다.
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
  '41192',
  '41194',
  '41196', // 부천 원미·소사·오정구 (2024-01 구 재설치)
  '41591',
  '41593',
  '41595',
  '41597', // 화성 만세·효행·병점·동탄구 (2026-02 구 신설)
  '41430', // 의왕
  '41410', // 군포
]);

/** 부분 지역만 과밀억제권역이라 코드만으로 정할 수 없는 곳 */
const PARTIAL = new Set([
  '41360', // 남양주 (일부 동만 과밀억제권역)
  '41390', // 시흥 (반월특수지역 제외)
  '28125',
  '28155',
  '28177',
  '28185',
  '28200',
  '28237',
  '28245',
  '28275',
  '28290', // 인천 (2026-07-01 구 개편, 일부 지역만 과밀억제권역)
]);

/** 광역시 구분이지만 군 지역이라 "그 밖의 지역"인 곳 */
const COUNTY_OF_METRO = new Set(['26710', '27710', '27720', '31710', '28710', '28720']);

/** 경기도의 2,800 구간: 안산, 광주, 파주, 이천, 평택 */
const GYEONGGI_METRO = new Set(['41271', '41273', '41610', '41480', '41500', '41220']);

export function smallTenantRegion(sigunguCode: string): SmallTenantRegion {
  if (!/^\d{5}$/.test(sigunguCode)) return 'unknown';
  if (sigunguCode.startsWith('11')) return 'seoul';
  // 전남광주통합특별시(2026-07-01, 코드 12xxx)는 시행령 제10조의 구분표에 반영되었는지 확인하지 못해 추측하지 않는다
  if (sigunguCode.startsWith('12')) return 'unknown';
  if (PARTIAL.has(sigunguCode)) return 'unknown';
  if (COUNTY_OF_METRO.has(sigunguCode)) return 'other';
  if (CAPITAL.has(sigunguCode)) return 'capital';
  if (GYEONGGI_METRO.has(sigunguCode)) return 'metro';
  // 부산·대구·대전·울산 광역시(군 지역 제외), 인천은 아래에서 처리
  if (/^(26|27|30|31)/.test(sigunguCode)) return 'metro';
  if (sigunguCode.startsWith('28')) return 'unknown';
  return 'other';
}
