import { activeGap, monthsBetween, normalizeName, RULE_VERSION, unknownResult, useRegistry } from './helpers';
import type { Rule } from './helpers';
import type { GapEntryType } from '../types';

/** R-OWN-01: 계약 상대방과 등기상 소유자 불일치 (가장 흔한 사기 패턴) */
export const ownerMismatch: Rule = (ctx) => {
  const id = 'R-OWN-01';
  const title = '임대인(매도인)과 등기상 소유자 일치 여부';
  const reg = useRegistry(ctx);
  if (!reg.ok) return unknownResult(id, title, reg.reason);
  const counterparty = ctx.input.contract.counterpartyName;
  if (!counterparty?.trim()) return unknownResult(id, title, '계약 상대방 성명 미입력');
  if (reg.registry.owners.length === 0) return unknownResult(id, title, '등기부에서 소유자를 인식하지 못함');

  const target = normalizeName(counterparty);
  const matches = reg.registry.owners.some((o) => normalizeName(o.name) === target);
  const base = { ruleId: id, ruleVersion: RULE_VERSION, title };

  if (!matches) {
    return {
      ...base,
      status: 'triggered',
      severity: 'red',
      evidence: ['계약 상대방 성명이 등기부상 소유자와 일치하지 않음'],
      action: '계약 전 소유자 본인 확인(신분증·위임 서류)과 대리 계약 여부를 반드시 확인하세요.',
    };
  }
  if (reg.registry.owners.length > 1) {
    return {
      ...base,
      status: 'triggered',
      severity: 'yellow',
      evidence: ['공동 소유 매물: 계약 상대방은 소유자 중 1인'],
      action: '다른 공동 소유자의 동의 여부와 지분 관계를 확인하세요.',
    };
  }
  return { ...base, status: 'clear', severity: 'red', evidence: ['계약 상대방이 등기상 소유자와 일치'] };
};

/** R-OWN-02: 신탁등기 (미말소) */
export const trustRegistered: Rule = (ctx) => {
  const id = 'R-OWN-02';
  const title = '신탁등기 여부';
  const reg = useRegistry(ctx);
  if (!reg.ok) return unknownResult(id, title, reg.reason);
  const hits = activeGap(reg.registry).filter((e) => e.type === 'trust');
  const base = { ruleId: id, ruleVersion: RULE_VERSION, title, severity: 'red' as const };
  if (hits.length === 0) return { ...base, status: 'clear', evidence: ['미말소 신탁등기 없음'] };
  return {
    ...base,
    status: 'triggered',
    evidence: hits.map((h) => `갑구 순위 ${h.rank}: 신탁등기 (미말소)`),
    action: '신탁원부를 확인하고 수탁자(신탁회사)의 임대·매매 동의서가 있는지 확인하세요.',
  };
};

const RESTRICTION_LABEL: Partial<Record<GapEntryType, string>> = {
  seizure: '압류',
  provisional_seizure: '가압류',
  provisional_disposition: '가처분',
  auction_start: '경매개시결정',
  lease_registration_order: '임차권등기명령',
};

/** R-OWN-03: 권리 제한 (압류·가압류·가처분·경매개시결정·임차권등기명령, 미말소) */
export const rightsRestriction: Rule = (ctx) => {
  const id = 'R-OWN-03';
  const title = '소유권 권리 제한(압류·가압류·가처분·경매 등) 여부';
  const reg = useRegistry(ctx);
  if (!reg.ok) return unknownResult(id, title, reg.reason);
  const hits = activeGap(reg.registry).filter((e) => e.type in RESTRICTION_LABEL);
  const base = { ruleId: id, ruleVersion: RULE_VERSION, title, severity: 'red' as const };
  if (hits.length === 0) return { ...base, status: 'clear', evidence: ['미말소 권리 제한 없음'] };
  return {
    ...base,
    status: 'triggered',
    evidence: hits.map((h) => `갑구 순위 ${h.rank}: ${RESTRICTION_LABEL[h.type]} (미말소)`),
    action: '계약을 진행하기 전에 해당 등기의 원인과 해소 가능성을 법무사·변호사와 확인하세요.',
  };
};

/** R-OWN-04: 단기간 잦은 소유권 이전 */
export const frequentTransfer: Rule = (ctx) => {
  const id = 'R-OWN-04';
  const title = '단기간 잦은 소유권 이전';
  const reg = useRegistry(ctx);
  if (!reg.ok) return unknownResult(id, title, reg.reason, 'yellow');
  const { windowMonths, minCount } = ctx.config.frequentTransfer;
  const recent = reg.registry.gap.filter((e) => {
    if (e.type !== 'ownership_transfer' || !e.registeredAt) return false;
    const m = monthsBetween(e.registeredAt, ctx.input.asOf);
    return m >= 0 && m <= windowMonths;
  });
  const base = { ruleId: id, ruleVersion: RULE_VERSION, title, severity: 'yellow' as const };
  if (recent.length < minCount) {
    return {
      ...base,
      status: 'clear',
      evidence: [`최근 ${windowMonths}개월 소유권 이전 ${recent.length}건`],
    };
  }
  return {
    ...base,
    status: 'triggered',
    evidence: [`최근 ${windowMonths}개월 내 소유권 이전 ${recent.length}건 (기준 ${minCount}건 이상)`],
    action: '이전 사유(매매·증여 등)와 거래가격을 실거래 내역과 대조해 보세요.',
  };
};
