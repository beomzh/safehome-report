import { z } from 'zod';

/**
 * 금액은 "원 단위 정수"로만 다룬다 (ADR-0004). 부동소수점 금액 금지.
 * 비율(%)은 표시·임계치 비교용으로만 계산하며 금액에 되먹이지 않는다.
 */
export const wonSchema = z
  .number()
  .int()
  .nonnegative()
  .refine(Number.isSafeInteger, 'safe integer 범위 초과');
export type Won = z.infer<typeof wonSchema>;

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 한다');

// ---- 등기부 facts (파서 출력, M2) -------------------------------------------------

export const gapEntryTypeSchema = z.enum([
  'ownership_transfer', // 소유권이전
  'trust', // 신탁
  'seizure', // 압류
  'provisional_seizure', // 가압류
  'provisional_disposition', // 가처분
  'auction_start', // 경매개시결정
  'lease_registration_order', // 임차권등기명령
  'other',
]);
export type GapEntryType = z.infer<typeof gapEntryTypeSchema>;

export const gapEntrySchema = z.object({
  rank: z.string().min(1),
  type: gapEntryTypeSchema,
  registeredAt: isoDateSchema.optional(),
  /** 말소된 항목은 활성 권리에서 제외된다 */
  cancelled: z.boolean(),
});
export type GapEntry = z.infer<typeof gapEntrySchema>;

export const eulEntrySchema = z.object({
  rank: z.string().min(1),
  type: z.enum(['mortgage', 'lease_right', 'other']),
  maxClaimAmount: wonSchema.optional(),
  registeredAt: isoDateSchema.optional(),
  cancelled: z.boolean(),
});
export type EulEntry = z.infer<typeof eulEntrySchema>;

export const registrySchema = z.object({
  /** 현재 소유자 (성명은 로컬에서만 사용, LLM·로그 전송 금지) */
  owners: z.array(z.object({ name: z.string().min(1) })),
  gap: z.array(gapEntrySchema),
  eul: z.array(eulEntrySchema),
  /** 파싱 신뢰도 0~1 */
  parseConfidence: z.number().min(0).max(1),
});
export type RegistryFacts = z.infer<typeof registrySchema>;

// ---- 계약·시세 입력 --------------------------------------------------------------

export const contractSchema = z.object({
  kind: z.enum(['jeonse', 'monthly', 'sale']),
  /** 전세·월세는 보증금, 매매는 매매가 */
  amount: wonSchema,
  /** 계약 상대방(임대인/매도인) 성명 — 로컬에서만 사용 */
  counterpartyName: z.string().optional(),
  moveInDate: isoDateSchema.optional(),
  fixedDate: isoDateSchema.optional(),
});
export type ContractInfo = z.infer<typeof contractSchema>;

export const marketSchema = z.object({
  estimatedValue: z.number().int().positive().refine(Number.isSafeInteger),
  source: z.enum(['user', 'trade_median', 'official_price']),
  confidence: z.enum(['high', 'low']),
});
export type MarketInfo = z.infer<typeof marketSchema>;

export const riskInputSchema = z.object({
  /** 판정 기준일. 결정성을 위해 호출자가 주입한다 (내부에서 현재 시각을 읽지 않는다) */
  asOf: isoDateSchema,
  contract: contractSchema,
  registry: registrySchema.optional(),
  market: marketSchema.optional(),
  /**
   * 매물 설명에 적힌 융자금(원). 등기부로 확인되지 않은 광고 문구라 사전 점검(R-RATIO-01)의
   * 하한값 계산에만 쓰고, 등기부 정보가 있으면 무시한다. 채권최고액으로 환산하지 않는다.
   */
  statedPriorLoan: wonSchema.optional(),
});
export type RiskInput = z.infer<typeof riskInputSchema>;

// ---- 룰 결과 ---------------------------------------------------------------------

/**
 * triggered: 위험 신호 탐지 / clear: 신호 없음 / unknown: 입력 부족·신뢰도 낮음(판단 보류)
 * not_applicable: 해당 계약 유형에 적용 안 됨 / info: 판정이 아닌 정보·체크리스트
 */
export type RuleStatus = 'triggered' | 'clear' | 'unknown' | 'not_applicable' | 'info';
export type Severity = 'red' | 'yellow' | 'info';

export interface RuleResult {
  ruleId: string;
  ruleVersion: number;
  status: RuleStatus;
  severity: Severity;
  title: string;
  evidence: string[];
  action?: string;
  data?: Record<string, number | string>;
}

/** inconclusive = 판단 보류 (Green 아님) */
export type Grade = 'red' | 'yellow' | 'green' | 'inconclusive';

export interface RiskReport {
  rulesetVersion: number;
  asOf: string;
  grade: Grade;
  results: RuleResult[];
}
