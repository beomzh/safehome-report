// 대출 금리 점검용 순수 함수. 네트워크는 쓰지 않는다 (호출은 check-loan-rates.mjs 가 한다).
// 주택도시기금(nhuf.molit.go.kr) 상품 페이지의 칸별 금리표는 페이지 스크립트가 아래 요청으로 받아 채운다
// (공식 사이트가 자기 페이지에서 쓰는 요청, 2026-11-11·12 확인). 응답의 LOANRATE, LOANRATE1, … 이 표의 칸을
// 왼쪽 위부터 행 순서대로 채운다.

export const NHUF_ENDPOINT = 'https://nhuf.molit.go.kr/init/include/NewBabyGetInform.jsp';

/** 칸별 금리표를 요청으로 받아오는 상품. gb: productgb 값 */
export const GRID_PRODUCTS = [
  { id: 'buteommok', select: 'newMearryHouseRent', gb: 'N' },
  { id: 'newlywed-jeonse', select: 'newMearryHouseRent', gb: 'Y' },
  { id: 'didimdol', select: 'newMearryHouse', gb: 'F' },
  { id: 'newborn-buteommok', select: 'newMearryHouseRent', gb: 'S' },
  { id: 'newborn-didimdol', select: 'newMearryHouse', gb: 'S' },
];

/** 응답 본문에서 LOANRATE, LOANRATE1, … 값을 번호 순서로 읽는다 */
export function parseLoanRates(text) {
  const found = [...text.matchAll(/"LOANRATE(\d*)"\s*:\s*"([\d.]+)"/g)].map((m) => ({
    n: m[1] === '' ? 0 : Number(m[1]),
    v: Number(m[2]),
  }));
  return found.sort((a, b) => a.n - b.n).map((x) => x.v);
}

/** 저장된 grid(행×열)를 왼쪽 위부터 행 순서로 펼친다 */
export function flattenGrid(grid) {
  return grid.rows.flatMap((r) => r.percents);
}

/** 저장값과 현재값을 비교해 차이를 설명하는 문장 목록을 돌려준다 (같으면 빈 목록) */
export function diffGrid(label, saved, live) {
  if (live.length === 0)
    return [`${label}: 현재 응답에서 금리를 읽지 못했습니다 (사이트 구조가 바뀌었을 수 있음)`];
  if (live.length !== saved.length)
    return [
      `${label}: 칸 수가 다릅니다 (저장 ${saved.length}칸, 현재 ${live.length}칸) — 표 구조가 바뀌었습니다`,
    ];
  const out = [];
  live.forEach((v, i) => {
    if (Math.abs(v - saved[i]) > 1e-9) out.push(`${label}: ${i + 1}번째 칸 ${saved[i]}% → ${v}%`);
  });
  return out;
}

const decode = (s) =>
  s
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

/** 주거안정월세대출 페이지에서 (우대형, 일반형) 금리를 읽는다. 없으면 undefined */
export function parseHousingStableWolse(html) {
  const m = /우대형\)?\s*연\s*([\d.]+)\s*%\s*\(?\s*일반형\)?\s*연\s*([\d.]+)\s*%/.exec(decode(html));
  return m ? { preferred: Number(m[1]), general: Number(m[2]) } : undefined;
}

/** 청년전용 보증부월세대출 페이지에서 보증금·월세금(한도 이하, 초과) 금리를 읽는다. 없으면 undefined */
export function parseYouthWolse(html) {
  const m =
    /\(?\s*보증금\s*\)?\s*연\s*([\d.]+)\s*%\s*\(?\s*월세금\s*\)?\s*연\s*([\d.]+)\s*%\s*\(\s*(\d+)\s*만원\s*한도\s*\)\s*,?\s*([\d.]+)\s*%/.exec(
      decode(html),
    );
  return m
    ? {
        deposit: Number(m[1]),
        rentWithinLimit: Number(m[2]),
        limitManwon: Number(m[3]),
        rentOverLimit: Number(m[4]),
      }
    : undefined;
}

/** loan-rates.json 의 table.rows 에서 라벨로 금리를 찾는다 */
export function tablePercent(product, labelIncludes) {
  return product.table?.rows.find((r) => r.label.includes(labelIncludes))?.percent;
}

/** 월세 두 상품을 페이지에서 읽은 값과 저장값을 비교한다 */
export function diffWolse(productId, saved, live) {
  if (!live) return [`${productId}: 페이지에서 금리 문구를 읽지 못했습니다 (사이트 구조가 바뀌었을 수 있음)`];
  const pairs =
    productId === 'housing-stable-wolse'
      ? [
          ['우대형', tablePercent(saved, '우대형'), live.preferred],
          ['일반형', tablePercent(saved, '일반형'), live.general],
        ]
      : [
          ['보증금 대출', tablePercent(saved, '보증금'), live.deposit],
          ['월세금 초과분', tablePercent(saved, '초과분'), live.rentOverLimit],
        ];
  return pairs.filter(([, s, l]) => s !== l).map(([name, s, l]) => `${productId} ${name}: ${s}% → ${l}%`);
}

/** 확인일로부터 지난 일수 (UTC 날짜 기준) */
export function daysSince(checkedAt, today) {
  return Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${checkedAt}T00:00:00Z`)) / 86_400_000);
}
