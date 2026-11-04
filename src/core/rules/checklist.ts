import { RULE_VERSION } from './helpers';
import type { Rule } from './helpers';

/**
 * R-TAX-01: 임대인 세금 체납 확인 요청 (체크리스트).
 * 임대인 동의 없이는 조회할 수 없으므로 판정하지 않고 확인 요청으로만 제공한다.
 */
export const taxChecklist: Rule = ({ input }) => ({
  ruleId: 'R-TAX-01',
  ruleVersion: RULE_VERSION,
  status: input.contract.kind === 'sale' ? 'not_applicable' : 'info',
  severity: 'info',
  title: '임대인 국세·지방세 체납 확인 요청',
  evidence: ['임대인 동의 없이는 체납 여부를 조회할 수 없음'],
  action: '임대인에게 국세·지방세 완납(납세) 증명서 제시를 요청하세요.',
});
