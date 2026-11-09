import type { RegistryFacts } from '../core';
import { GAP_FLAGS } from './form';
import type { FormState } from './form';

const MANWON = 10_000;

/**
 * 파서 결과를 입력 폼 값으로 옮긴다. 결과는 사용자가 화면에서 확인·수정한 뒤 분석에 쓰인다.
 * 만원 단위로 나누어떨어지지 않는 금액은 올림(위험을 작게 보지 않도록)하고 경고를 남긴다.
 */
export function registryToForm(facts: RegistryFacts): {
  patch: Pick<FormState, 'includeRegistry' | 'owners' | 'gapFlags' | 'mortgages' | 'transfers'>;
  warnings: string[];
} {
  const warnings: string[] = [];
  const gapFlags = Object.fromEntries(
    GAP_FLAGS.map((f) => [f.key, facts.gap.some((e) => e.type === f.key && !e.cancelled)]),
  ) as FormState['gapFlags'];

  const transfers = facts.gap
    .filter((e) => e.type === 'ownership_transfer' && !e.cancelled && e.registeredAt)
    .map((e) => ({ registeredAt: e.registeredAt! }));

  const mortgages = facts.eul
    .filter((e) => e.type === 'mortgage')
    .map((e) => {
      let amountManwon = '';
      if (e.maxClaimAmount !== undefined) {
        const m = Math.ceil(e.maxClaimAmount / MANWON);
        if (e.maxClaimAmount % MANWON !== 0)
          warnings.push(`을구 순위 ${e.rank}: 채권최고액이 만원 단위가 아니어서 올림했습니다.`);
        amountManwon = String(m);
      }
      return { amountManwon, registeredAt: e.registeredAt ?? '', cancelled: e.cancelled };
    });

  const lease = facts.eul.filter((e) => e.type === 'lease_right' && !e.cancelled);
  if (lease.length > 0)
    warnings.push(
      `을구에 전세권·임차권이 ${lease.length}건 있습니다. 선순위 보증금은 이 도구가 계산하지 않으니 원문에서 확인하세요.`,
    );

  return {
    patch: {
      includeRegistry: true,
      owners: facts.owners.map((o) => o.name).join(', '),
      gapFlags,
      mortgages,
      transfers,
    },
    warnings,
  };
}
