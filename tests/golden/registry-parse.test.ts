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

  it('현재 유효사항 형식(공유자전원지분전부이전, 을구 기록사항 없음)을 읽는다', () => {
    const r = parseRegistryText(fixture('synthetic-current-valid.txt'));
    expect(r.ok).toBe(true);
    const f = r.facts!;
    expect(f.owners).toEqual([{ name: '홍가상' }]);
    expect(f.gap.map((e) => e.type)).toEqual(['ownership_transfer']);
    expect(f.gap[0]!.registeredAt).toBe('2024-06-28');
    expect(f.eul).toEqual([]);
    expect(f.parseConfidence).toBe(1);
  });
});

describe('parseRegistryText (실제 열람본의 레이아웃 특성을 따른 합성 문서)', () => {
  // 실제 열람본(PDF 텍스트, 레이아웃 유지)에서 확인한 형식: 말소 행의 목적란이 줄바꿈되어 '말소'가 접수일 뒤에 오고,
  // 공동담보·주소의 "12-34 …" 줄이 순위번호처럼 보이며, 명의인표시변경 부기등기와 전세권 근저당이 섞여 있다.
  const r = parseRegistryText(fixture('synthetic-layout.txt'));
  const f = r.facts!;

  it('줄바꿈된 말소 행도 인식해 말소된 근저당을 제외한다', () => {
    const m = f.eul.filter((e) => e.type === 'mortgage');
    expect(m.map((e) => [e.rank, e.maxClaimAmount, e.cancelled])).toEqual([
      ['1', 240_000_000, true],
      ['3', 360_000_000, false],
    ]);
  });

  it('주소·공동담보의 "12-34" 줄을 순위로 오인하지 않는다', () => {
    expect(f.eul.map((e) => e.rank)).toEqual(['1', '3', '4', '4-1']);
    expect(f.gap.map((e) => e.rank)).toEqual(['1', '2', '3']);
  });

  it('명의인표시변경은 소유권 변동이 아니라 경고 없이 무시하고, 현재 소유자는 마지막 이전의 권리자', () => {
    expect(f.owners).toEqual([{ name: '이샘플' }]);
    expect(f.gap.filter((e) => e.type === 'ownership_transfer')).toHaveLength(2);
    expect(r.warnings).toEqual([]);
    expect(f.parseConfidence).toBe(1);
  });

  it('전세권 위의 근저당(4-1)은 건물의 선순위 채권으로 합산하지 않는다', () => {
    const e = f.eul.find((x) => x.rank === '4-1')!;
    expect(e.type).toBe('other');
    const sum = f.eul
      .filter((x) => x.type === 'mortgage' && !x.cancelled)
      .reduce((a, x) => a + (x.maxClaimAmount ?? 0), 0);
    expect(sum).toBe(360_000_000);
    expect(f.eul.find((x) => x.rank === '4')).toMatchObject({
      type: 'lease_right',
      maxClaimAmount: 100_000_000,
    });
  });
});
