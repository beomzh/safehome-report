import { loadRulesConfig } from '../../src/adapters/config/loadRulesConfig';
import type { EulEntry, GapEntry, RegistryFacts, RiskInput } from '../../src/core';

export const config = loadRulesConfig();

export const gap = (over: Partial<GapEntry> = {}): GapEntry => ({
  rank: '1',
  type: 'other',
  cancelled: false,
  ...over,
});

export const mortgage = (over: Partial<EulEntry> = {}): EulEntry => ({
  rank: '1',
  type: 'mortgage',
  maxClaimAmount: 100_000_000,
  registeredAt: '2020-01-01',
  cancelled: false,
  ...over,
});

export const registry = (over: Partial<RegistryFacts> = {}): RegistryFacts => ({
  owners: [{ name: '홍길동' }],
  gap: [],
  eul: [],
  parseConfidence: 0.95,
  ...over,
});

/** 기본: 전세 3억, 시세 5억, 깨끗한 등기부, 소유자=계약 상대방 → 모든 룰 clear 인 입력 */
export const input = (over: Partial<RiskInput> = {}): RiskInput => ({
  asOf: '2026-11-04',
  contract: {
    kind: 'jeonse',
    amount: 300_000_000,
    counterpartyName: '홍길동',
    moveInDate: '2026-12-01',
    fixedDate: '2026-12-01',
  },
  registry: registry(),
  market: { estimatedValue: 500_000_000, source: 'user', confidence: 'high' },
  ...over,
});
