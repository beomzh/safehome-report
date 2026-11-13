// 은행연합회 소비자포털 "대출금리비교 > 은행별 비교공시(가계대출금리)" 의 공시 표를 읽는 순수 함수.
// 이 페이지가 검색 버튼을 누르면 보내는 요청(POST /compare/loan_household_new_search_result_new.php)과 같은 요청으로 받은
// 응답 HTML 을 읽는다 (2026-11-13 확인). 값은 직전 달 신규취급액 기준, CB사 신용점수 구간별 평균 금리다.

export const KFB_PAGE = 'https://portal.kfb.or.kr/compare/loan_household_new.php';
export const KFB_RESULT = 'https://portal.kfb.or.kr/compare/loan_household_new_search_result_new.php';
/** opt_1: 대출 종류 코드 (페이지의 선택 목록 값) */
export const KFB_LOAN_TYPE = { mortgage: '1', jeonse: '5' };

const decodeEucKr = (bytes) => new TextDecoder('euc-kr').decode(bytes);
const text = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** 페이지 HTML(EUC-KR 바이트)에서 은행 체크박스 값(이미 퍼센트 인코딩된 EUC-KR)을 모은다 */
export function parseBankValues(pageBytes) {
  const html = decodeEucKr(pageBytes);
  return [...html.matchAll(/name="BankName"[^>]*value="([^"]+)"/g)].map((m) => m[1]);
}

/** 조회 요청 본문. 은행 값은 페이지의 퍼센트 인코딩 값을 그대로 쓴다 */
export function buildRequestBody({ year, month, loanType, bankValues }) {
  return [
    `year=${year}`,
    `month=${month}`,
    `opt_1=${loanType}`,
    'detail=0',
    `str=${bankValues.join('%7C')}`,
    'select_new_balance=1',
  ].join('&');
}

const num = (s) => {
  const v = Number(s.replace(/,/g, ''));
  return /^-?\d+(\.\d+)?$/.test(s.replace(/,/g, '')) && v > 0 && v <= 15 ? v : null;
};

/**
 * 응답 HTML(EUC-KR 바이트)을 읽어 신용점수 구간과 은행별 금리를 돌려준다.
 * 금리가 하나도 없는 은행(공시 대상 아님)은 뺀다. 표를 못 읽으면 banks 가 빈 배열이다.
 */
export function parseBankRates(resultBytes) {
  const html = decodeEucKr(resultBytes);
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1])),
  );
  const headerAt = rows.findIndex((r) => r.length >= 9 && r.every((c) => /점|평균금리/.test(c)));
  if (headerAt < 0) return { scoreBands: [], banks: [] };
  const header = rows[headerAt];
  const scoreBands = header.filter((c) => /점/.test(c));
  const banks = [];
  for (const r of rows.slice(headerAt + 1)) {
    if (r.length < scoreBands.length + 4 || r[1] !== '대출금리') continue;
    const values = r.slice(2, 2 + scoreBands.length + 1); // 점수 구간들 + 평균금리
    const byBand = values.slice(0, scoreBands.length).map(num);
    const avg = num(values[scoreBands.length] ?? '');
    if (avg === null && byBand.every((v) => v === null)) continue;
    const avgScore = Number(r[2 + scoreBands.length + 1]);
    banks.push({
      name: r[0],
      avgPercent: avg,
      avgScore: Number.isFinite(avgScore) && avgScore > 0 ? avgScore : null,
      byBand,
    });
  }
  return { scoreBands, banks };
}

/** 'YYYYMM' 에서 n 개월 전 */
export function monthsAgo(ym, n) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  const idx = y * 12 + (m - 1) - n;
  return `${Math.floor(idx / 12)}${String((idx % 12) + 1).padStart(2, '0')}`;
}
