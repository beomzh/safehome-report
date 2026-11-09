export type MarketHousing = 'apt' | 'rowhouse' | 'officetel';

export interface MarketQuery {
  housing: MarketHousing;
  lawdCd: string;
  areaM2: number;
  complexName?: string;
}

/** /api/market 쿼리 검증. 법정동코드는 5자리 숫자, 면적은 0 초과 숫자 */
export function parseMarketQuery(
  params: URLSearchParams,
): { ok: true; query: MarketQuery } | { ok: false; error: string } {
  const lawdCd = (params.get('lawdCd') ?? '').trim();
  if (!/^\d{5}$/.test(lawdCd))
    return { ok: false, error: '법정동코드(시군구 5자리)를 입력하세요. 예: 11680' };
  const area = (params.get('areaM2') ?? '').trim();
  if (!/^\d{1,4}(\.\d{1,3})?$/.test(area) || Number(area) <= 0) {
    return { ok: false, error: '전용면적(㎡)을 0보다 큰 숫자로 입력하세요. 예: 84.99' };
  }
  const housing = (params.get('housing') ?? 'apt').trim();
  if (housing !== 'apt' && housing !== 'rowhouse' && housing !== 'officetel')
    return { ok: false, error: '주택 유형은 apt, rowhouse, officetel 중 하나여야 합니다.' };
  const complexName = (params.get('complexName') ?? '').trim();
  return {
    ok: true,
    query: { housing, lawdCd, areaM2: Number(area), complexName: complexName || undefined },
  };
}
