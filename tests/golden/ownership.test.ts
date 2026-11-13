import { describe, expect, it } from 'vitest';
import { evaluateRisk } from '../../src/core';
import { config, gap, input, registry } from '../helpers/builders';

const result = (ruleId: string, raw = input()) =>
  evaluateRisk(raw, config).results.find((r) => r.ruleId === ruleId)!;

describe('R-OWN-01 임대인-소유자 일치', () => {
  it('성명이 다르면 red', () => {
    const r = result('R-OWN-01', input({ registry: registry({ owners: [{ name: '김철수' }] }) }));
    expect(r.status).toBe('triggered');
    expect(r.severity).toBe('red');
  });

  it('공백·유니코드 정규화 후 일치하면 clear', () => {
    const r = result('R-OWN-01', input({ registry: registry({ owners: [{ name: '홍 길동' }] }) }));
    expect(r.status).toBe('clear');
  });

  it('공동소유이고 상대방이 그중 1인이면 yellow', () => {
    const r = result(
      'R-OWN-01',
      input({ registry: registry({ owners: [{ name: '홍길동' }, { name: '김영희' }] }) }),
    );
    expect(r.status).toBe('triggered');
    expect(r.severity).toBe('yellow');
  });

  it('상대방 성명 미입력이면 판단 보류', () => {
    const base = input();
    const r = result('R-OWN-01', input({ contract: { ...base.contract, counterpartyName: undefined } }));
    expect(r.status).toBe('unknown');
  });

  it('등기부 없으면 판단 보류', () => {
    expect(result('R-OWN-01', input({ registry: undefined })).status).toBe('unknown');
  });

  it('파싱 신뢰도가 기준 미만이면 판단 보류', () => {
    const r = result('R-OWN-01', input({ registry: registry({ parseConfidence: 0.5 }) }));
    expect(r.status).toBe('unknown');
  });
});

describe('R-OWN-02 신탁', () => {
  it('미말소 신탁이 있으면 red', () => {
    const r = result('R-OWN-02', input({ registry: registry({ gap: [gap({ rank: '3', type: 'trust' })] }) }));
    expect(r.status).toBe('triggered');
    expect(r.severity).toBe('red');
  });

  it('동의서가 있어도 계약 권한 범위·보증금 수령 계좌·반환 책임은 따로 확인하라고 안내한다', () => {
    const r = result('R-OWN-02', input({ registry: registry({ gap: [gap({ rank: '3', type: 'trust' })] }) }));
    expect(r.action).toContain('보증금 반환 책임');
    expect(r.action).toContain('수령 계좌');
  });

  it('말소된 신탁은 무시한다', () => {
    const r = result(
      'R-OWN-02',
      input({ registry: registry({ gap: [gap({ type: 'trust', cancelled: true })] }) }),
    );
    expect(r.status).toBe('clear');
  });
});

describe('R-OWN-03 권리 제한', () => {
  it.each([
    'seizure',
    'provisional_seizure',
    'provisional_disposition',
    'auction_start',
    'lease_registration_order',
  ] as const)('%s 미말소 → red', (type) => {
    const r = result('R-OWN-03', input({ registry: registry({ gap: [gap({ type })] }) }));
    expect(r.status).toBe('triggered');
    expect(r.severity).toBe('red');
  });

  it('말소된 압류는 무시한다', () => {
    const r = result(
      'R-OWN-03',
      input({ registry: registry({ gap: [gap({ type: 'seizure', cancelled: true })] }) }),
    );
    expect(r.status).toBe('clear');
  });
});

describe('R-OWN-04 잦은 소유권 이전', () => {
  const transfer = (registeredAt: string) => gap({ type: 'ownership_transfer', registeredAt });

  it('24개월 내 3건 이상이면 yellow', () => {
    const r = result(
      'R-OWN-04',
      input({
        registry: registry({ gap: [transfer('2025-01-10'), transfer('2025-06-10'), transfer('2026-03-10')] }),
      }),
    );
    expect(r.status).toBe('triggered');
    expect(r.severity).toBe('yellow');
  });

  it('기간 밖 이전은 세지 않는다', () => {
    const r = result(
      'R-OWN-04',
      input({
        registry: registry({ gap: [transfer('2015-01-10'), transfer('2016-06-10'), transfer('2026-03-10')] }),
      }),
    );
    expect(r.status).toBe('clear');
  });
});
