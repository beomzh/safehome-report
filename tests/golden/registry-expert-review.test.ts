import { describe, expect, it } from 'vitest';
import { evaluateRisk, parseRegistryText } from '../../src/core';
import { registryToForm } from '../../src/web/registryImport';
import { config, input } from '../helpers/builders';

// LLM 2단계 전문가 검토(docs/expert-review.md)에서 나온 지적을 코드로 확인한 회귀 테스트. 모두 가상 문서다.
const doc = (gap: string, eul: string) =>
  [
    '【 갑   구 】 ( 소유권에 관한 사항 )',
    '순위번호 등 기 목 적 접 수 등 기 원 인 권리자 및 기타사항',
    '1 소유권보존 2012년3월2일',
    '제12345호',
    '소유자 김가상 700101-*******',
    gap,
    '-- 이 하 여 백 --',
    '',
    '【 을   구 】 ( 소유권 이외의 권리에 관한 사항 )',
    '순위번호 등 기 목 적 접 수 등 기 원 인 권리자 및 기타사항',
    eul,
    '-- 이 하 여 백 --',
  ].join('\n');

const parse = (gap: string, eul: string) => {
  const r = parseRegistryText(doc(gap, eul));
  expect(r.ok).toBe(true);
  return { facts: r.facts!, warnings: r.warnings };
};
const ownRule = (facts: ReturnType<typeof parse>['facts']) =>
  evaluateRisk(input({ registry: { ...facts, parseConfidence: 1 } }), config).results.find(
    (x) => x.ruleId === 'R-OWN-03',
  )!;

describe('전세권에 설정한 근저당은 줄바꿈이 없어도 건물의 근저당으로 세지 않는다', () => {
  const { facts } = parse(
    '',
    [
      '1 근저당권설정 2016년5월10일 2016년5월10일 채권최고액 금240,000,000원 근저당권자 가상은행',
      '2 전세권설정 2017년1월1일 2017년1월1일 전세금 금100,000,000원 전세권자 박임시',
      '2-1 2번전세권근저당권설정 2017년2월1일 2017년2월1일 채권최고액 금120,000,000원 근저당권자 임시은행',
    ].join('\n'),
  );
  it('을구 분류', () => {
    expect(facts.eul.map((e) => [e.rank, e.type])).toEqual([
      ['1', 'mortgage'],
      ['2', 'lease_right'],
      ['2-1', 'other'],
    ]);
  });
});

describe('말소회복 등기는 말소를 되돌린다', () => {
  const eul = [
    '1 근저당권설정 2016년5월10일 2016년5월10일 채권최고액 금240,000,000원 근저당권자 가상은행',
    '2 1번근저당권설정등기말소 2018년1월5일 2018년1월4일 해지',
    '3 1번근저당권설정등기말소회복 2019년2월7일 2019년2월6일 확정판결',
  ].join('\n');
  it('말소 후 회복되면 근저당이 다시 유효하고 경고한다', () => {
    const { facts, warnings } = parse('', eul);
    expect(facts.eul.filter((e) => e.type === 'mortgage').map((e) => [e.rank, e.cancelled])).toEqual([
      ['1', false],
    ]);
    expect(warnings.join(' ')).toContain('말소회복');
    expect(facts.parseConfidence).toBeLessThan(1);
  });
  it('회복 없이 말소만 있으면 말소로 센다 (기존 동작)', () => {
    const { facts, warnings } = parse('', eul.split('\n').slice(0, 2).join('\n'));
    expect(facts.eul.find((e) => e.type === 'mortgage')?.cancelled).toBe(true);
    expect(warnings.join(' ')).not.toContain('말소회복');
  });
});

describe('공유지분 일부만 이전된 등기', () => {
  it('남은 공동소유자를 알 수 없다고 경고하고 신뢰도를 낮춘다', () => {
    const { facts, warnings } = parse(
      ['2 공유자지분이전 2020년1월1일 2019년12월1일 매매', '공유자 지분 2분의 1 박가상 800808-*******'].join(
        '\n',
      ),
      '',
    );
    expect(warnings.join(' ')).toContain('공유지분 일부');
    expect(facts.parseConfidence).toBeLessThanOrEqual(0.7);
  });
  it('지분 전부 이전이면 경고하지 않는다', () => {
    const { warnings } = parse(
      ['2 공유자전원지분전부이전 2020년1월1일 2019년12월1일 매매', '소유자 박가상 800808-*******'].join('\n'),
      '',
    );
    expect(warnings.join(' ')).not.toContain('공유지분 일부');
  });
});

describe('가등기는 위험 신호', () => {
  const { facts } = parse(
    ['2 소유권이전청구권가등기 2019년3월3일 2019년3월1일 매매예약', '가등기권자 최가등 900101-*******'].join(
      '\n',
    ),
    '',
  );
  it('갑구의 미말소 가등기를 provisional_registration 으로 읽는다', () => {
    expect(facts.gap.find((g) => g.type === 'provisional_registration')?.cancelled).toBe(false);
  });
  it('입력칸 체크로 옮기고 권리 제한 룰이 위험으로 알린다', () => {
    expect(registryToForm(facts).patch.gapFlags.provisional_registration).toBe(true);
    const r = ownRule(facts);
    expect([r.status, r.severity]).toEqual(['triggered', 'red']);
    expect(r.evidence.join(' ')).toContain('가등기');
  });
  it('가등기말소가 있으면 말소로 센다', () => {
    const cancelled = parse(
      [
        '2 소유권이전청구권가등기 2019년3월3일 2019년3월1일 매매예약',
        '3 2번가등기말소 2020년4월4일 2020년4월3일 해지',
      ].join('\n'),
      '',
    );
    expect(cancelled.facts.gap.find((g) => g.type === 'provisional_registration')?.cancelled).toBe(true);
  });
});

describe('을구의 주택임차권(임차권등기명령)', () => {
  const { facts } = parse(
    '',
    '1 주택임차권 2021년5월3일 2021년4월20일 임차보증금 금100,000,000원 임차권자 박임차',
  );
  it('lease_registration 으로 읽고 권리 제한 룰이 위험으로 알린다', () => {
    expect(facts.eul[0]?.type).toBe('lease_registration');
    const r = ownRule(facts);
    expect([r.status, r.severity]).toEqual(['triggered', 'red']);
    expect(r.evidence.join(' ')).toContain('을구');
  });
  it('입력칸에서는 임차권등기명령 체크로 옮긴다', () => {
    expect(registryToForm(facts).patch.gapFlags.lease_registration_order).toBe(true);
  });
  it('말소된 임차권은 위험으로 보지 않는다', () => {
    const c = parse(
      '',
      [
        '1 주택임차권 2021년5월3일 2021년4월20일 임차보증금 금100,000,000원',
        '2 1번임차권등기말소 2022년1월1일 2021년12월30일 해제',
      ].join('\n'),
    );
    expect(ownRule(c.facts).status).toBe('clear');
  });
});

describe('을구 내용이 빠진 문서', () => {
  it('행도 "기록사항 없음"도 없으면 경고하고 신뢰도를 낮춘다', () => {
    const { facts, warnings } = parse('', '');
    expect(warnings.join(' ')).toContain('기록사항 없음');
    expect(facts.parseConfidence).toBeLessThan(1);
  });
  it('"기록사항 없음"이 있으면 정상', () => {
    const { facts, warnings } = parse('', '기록사항 없음');
    expect(warnings.join(' ')).not.toContain('기록사항 없음');
    expect(facts.parseConfidence).toBe(1);
  });
});
