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
  /** 혼자 사는 단독 세대주여야 한다 (청년전용 보증부월세대출 등). 혼인 상태를 모르면 확인 필요 */
  requireSingle: z.boolean().optional(),
  /**
   * 미혼 단독세대주 특례(디딤돌: 만 30세 이상 미혼 단독세대주는 대상 주택이 전용 60㎡ 이하·평가액 3억원 이하로 제한되고
   * 호당 한도가 1.5억원(생애최초 2억원)이다). 혼인 상태가 미혼으로 입력되면 일반 한도·면적 대신 적용한다.
   */
  singleHead: z
    .object({
      minAge: z.number().int().positive(),
      areaMaxM2: z.number().positive(),
      dealCapWon: won,
      capWon: won,
      capFirstHomeWon: won,
    })
    .optional(),
  requireNewborn: z.boolean().optional(),
  /** 해당하는 조건의 한도 중 가장 큰 값이 소득 상한이다 (예: 신혼이면 신혼 한도) */
  incomeLimits: z.array(z.object({ when, maxWon: won })).min(1),
  /** 부부 합산이 상한을 넘어도 대출신청인 1인 소득이 이 금액 이하면 신혼부부는 가능 (맞벌이일 때만 해당) */
  singleEarnerExceptionWon: won.optional(),
  netAssetMaxWon: won,
  age: z.object({ min: z.number().int(), max: z.number().int() }).optional(),
  /** 임차보증금(전세·월세) 또는 주택가격(매매) 상한. 해당하는 조건 중 가장 큰 값을 쓴다 */
  dealCaps: z.array(z.object({ when, capitalWon: won, otherWon: won })).min(1),
  /**
   * 이 상품으로 대출받을 때의 조건(공식 안내). "필요 조건" 계산에 예시 가정 대신 쓴다.
   * 월세 상품은 LTV·한도 개념이 달라 담지 않는다.
   */
  financing: z
    .object({
      /** 담보(전세는 보증금)대비 대출 비율(%). 해당하는 조건 중 가장 큰 값. requiresNonCapital 은 수도권이 아닐 때만 적용 */
      ltvPercent: z
        .array(
          z.object({
            when,
            percent: z.number().positive().max(100),
            requiresNonCapital: z.boolean().optional(),
          }),
        )
        .min(1),
      /** 소득 대비 상환 한도(DTI, %). 있으면 DSR 한도 칸에 쓴다 */
      dtiPercent: z.number().positive().max(100).optional(),
      /** 선택 가능한 대출기간(년). 있으면 가장 긴 기간을 쓴다 */
      termYears: z.array(z.number().int().positive()).optional(),
      /** 호당 대출 한도. 해당하는 조건 중 가장 큰 값 */
      capWon: z.array(z.object({ when, capitalWon: won, otherWon: won })).min(1),
      note: z.string().optional(),
    })
    .optional(),
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
  /** 혼자 사는 미혼 단독 세대. true 미혼, false 기혼·신혼, 모르면 undefined */
  single?: boolean;
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
  if (product.requireSingle) {
    if (profile.single === undefined)
      add('단독세대주(혼인 상태)', 'unknown', '혼자 사는 단독 세대주 요건 — 혼인 상태를 입력하면 확인합니다');
    else
      add(
        '단독세대주(혼인 상태)',
        profile.single ? 'ok' : 'fail',
        profile.single
          ? '미혼 단독 세대로 입력함'
          : '혼자 사는 단독 세대주만 대상입니다 (기혼·신혼은 해당 안 됨)',
      );
  }
  const single = product.singleHead && profile.single === true ? product.singleHead : undefined;
  if (single) {
    if (profile.age === undefined)
      add(
        '나이(미혼 단독세대주)',
        'unknown',
        `미혼 단독세대주는 만 ${single.minAge}세 이상 요건 — 나이를 입력하면 확인합니다`,
      );
    else
      add(
        '나이(미혼 단독세대주)',
        profile.age >= single.minAge ? 'ok' : 'fail',
        `미혼 단독세대주는 만 ${single.minAge}세 이상, 입력 만 ${profile.age}세`,
      );
  }
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
    add(
      '소득',
      'unknown',
      `${profile.single ? '연소득' : '부부합산 연소득'} ${fmt(limit)} 이하 요건 — 연소득을 입력하면 확인합니다`,
    );
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
  // 미혼 단독세대주 특례가 있으면 일반 상한 대신 그 주택가격 상한(지역 무관)을 쓴다
  const caps = single
    ? [{ when: 'always' as const, capitalWon: single.dealCapWon, otherWon: single.dealCapWon }]
    : product.dealCaps.filter((c) => applies(c.when, profile));
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
  const areaMax = single ? single.areaMaxM2 : product.areaMaxM2;
  if (areaMax !== undefined) {
    if (deal.areaM2 === undefined)
      add('전용면적', 'unknown', `전용 ${areaMax}㎡ 이하 요건 — 전용면적을 입력하면 확인합니다`);
    else add('전용면적', deal.areaM2 <= areaMax ? 'ok' : 'fail', `전용 ${deal.areaM2}㎡, 상한 ${areaMax}㎡`);
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

export interface PolicyAssumptions {
  productId: string;
  ltvPercent: number;
  /** 상품에 DTI 한도가 있으면 그 값 */
  dtiPercent?: number;
  annualRatePercent: number;
  /** 금리를 어떻게 골랐는지 */
  rateBasis: 'grid' | 'range-max';
  termYears?: number;
  capWon: number;
  notes: string[];
}

/** 열 라벨이 "30년" 같은 대출기간인 금리표에서 소득 구간(행)의 해당 기간 금리를 고른다 */
export function gridRateAtTerm(
  grid: GridLike,
  incomeWon: number,
  dualIncome: boolean,
  termYears: number,
): number | undefined {
  const col = grid.cols.findIndex((c) => c === `${termYears}년`);
  if (col < 0) return undefined;
  const rows = grid.rows.filter((r) => dualIncome || !r.label.includes('맞벌이'));
  const row = rows.find((r) => {
    const ub = upperBound(r.label);
    return ub !== undefined && incomeWon <= ub;
  });
  return row?.percents[col];
}

/**
 * 추천된 정책 대출의 공식 조건으로 "필요 조건" 계산 기준값을 정한다 (순수 함수).
 * 금리: 소득을 알면 공식 금리표에서(구입 상품은 가장 긴 기간 열, 전세 상품은 보증금 구간 열), 모르면 상품 금리 범위의 상단을 쓴다.
 * 월세 상품이거나 조건 데이터가 없으면 undefined.
 */
export function policyAssumptions(
  product: EligibilityProduct,
  profile: LoanProfile,
  deal: LoanDeal,
  rate: { grid?: GridLike; range?: { minPercent: number; maxPercent: number } } | undefined,
): PolicyAssumptions | undefined {
  const f = product.financing;
  if (!f) return undefined;
  const notes: string[] = [];

  const ltvs = f.ltvPercent.filter(
    (l) => applies(l.when, profile) && !(l.requiresNonCapital && deal.capital !== false),
  );
  const ltvPercent = Math.max(...ltvs.map((l) => l.percent));
  const singleHead = product.singleHead && profile.single === true ? product.singleHead : undefined;
  const capCandidates = f.capWon.filter((c) => applies(c.when, profile));
  const capWon = singleHead
    ? profile.firstHome
      ? singleHead.capFirstHomeWon
      : singleHead.capWon
    : Math.max(...capCandidates.map((c) => (deal.capital === true ? c.capitalWon : c.otherWon)));
  if (singleHead)
    notes.push(
      '미혼 단독세대주 특례(대상 주택 전용 60㎡·평가액 3억원 이하, 호당 한도 1.5억원·생애최초 2억원)를 적용했습니다.',
    );
  if (!singleHead && deal.capital === undefined && f.capWon.some((c) => c.capitalWon !== c.otherWon))
    notes.push('수도권 여부를 몰라 호당 한도는 수도권 외(낮은 쪽) 기준으로 계산했습니다.');
  if (f.note) notes.push(f.note);

  const termYears = f.termYears && f.termYears.length > 0 ? Math.max(...f.termYears) : undefined;
  let annual: number | undefined;
  let rateBasis: PolicyAssumptions['rateBasis'] = 'grid';
  if (rate?.grid && profile.incomeWon !== undefined) {
    annual =
      termYears !== undefined
        ? gridRateAtTerm(rate.grid, profile.incomeWon, profile.dualIncome, termYears)
        : gridRate(
            rate.grid,
            profile.incomeWon,
            profile.dualIncome,
            deal.kind === 'sale' ? undefined : deal.amountWon,
          )?.maxPercent;
  }
  if (annual === undefined) {
    if (!rate?.range) return undefined;
    annual = rate.range.maxPercent;
    rateBasis = 'range-max';
    notes.push(
      '소득을 입력하지 않아(또는 구간을 못 찾아) 금리는 상품 금리 범위의 상단을 썼습니다. 소득을 입력하면 구간별 금리를 씁니다.',
    );
  }
  return {
    productId: product.productId,
    ltvPercent,
    dtiPercent: f.dtiPercent,
    annualRatePercent: annual,
    rateBasis,
    termYears,
    capWon,
    notes,
  };
}
