import type { RulesConfig } from '../config';
import { mulPercent } from './money';

/**
 * 취득세와 중개보수의 법정 계산. 요율·구간은 rules.config 의 표를 쓰며 모두 잠정값이다.
 * 재산세는 잠정 세율표로 계산하고, 종합부동산세는 개편 내용을 확인하지 못해 계산하지 않는다.
 */

export interface AcquisitionTaxResult {
  /** 적용한 취득세 표준세율(%) */
  taxRatePercent: number;
  acquisitionTax: number;
  localEducationTax: number;
  ruralSpecialTax: number;
  total: number;
  notes: string[];
}

/**
 * 주택 유상취득 취득세 (표준세율). 6억 이하 1%, 9억 이상 3%, 사이는 (가액 ÷ 3억 × 2 − 3)% 를
 * 소수 둘째 자리(%)까지 반올림한다 (지방세법 제11조: 소수점 이하 다섯째 자리에서 반올림하여 넷째 자리까지).
 * 다주택·조정대상지역 중과와 생애최초 감면은 반영하지 않는다. 중과 세율을 알면 rateOverridePercent 로 본세만 계산한다.
 */
export function acquisitionTax(
  priceWon: number,
  areaM2: number | undefined,
  cfg: RulesConfig['acquisitionTax'],
  rateOverridePercent?: number,
): AcquisitionTaxResult {
  const notes: string[] = [];
  if (rateOverridePercent !== undefined) {
    const tax = mulPercent(priceWon, rateOverridePercent);
    notes.push(
      `취득세 본세만 입력한 세율 ${rateOverridePercent}% 로 계산했습니다. 중과 시 지방교육세·농어촌특별세는 세율이 달라 포함하지 않았습니다.`,
    );
    return {
      taxRatePercent: rateOverridePercent,
      acquisitionTax: tax,
      localEducationTax: 0,
      ruralSpecialTax: 0,
      total: tax,
      notes,
    };
  }

  let rate: number;
  if (priceWon <= cfg.lowerLimitWon) rate = cfg.lowRatePercent;
  else if (priceWon >= cfg.upperLimitWon) rate = cfg.highRatePercent;
  else rate = Math.round(((priceWon / 300_000_000) * 2 - 3) * 100) / 100;

  const tax = mulPercent(priceWon, rate);
  const edu = mulPercent(priceWon, rate * cfg.localEducationShareOfRate);
  let rural = 0;
  if (areaM2 === undefined) {
    notes.push('전용면적이 없어 농어촌특별세는 제외했습니다 (전용 85㎡ 초과 시 부과).');
  } else if (areaM2 > cfg.ruralSpecialAboveAreaM2) {
    rural = mulPercent(priceWon, cfg.ruralSpecialPercent);
  }
  notes.push('일반 세율 기준입니다. 다주택·조정대상지역 중과와 생애최초 등 감면은 반영하지 않았습니다.');
  return {
    taxRatePercent: rate,
    acquisitionTax: tax,
    localEducationTax: edu,
    ruralSpecialTax: rural,
    total: tax + edu + rural,
    notes,
  };
}

export interface BrokerageResult {
  feeWon: number;
  /** 요율을 곱한 거래금액(월세는 환산보증금) */
  basisWon: number;
  ratePercent: number;
  capWon?: number;
  capped: boolean;
  notes: string[];
}

type Band = RulesConfig['brokerage']['sale'][number];

function pickBand(bands: readonly Band[], basisWon: number): Band {
  // 'underWon 미만' 구간을 순서대로 찾고, 없으면 마지막(상한 없는) 구간
  return (
    bands.find((b) => b.underWon !== undefined && basisWon < b.underWon) ?? (bands[bands.length - 1] as Band)
  );
}

/**
 * 중개보수 상한 (한 쪽이 부담하는 금액). 매매는 매매가, 전세는 보증금, 월세는 환산보증금
 * (보증금 + 월세 × 100, 환산액이 5천만 원 미만이면 월세 × 70) 기준이다. 부가세는 포함하지 않는다.
 */
export function brokerageFee(
  kind: 'sale' | 'jeonse' | 'monthly',
  amountWon: number,
  monthlyRentWon: number | undefined,
  cfg: RulesConfig['brokerage'],
): BrokerageResult {
  const notes: string[] = [
    '법정 상한 요율 기준이며 실제 금액은 중개사와 협의할 수 있습니다. 부가세는 포함하지 않았습니다.',
  ];
  let basis = amountWon;
  if (kind === 'monthly') {
    if (!monthlyRentWon) {
      notes.push(
        '월세를 입력하지 않아 보증금만으로 계산했습니다. 월세를 입력하면 환산보증금으로 다시 계산합니다.',
      );
    } else {
      const full = amountWon + monthlyRentWon * cfg.monthlyRentMultiplier;
      basis =
        full < cfg.monthlyRentThresholdWon
          ? amountWon + monthlyRentWon * cfg.monthlyRentMultiplierBelowThreshold
          : full;
      notes.push(`월세는 환산보증금 ${basis.toLocaleString('ko-KR')}원 기준으로 계산했습니다.`);
    }
  }
  const band = pickBand(kind === 'sale' ? cfg.sale : cfg.lease, basis);
  const raw = mulPercent(basis, band.ratePercent);
  const capped = band.capWon !== undefined && raw > band.capWon;
  if (kind === 'sale' && basis >= 900_000_000) notes.push('9억 원 이상 매매는 협의로 정해질 수 있습니다.');
  return {
    feeWon: capped ? (band.capWon as number) : raw,
    basisWon: basis,
    ratePercent: band.ratePercent,
    capWon: band.capWon,
    capped,
    notes,
  };
}

export interface PropertyTaxResult {
  /** 1세대 1주택 특례(세율·공정시장가액비율)를 적용했는가 */
  singleHomeApplied: boolean;
  fairMarketPercent: number;
  taxBaseWon: number;
  /** 누진세율로 계산한 재산세 본세 */
  baseTaxWon: number;
  urbanAreaWon: number;
  /** 본세 + 도시지역분 */
  propertyTaxWon: number;
  localEducationTaxWon: number;
  /** 재산세 + 지방교육세 (연간) */
  totalWon: number;
  notes: string[];
}

type TaxBracket = RulesConfig['propertyTax']['brackets'][number];

const bracketFor = (brackets: readonly TaxBracket[], value: number): TaxBracket =>
  brackets.find((b) => b.upToWon !== undefined && value <= b.upToWon) ??
  (brackets[brackets.length - 1] as TaxBracket);

function progressive(base: number, brackets: readonly TaxBracket[]): number {
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    const upper = b.upToWon ?? Number.POSITIVE_INFINITY;
    if (base > lower) tax += mulPercent(Math.min(base, upper) - lower, b.ratePercent);
    lower = upper;
    if (base <= upper) break;
  }
  return tax;
}

/**
 * 주택 재산세(연간). 공시가격에 공정시장가액비율을 곱한 과세표준에 누진세율을 적용하고 도시지역분과
 * 지방교육세를 더한다. 1세대 1주택이고 공시가격이 9억 원 이하이면 특례세율·낮은 공정시장가액비율을 쓴다.
 * 세부담상한, 지방자치단체 조례 탄력세율, 소방분 지역자원시설세, 종합부동산세는 반영하지 않는다.
 */
export function propertyTax(
  publicPriceWon: number,
  singleHome: boolean,
  cfg: RulesConfig['propertyTax'],
): PropertyTaxResult {
  const special = singleHome && publicPriceWon <= cfg.singleHomeMaxPublicPriceWon;
  const fair = special
    ? bracketFor(cfg.singleHomeFairMarket, publicPriceWon).ratePercent
    : cfg.fairMarketPercent;
  const taxBaseWon = mulPercent(publicPriceWon, fair);
  const baseTaxWon = progressive(taxBaseWon, special ? cfg.singleHomeBrackets : cfg.brackets);
  const urbanAreaWon = mulPercent(taxBaseWon, cfg.urbanAreaPercent);
  const propertyTaxWon = baseTaxWon + urbanAreaWon;
  const localEducationTaxWon = mulPercent(propertyTaxWon, cfg.localEducationPercent);

  const notes: string[] = [
    '세부담상한(전년 대비 상한), 지자체 조례 탄력세율, 소방분 지역자원시설세는 반영하지 않았습니다. 도시지역(도시계획구역) 주택을 가정해 도시지역분을 더했습니다.',
  ];
  if (singleHome && !special) {
    notes.push('공시가격이 9억 원을 넘으면 1세대 1주택 특례를 적용하지 않고 일반 세율로 계산합니다.');
  }
  return {
    singleHomeApplied: special,
    fairMarketPercent: fair,
    taxBaseWon,
    baseTaxWon,
    urbanAreaWon,
    propertyTaxWon,
    localEducationTaxWon,
    totalWon: propertyTaxWon + localEducationTaxWon,
    notes,
  };
}
