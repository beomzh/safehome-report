import { describe, expect, it } from 'vitest';
import { classifyPurpose, evaluateRisk } from '../../src/core';
import { config, input } from '../helpers/builders';

const run = (building?: { label: string; mainPurpose: string; etcPurpose?: string }[]) => {
  const r = evaluateRisk({ ...input({ registry: undefined }), building }, config);
  return { report: r, rule: r.results.find((x) => x.ruleId === 'R-BLD-02')! };
};

describe('classifyPurpose', () => {
  it('주용도로 주거·근생·업무·기타를 나눈다', () => {
    expect(classifyPurpose({ label: 'a', mainPurpose: '공동주택', etcPurpose: '아파트' })).toBe(
      'residential',
    );
    expect(classifyPurpose({ label: 'a', mainPurpose: '단독주택', etcPurpose: '다가구주택' })).toBe(
      'residential',
    );
    expect(classifyPurpose({ label: 'a', mainPurpose: '제1종근린생활시설' })).toBe('neighborhood');
    expect(classifyPurpose({ label: 'a', mainPurpose: '업무시설', etcPurpose: '오피스텔' })).toBe('office');
    expect(classifyPurpose({ label: 'a', mainPurpose: '숙박시설' })).toBe('other');
  });
});

describe('R-BLD-02 건축물대장 용도', () => {
  it('정보가 없으면 판단 보류지만 종합 등급에는 영향이 없다', () => {
    const { rule, report } = run(undefined);
    expect([rule.status, rule.severity]).toEqual(['unknown', 'info']);
    const without = evaluateRisk({ ...input({ registry: undefined }), market: undefined }, config);
    expect(report.grade).toBe(without.grade);
  });

  it('주거용이면 clear', () => {
    expect(
      run([{ label: '가나다빌라', mainPurpose: '공동주택', etcPurpose: '다세대주택' }]).rule.status,
    ).toBe('clear');
  });

  it('근린생활시설만 있으면 red 이고 종합 등급도 red', () => {
    const { rule, report } = run([{ label: '근생건물', mainPurpose: '제2종근린생활시설' }]);
    expect([rule.status, rule.severity]).toEqual(['triggered', 'red']);
    expect(report.grade).toBe('red');
  });

  it('주거와 근생이 섞여 있으면 yellow', () => {
    const { rule } = run([
      { label: '본동', mainPurpose: '공동주택' },
      { label: '상가동', mainPurpose: '제1종근린생활시설' },
    ]);
    expect([rule.status, rule.severity]).toEqual(['triggered', 'yellow']);
  });

  it('오피스텔(업무시설)은 정보로만 알린다', () => {
    const { rule } = run([{ label: '타워', mainPurpose: '업무시설', etcPurpose: '오피스텔' }]);
    expect([rule.status, rule.severity]).toEqual(['info', 'info']);
  });

  it('주택이 아닌 기타 용도는 yellow', () => {
    expect(run([{ label: '모텔', mainPurpose: '숙박시설' }]).rule.severity).toBe('yellow');
  });
});
