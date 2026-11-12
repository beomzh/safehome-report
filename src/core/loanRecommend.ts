import { z } from 'zod';

/**
 * 정책 대출(주택도시기금) 후보 추천. 공식 안내 페이지의 대출대상·대상주택 요건을 데이터(rules.config/loan-eligibility.json)로
 * 두고 사용자의 상황과 매물에 맞춰 "해당 가능 / 확인 필요 / 해당 안 됨"으로 가른다 (순수 함수, 입력만 본다).
 * 입력하지 않은 항목은 충족 여부를 단정하지 않고 "확인 필요"로 둔다. 실제 대출 심사는 수탁은행이 한다.
 */

const when = z.enum(['always', 'newlywed', 'firstHome', 'twoChildren', 'dualIncome']);
export type LimitCondition = z.infer<typeof when>;

const won = z.number().int().positive();

export const eligibilityProductSchema = z.object({
  productId: z.string().min(1),
  kind: z.enum(['jeonse', 'monthly', 'sale']),
  requireHomeless: z.boolean(),
  requireHead: z.boolean(),
  requireNewlywed: z.boolean().optional(),
  requireNewborn: z.boolean().optional(),
  /** 해당하는 조건의 한도 중 가장 큰 값이 소득 상한이다 (예: 신혼이면 신혼 한도) */
  incomeLimits: z.array(z.object({ when, maxWon: won })).min(1),
  /** 부부 합산이 상한을 넘어도 대출신청인 1인 소득이 이 금액 이하면 신혼부부는 가능 (맞벌이일 때만 해당) */
  singleEarnerExceptionWon: won.optional(),
  netAssetMaxWon: won,
  age: z.object({ min: z.number().int(), max: z.number().int() }).optional(),
  /** 임차보증금(전세·월세) 또는 주택가격(매매) 상한. 해당하는 조건 중 가장 큰 값을 쓴다 */
  dealCaps: z.array(z.object({ when, capitalWon: won, otherWon: won })).min(1),
  monthlyRentMaxWon: won.optional(),
  areaMaxM2: z.number().positive().optional(),
  source: z.object({
    name: z.string(),
    url: z.string().url(),
    checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});
export type EligibilityProduct = z.infer<typeof eligibilityProductSchema>;

export const eligibilitySchema = z.object({
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string(),
  products: z.array(eligibilityProductSchema),
});

export interface LoanProfile {
  /** 부부합산 연소득 (원). 모르면 undefined */
  incomeWon?: number;
  /** 순자산(자산 − 부채, 원). 모르면 undefined */
  netAssetWon?: number;
  /** 만 나이 */
  age?: number;
  /** 본인과 세대원 모두 무주택 */
  homeless: boolean;
  /** 세대주 (예비 세대주 포함) */
  householdHead: boolean;
  /** 혼인 7년 이내 또는 3개월 이내 결혼 예정 */
  newlywed: boolean;
  /** 대출 접수일 기준 2년 내 출산(입양)한 자녀가 있음 */
  newbornWithin2y: boolean;
  minorChildren: number;
  /** 생애최초 주택 구입 */
  firstHome: boolean;
  /** 부부 모두 소득이 있음 */
  dualIncome: boolean;
}

export interface LoanDeal {
  kind: 'jeonse' | 'monthly' | 'sale';
  /** 보증금(전세·월세) 또는 매매가 (원) */
  amountWon: number;
  monthlyRentWon?: number;
  /** 수도권(서울·인천·경기)인가. 모르면 undefined */
  capital?: boolean;
  /** 전용면적 (㎡) */
  areaM2?: number;
}

export type CheckResult = 'ok' | 'fail' | 'unknown';
export interface Check {
  label: string;
  result: CheckResult;
  detail: string;
}
export type RecommendStatus = 'likely' | 'check' | 'unlikely';

export interface GridLike {
  cols: string[];
  rows: { label: string; percents: number[] }[];
}
export interface RateGuess {
  minPercent: number;
  maxPercent: number;
  /** 칸별 표에서 소득 구간·금액 구간으로 고른 값인지, 상품 전체 범위인지 */
  basis: 'grid' | 'range';
}

export interface Recommendation {
  productId: string;
  status: RecommendStatus;
  checks: Check[];
  rate?: RateGuess;
}

const fmt = (w: number): string => {
  const eok = w / 100_000_000;
  if (eok >= 1) return `${Number.isInteger(eok) ? eok : eok.toFixed(2).replace(/0$/, '')}억원`;
  return `${(w / 10_000).toLocaleString('ko-KR')}만원`;
};

/** "7.5천만원", "1.3억원", "5천만원" 같은 금액 표기를 원으로 바꾼다. 못 읽으면 undefined */
export function parseKoreanAmount(text: string): number | undefined {
  const m = /(\d+(?:\.\d+)?)\s*(천만원|억원|만원)/.exec(text);
  if (!m) return undefined;
  const unit = { 천만원: 10_000_000, 억원: 100_000_000, 만원: 10_000 }[m[2] as '천만원' | '억원' | '만원'];
  return Math.round(Number(m[1]) * unit);
}

/** 구간 라벨("A 초과 ~ B 이하", "B 이하", "A 초과")의 위쪽 끝. 위쪽이 열려 있으면 Infinity, 못 읽으면 undefined */
export function upperBound(label: string): number | undefined {
  const l = label.replace(/\(맞벌이\)/g, '').replace(/~\s*~/g, '~');
  const hasUpper = /이하/.test(l);
  if (hasUpper) {
    const parts = l.split(/~|초과/).filter((s) => /이하/.test(s));
    const last = parts[parts.length - 1];
    return last ? parseKoreanAmount(last) : undefined;
  }
  return /초과/.test(l) ? Infinity : undefined;
}

/**
 * 칸별 금리표에서 소득 구간(행)과 금액 구간(열)에 맞는 기본금리를 고른다. 열이 대출기간(년)이면 그 행의 범위를 돌려준다.
 * 우대금리·지방 인하는 반영하지 않은 기본금리다. 구간 라벨을 읽지 못하면 undefined.
 */
export function gridRate(
  grid: GridLike,
  incomeWon: number,
  dualIncome: boolean,
  valueWon: number | undefined,
): { minPercent: number; maxPercent: number } | undefined {
  const rows = grid.rows.filter((r) => dualIncome || !r.label.includes('맞벌이'));
  const row = rows.find((r) => {
    const ub = upperBound(r.label);
    return ub !== undefined && incomeWon <= ub;
  });
  if (!row) return undefined;
  const byTerm = grid.cols.every((c) => /년$/.test(c));
  if (byTerm || valueWon === undefined)
    return { minPercent: Math.min(...row.percents), maxPercent: Math.max(...row.percents) };
  const colIndex = grid.cols.findIndex((c) => {
    const ub = upperBound(c);
    return ub !== undefined && valueWon <= ub;
  });
  const v = row.percents[colIndex];
  return colIndex < 0 || v === undefined ? undefined : { minPercent: v, maxPercent: v };
}

const applies = (c: LimitCondition, p: LoanProfile): boolean =>
  c === 'always' ||
  (c === 'newlywed' && p.newlywed) ||
  (c === 'firstHome' && p.firstHome) ||
  (c === 'twoChildren' && p.minorChildren >= 2) ||
  (c === 'dualIncome' && p.dualIncome);

export function evaluateProduct(
  product: EligibilityProduct,
  profile: LoanProfile,
  deal: LoanDeal,
): { status: RecommendStatus; checks: Check[] } {
  const checks: Check[] = [];
  const add = (label: string, result: CheckResult, detail: string) => checks.push({ label, result, detail });

  if (product.requireHomeless)
    add(
      '무주택',
      profile.homeless ? 'ok' : 'fail',
      profile.homeless ? '무주택 세대원 요건 충족으로 입력함' : '무주택이 아니면 대출 대상이 아닙니다',
    );
  if (product.requireHead)
    add(
      '세대주',
      profile.householdHead ? 'ok' : 'fail',
      profile.householdHead ? '세대주(예비 세대주 포함)로 입력함' : '세대주(예비 세대주 포함)여야 합니다',
    );
  if (product.requireNewlywed)
    add(
      '신혼부부',
      profile.newlywed ? 'ok' : 'fail',
      profile.newlywed
        ? '혼인 7년 이내(또는 3개월 내 결혼 예정)로 입력함'
        : '혼인 7년 이내인 신혼부부 대상입니다',
    );
  if (product.requireNewborn)
    add(
      '신생아(2년 내 출산) 가구',
      profile.newbornWithin2y ? 'ok' : 'fail',
      profile.newbornWithin2y
        ? '대출 접수일 기준 2년 내 출산(입양)으로 입력함'
        : '대출 접수일 기준 2년 내 출산한 가구 대상입니다',
    );
  if (product.age) {
    const { min, max } = product.age;
    if (profile.age === undefined)
      add('나이', 'unknown', `만 ${min}~${max}세 요건 — 나이를 입력하면 확인합니다`);
    else {
      const ok = profile.age >= min && profile.age <= max;
      add('나이', ok ? 'ok' : 'fail', `만 ${min}~${max}세 요건, 입력 만 ${profile.age}세`);
    }
  }

  // 소득
  const limit = Math.max(
    ...product.incomeLimits.filter((l) => applies(l.when, profile)).map((l) => l.maxWon),
  );
  if (profile.incomeWon === undefined) {
    add('소득', 'unknown', `부부합산 연소득 ${fmt(limit)} 이하 요건 — 연소득을 입력하면 확인합니다`);
  } else if (profile.incomeWon <= limit) {
    add('소득', 'ok', `연소득 ${fmt(profile.incomeWon)}은 상한 ${fmt(limit)} 이하`);
  } else if (product.singleEarnerExceptionWon !== undefined && profile.newlywed && profile.dualIncome) {
    add(
      '소득',
      'unknown',
      `합산 ${fmt(profile.incomeWon)}이 상한 ${fmt(limit)}을 넘지만, 신혼부부는 대출신청인 1인 소득이 ${fmt(product.singleEarnerExceptionWon)} 이하이면 가능합니다`,
    );
  } else {
    add('소득', 'fail', `연소득 ${fmt(profile.incomeWon)}이 상한 ${fmt(limit)}을 넘습니다`);
  }

  // 순자산
  if (profile.netAssetWon === undefined)
    add(
      '순자산',
      'unknown',
      `순자산 ${fmt(product.netAssetMaxWon)} 이하 요건 — 순자산(자산−부채)을 입력하면 확인합니다`,
    );
  else
    add(
      '순자산',
      profile.netAssetWon <= product.netAssetMaxWon ? 'ok' : 'fail',
      `순자산 ${fmt(profile.netAssetWon)}, 상한 ${fmt(product.netAssetMaxWon)}`,
    );

  // 보증금·주택가격 상한
  const caps = product.dealCaps.filter((c) => applies(c.when, profile));
  const capitalCap = Math.max(...caps.map((c) => c.capitalWon));
  const otherCap = Math.max(...caps.map((c) => c.otherWon));
  const dealLabel = deal.kind === 'sale' ? '주택가격' : '임차보증금';
  if (deal.capital === undefined && capitalCap !== otherCap) {
    if (deal.amountWon <= otherCap)
      add(
        dealLabel,
        'ok',
        `${dealLabel} ${fmt(deal.amountWon)}은 상한(수도권 ${fmt(capitalCap)}, 그 외 ${fmt(otherCap)}) 이하`,
      );
    else if (deal.amountWon > capitalCap)
      add(
        dealLabel,
        'fail',
        `${dealLabel} ${fmt(deal.amountWon)}이 상한(수도권 ${fmt(capitalCap)})을 넘습니다`,
      );
    else
      add(
        dealLabel,
        'unknown',
        `지역(수도권 여부)을 모르면 확인할 수 없습니다 — 상한 수도권 ${fmt(capitalCap)}, 그 외 ${fmt(otherCap)}`,
      );
  } else {
    const cap = deal.capital === false ? otherCap : capitalCap;
    add(
      dealLabel,
      deal.amountWon <= cap ? 'ok' : 'fail',
      `${dealLabel} ${fmt(deal.amountWon)}, 상한 ${fmt(cap)}${capitalCap !== otherCap ? (deal.capital === false ? '(수도권 외)' : '(수도권)') : ''}`,
    );
  }

  if (product.monthlyRentMaxWon !== undefined) {
    if (deal.monthlyRentWon === undefined)
      add('월세', 'unknown', `월세 ${fmt(product.monthlyRentMaxWon)} 이하 요건 — 월세를 입력하면 확인합니다`);
    else
      add(
        '월세',
        deal.monthlyRentWon <= product.monthlyRentMaxWon ? 'ok' : 'fail',
        `월세 ${fmt(deal.monthlyRentWon)}, 상한 ${fmt(product.monthlyRentMaxWon)}`,
      );
  }
  if (product.areaMaxM2 !== undefined) {
    if (deal.areaM2 === undefined)
      add('전용면적', 'unknown', `전용 ${product.areaMaxM2}㎡ 이하 요건 — 전용면적을 입력하면 확인합니다`);
    else
      add(
        '전용면적',
        deal.areaM2 <= product.areaMaxM2 ? 'ok' : 'fail',
        `전용 ${deal.areaM2}㎡, 상한 ${product.areaMaxM2}㎡`,
      );
  }

  const status: RecommendStatus = checks.some((c) => c.result === 'fail')
    ? 'unlikely'
    : checks.some((c) => c.result === 'unknown')
      ? 'check'
      : 'likely';
  return { status, checks };
}

/**
 * 계약 유형에 맞는 정책 대출을 평가해 정렬해 돌려준다: 해당 가능 → 확인 필요 → 해당 안 됨,
 * 같은 상태에서는 기본금리가 낮은 순(금리를 모르면 뒤). rateOf 는 상품의 금리표·범위를 넘겨 준다(없으면 undefined).
 */
export function recommendLoans(
  products: readonly EligibilityProduct[],
  profile: LoanProfile,
  deal: LoanDeal,
  rateOf: (
    productId: string,
  ) => { grid?: GridLike; range?: { minPercent: number; maxPercent: number } } | undefined,
): Recommendation[] {
  const out = products
    .filter((p) => p.kind === deal.kind)
    .map((p): Recommendation => {
      const { status, checks } = evaluateProduct(p, profile, deal);
      const info = rateOf(p.productId);
      let rate: RateGuess | undefined;
      if (info?.grid && profile.incomeWon !== undefined) {
        const g = gridRate(
          info.grid,
          profile.incomeWon,
          profile.dualIncome,
          deal.kind === 'sale' ? undefined : deal.amountWon,
        );
        if (g) rate = { ...g, basis: 'grid' };
      }
      if (!rate && info?.range) rate = { ...info.range, basis: 'range' };
      return { productId: p.productId, status, checks, rate };
    });
  const order: Record<RecommendStatus, number> = { likely: 0, check: 1, unlikely: 2 };
  return out.sort(
    (a, b) => order[a.status] - order[b.status] || (a.rate?.minPercent ?? 99) - (b.rate?.minPercent ?? 99),
  );
}
