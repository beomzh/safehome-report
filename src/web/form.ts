import type { BuildingEntry, EulEntry, GapEntry, GapEntryType, RiskInput } from '../core';

export type Kind = 'jeonse' | 'monthly' | 'sale';
export type MarketSource = 'user' | 'trade_median' | 'official_price';

/** 갑구에서 "미말소 상태로 존재하는" 항목만 체크한다. 말소된 항목은 체크하지 않는다 */
export const GAP_FLAGS = [
  { key: 'trust', label: '신탁' },
  { key: 'seizure', label: '압류' },
  { key: 'provisional_seizure', label: '가압류' },
  { key: 'provisional_disposition', label: '가처분' },
  { key: 'auction_start', label: '경매개시결정' },
  { key: 'lease_registration_order', label: '임차권등기명령' },
  { key: 'provisional_registration', label: '가등기' },
] as const satisfies readonly { key: GapEntryType; label: string }[];
export type GapFlagKey = (typeof GAP_FLAGS)[number]['key'];

export interface MortgageRow {
  amountManwon: string;
  registeredAt: string;
  cancelled: boolean;
}
export interface TransferRow {
  registeredAt: string;
}

export interface FormState {
  kind: Kind;
  amountManwon: string;
  counterpartyName: string;
  moveInDate: string;
  fixedDate: string;
  marketManwon: string;
  marketSource: MarketSource;
  marketConfidence: 'high' | 'low';
  includeRegistry: boolean;
  /** 매물 설명에 적힌 융자금 (만원, 선택·미확인) — 등기부 없는 사전 점검에만 쓴다 */
  statedLoanManwon: string;
  /** 실거래가 조회용 입력 (매물 텍스트 추출 결과가 채운다) */
  lookupHousing: 'apt' | 'rowhouse' | 'officetel' | 'house';
  /** 매물 주소 또는 지역 (입력하면 법정동코드·법정동명을 자동으로 찾는다) */
  lookupAddress: string;
  /** 건축물대장 조회용 지번 (본번-부번) */
  buildingJibun: string;
  /** 건축물대장에서 가져와 선택한 건물 (용도 룰 입력) */
  buildingEntries: BuildingEntry[];
  lookupLawdCd: string;
  lookupAreaM2: string;
  lookupComplexName: string;
  /** 법정동명 (주소에서 읽거나 직접 입력) */
  lookupDongName: string;
  /** 값이 바뀔 때마다 시세 조회를 자동 실행한다 (매물 설명 적용 시 증가) */
  lookupNonce: number;
  owners: string;
  gapFlags: Record<GapFlagKey, boolean>;
  mortgages: MortgageRow[];
  transfers: TransferRow[];
}

export const emptyForm = (): FormState => ({
  kind: 'jeonse',
  amountManwon: '',
  counterpartyName: '',
  moveInDate: '',
  fixedDate: '',
  marketManwon: '',
  marketSource: 'user',
  marketConfidence: 'high',
  includeRegistry: false,
  statedLoanManwon: '',
  lookupHousing: 'apt',
  lookupAddress: '',
  buildingJibun: '',
  buildingEntries: [],
  lookupLawdCd: '',
  lookupAreaM2: '',
  lookupComplexName: '',
  lookupDongName: '',
  lookupNonce: 0,
  owners: '',
  gapFlags: {
    trust: false,
    seizure: false,
    provisional_seizure: false,
    provisional_disposition: false,
    auction_start: false,
    lease_registration_order: false,
    provisional_registration: false,
  },
  mortgages: [],
  transfers: [],
});

export type BuildResult = { ok: true; input: RiskInput } | { ok: false; errors: string[] };

const MANWON = 10_000;

/** "35,000" 같은 만원 단위 정수 문자열을 원 단위 정수로 변환한다. 소수·음수·문자는 거부 (ADR-0004) */
export function parseManwon(raw: string): { ok: true; won: number } | { ok: false } {
  const s = raw.trim();
  if (!/^\d{1,3}(,\d{3})+$|^\d+$/.test(s)) return { ok: false };
  const won = Number(s.replace(/,/g, '')) * MANWON;
  return Number.isSafeInteger(won) ? { ok: true, won } : { ok: false };
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** 오늘 날짜(로컬 기준) YYYY-MM-DD. core 는 현재 시각을 읽지 않으므로 UI 계층에서 주입한다 */
export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

const AMOUNT_LABEL: Record<Kind, string> = { jeonse: '보증금', monthly: '보증금', sale: '매매가' };

export function buildRiskInput(form: FormState, asOf: string): BuildResult {
  const errors: string[] = [];

  const amount = parseManwon(form.amountManwon);
  if (!form.amountManwon.trim()) errors.push(`${AMOUNT_LABEL[form.kind]}을(를) 입력하세요.`);
  else if (!amount.ok)
    errors.push(`${AMOUNT_LABEL[form.kind]}은(는) 만원 단위 정수로 입력하세요. (예: 35000 또는 35,000)`);

  const optionalDate = (label: string, value: string): string | undefined => {
    if (!value.trim()) return undefined;
    if (!isValidDate(value)) {
      errors.push(`${label} 날짜 형식이 올바르지 않습니다.`);
      return undefined;
    }
    return value;
  };
  const moveInDate = optionalDate('전입(예정)일', form.moveInDate);
  const fixedDate = optionalDate('확정일자(예정)', form.fixedDate);

  let market: RiskInput['market'];
  if (form.marketManwon.trim()) {
    const m = parseManwon(form.marketManwon);
    if (!m.ok || m.won <= 0) errors.push('시세는 0보다 큰 만원 단위 정수로 입력하세요.');
    else market = { estimatedValue: m.won, source: form.marketSource, confidence: form.marketConfidence };
  }

  let registry: RiskInput['registry'];
  if (form.includeRegistry) {
    const owners = form.owners
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    if (owners.length === 0)
      errors.push('등기부상 소유자 성명을 1명 이상 입력하세요. (공동소유는 쉼표로 구분)');

    const gap: GapEntry[] = GAP_FLAGS.filter((f) => form.gapFlags[f.key]).map((f, i) => ({
      rank: String(i + 1),
      type: f.key,
      cancelled: false,
    }));

    form.transfers.forEach((t, i) => {
      if (!t.registeredAt.trim()) return;
      if (!isValidDate(t.registeredAt)) errors.push(`소유권이전 ${i + 1}번 날짜 형식이 올바르지 않습니다.`);
      else
        gap.push({
          rank: `이전${i + 1}`,
          type: 'ownership_transfer',
          registeredAt: t.registeredAt,
          cancelled: false,
        });
    });

    const eul: EulEntry[] = [];
    form.mortgages.forEach((m, i) => {
      if (!m.amountManwon.trim() && !m.registeredAt.trim()) return; // 빈 행 무시
      const a = parseManwon(m.amountManwon);
      if (!a.ok) {
        errors.push(`근저당 ${i + 1}번 채권최고액은 만원 단위 정수로 입력하세요.`);
        return;
      }
      if (m.registeredAt.trim() && !isValidDate(m.registeredAt)) {
        errors.push(`근저당 ${i + 1}번 설정일 형식이 올바르지 않습니다.`);
        return;
      }
      eul.push({
        rank: String(i + 1),
        type: 'mortgage',
        maxClaimAmount: a.won,
        registeredAt: m.registeredAt.trim() || undefined,
        cancelled: m.cancelled,
      });
    });

    // 직접 입력한 값이므로 파싱 신뢰도는 1로 둔다 (파서 도입 후에는 파서가 산출한 값을 쓴다)
    if (owners.length > 0) registry = { owners, gap, eul, parseConfidence: 1 };
  }

  let statedPriorLoan: number | undefined;
  if (form.statedLoanManwon.trim() && form.kind !== 'sale') {
    const l = parseManwon(form.statedLoanManwon);
    if (!l.ok) errors.push('융자금은 만원 단위 정수로 입력하세요. (없으면 비움)');
    else statedPriorLoan = l.won;
  }

  if (errors.length > 0 || !amount.ok) return { ok: false, errors };

  return {
    ok: true,
    input: {
      asOf,
      contract: {
        kind: form.kind,
        amount: amount.won,
        counterpartyName: form.counterpartyName.trim() || undefined,
        moveInDate,
        fixedDate,
      },
      registry,
      market,
      statedPriorLoan,
      building: form.buildingEntries.length > 0 ? form.buildingEntries : undefined,
      regionCode: /^\d{5}$/.test(form.lookupLawdCd.trim()) ? form.lookupLawdCd.trim() : undefined,
    },
  };
}
