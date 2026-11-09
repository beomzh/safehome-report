import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRegistryText } from '../../src/core';
import { buildRiskInput, emptyForm } from '../../src/web/form';
import { registryToForm } from '../../src/web/registryImport';

const fixture = (n: string) => readFileSync(new URL(`../fixtures/registry/${n}`, import.meta.url), 'utf8');

describe('registryToForm', () => {
  it('파서 결과가 폼에 들어가고 buildRiskInput 을 통과한다', () => {
    const facts = parseRegistryText(fixture('synthetic-clean.txt')).facts!;
    const { patch, warnings } = registryToForm(facts);
    expect(patch.owners).toBe('박가상');
    expect(patch.mortgages).toEqual([
      { amountManwon: '24000', registeredAt: '2016-05-10', cancelled: true },
      { amountManwon: '36000', registeredAt: '2021-09-15', cancelled: false },
    ]);
    expect(patch.transfers).toHaveLength(2);
    expect(warnings).toEqual([]);
    const r = buildRiskInput(
      { ...emptyForm(), amountManwon: '30000', counterpartyName: '박가상', ...patch },
      '2026-11-09',
    );
    expect(r.ok).toBe(true);
  });

  it('만원 단위가 아닌 채권최고액은 올림하고 경고한다', () => {
    const { patch, warnings } = registryToForm({
      owners: [{ name: '홍길동' }],
      gap: [],
      eul: [{ rank: '1', type: 'mortgage', maxClaimAmount: 12_345_678, cancelled: false }],
      parseConfidence: 1,
    });
    expect(patch.mortgages[0]!.amountManwon).toBe('1235');
    expect(warnings).toHaveLength(1);
  });
});
