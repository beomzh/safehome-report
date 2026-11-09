import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRegistryText } from '../../src/core';
import { evaluateRisk } from '../../src/core';
import { config, input } from '../helpers/builders';

const fixture = (n: string) => readFileSync(new URL(`../fixtures/registry/${n}`, import.meta.url), 'utf8');

describe('parseRegistryText (합성 문서)', () => {
  it('깨끗한 등기부: 소유자, 이전 2건, 말소된 근저당 + 유효 근저당', () => {
    const r = parseRegistryText(fixture('synthetic-clean.txt'));
    expect(r.ok).toBe(true);
    const f = r.facts!;
    expect(f.owners).toEqual([{ name: '박가상' }]);
    expect(f.gap.filter((e) => e.type === 'ownership_transfer').map((e) => e.registeredAt)).toEqual([
      '2016-05-10',
      '2021-09-15',
    ]);
    expect(f.eul).toEqual([
      {
        rank: '1',
        type: 'mortgage',
        maxClaimAmount: 240_000_000,
        registeredAt: '2016-05-10',
        cancelled: true,
      },
      {
        rank: '3',
        type: 'mortgage',
        maxClaimAmount: 360_000_000,
        registeredAt: '2021-09-15',
        cancelled: false,
      },
    ]);
    expect(f.parseConfidence).toBe(1);
    expect(r.warnings).toEqual([]);
  });

  it('위험 등기부: 가압류는 말소, 압류·가처분은 유효, 변경등기는 경고', () => {
    const r = parseRegistryText(fixture('synthetic-risky.txt'));
    const f = r.facts!;
    const byType = (t: string) => f.gap.filter((e) => e.type === t);
    expect(byType('provisional_seizure')[0]!.cancelled).toBe(true);
    expect(byType('seizure')[0]!.cancelled).toBe(false);
    expect(byType('provisional_disposition')[0]!.cancelled).toBe(false);
    expect(r.warnings.some((w) => w.includes('변경'))).toBe(true);
    expect(f.parseConfidence).toBeLessThan(1);
    const report = evaluateRisk(
      input({ registry: f, contract: { kind: 'sale', amount: 500_000_000, counterpartyName: '박가상' } }),
      config,
    );
    expect(report.grade).toBe('red');
  });

  it('신탁: 수탁자를 소유자로 보고 경고한다', () => {
    const r = parseRegistryText(fixture('synthetic-trust.txt'));
    const f = r.facts!;
    expect(f.gap.some((e) => e.type === 'trust' && !e.cancelled)).toBe(true);
    expect(f.owners).toEqual([{ name: '주식회사예시신탁' }]);
    expect(r.warnings.some((w) => w.includes('신탁'))).toBe(true);
  });

  it('갑구가 없으면 실패한다', () => {
    const r = parseRegistryText('아무 내용');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('갑구');
  });

  it('주민등록번호 원문은 결과에 담기지 않는다', () => {
    const r = parseRegistryText(fixture('synthetic-clean.txt'));
    expect(JSON.stringify(r)).not.toMatch(/\d{6}-/);
  });
});
