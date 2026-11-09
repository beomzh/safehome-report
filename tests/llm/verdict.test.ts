import { describe, expect, it } from 'vitest';
import {
  buildVerdictInput,
  explainVerdict,
  sanitizeVerdict,
  verdictRequestSchema,
} from '../../src/adapters/llm/verdict';
import type { RawVerdict } from '../../src/adapters/llm/verdict';
import type { LlmProvider } from '../../src/adapters/llm/provider';

const req = verdictRequestSchema.parse({
  kind: 'jeonse',
  verdict: 'avoid',
  criteria: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map((id, i) => ({
    id,
    title: `기준 ${id}`,
    status: i === 3 ? 'fail' : 'pass',
    rule: '기준',
    facts: i === 3 ? '보증금/시세 85%' : '충족',
  })),
});

const raw = (over: Partial<RawVerdict> = {}): RawVerdict => ({
  summary: 'C4 보증금/시세 85% 때문에 방문을 권하지 않습니다.',
  perCriterion: [{ id: 'C4', comment: '보증금/시세가 85%로 기준을 넘습니다.' }],
  conditions: [],
  nextActions: ['HUG 보증 가입 가능 여부를 확인하세요.'],
  disagreement: null,
  ...over,
});

describe('AI 해석 (기준표 결론 위에서)', () => {
  const input = buildVerdictInput(req);

  it('입력에 금액·성명이 없고 기준 상태·사실만 있다', () => {
    expect(input).toContain('<verdict>보러 가지 않음 권장</verdict>');
    expect(input).toContain('C4 기준 C4 | 상태: 미달 | 사실: 보증금/시세 85%');
    expect(input).not.toMatch(/원|만원/);
  });

  it('입력에 있는 숫자는 통과한다', () => {
    const r = sanitizeVerdict(raw(), input);
    expect(r.summary).toContain('85%');
    expect(r.droppedForNumbers).toBe(0);
  });

  it('입력에 없는 숫자가 든 문장은 버린다 (LLM 이 만든 한도·금액 차단)', () => {
    const r = sanitizeVerdict(
      raw({
        summary: '대출 한도는 3억 2천만원 입니다.',
        nextActions: ['DSR 한도 40% 를 확인하세요.', '은행 상담'],
      }),
      input,
    );
    expect(r.summary).toBe('');
    expect(r.nextActions).toEqual(['은행 상담']);
    expect(r.droppedForNumbers).toBe(2);
  });

  it('알 수 없는 기준 id 의 해석은 버리고 이견은 별도로 보존한다', () => {
    const r = sanitizeVerdict(
      raw({
        perCriterion: [{ id: 'C9', comment: '무시' }],
        disagreement: 'C4 외 다른 이유는 없어 보입니다.',
      }),
      input,
    );
    expect(r.perCriterion).toEqual([]);
    expect(r.disagreement).toBe('C4 외 다른 이유는 없어 보입니다.');
  });

  it('explainVerdict 는 결론을 바꾸지 않고 해석만 돌려준다', async () => {
    const provider: LlmProvider = { name: 'fake', generate: (async () => raw()) as LlmProvider['generate'] };
    const r = await explainVerdict(provider, req);
    expect(Object.keys(r)).not.toContain('verdict');
    expect(r.nextActions).toHaveLength(1);
  });

  it('요청 스키마는 기준 6개가 아니면 거부한다', () => {
    expect(verdictRequestSchema.safeParse({ ...req, criteria: req.criteria.slice(0, 3) }).success).toBe(
      false,
    );
  });
});
