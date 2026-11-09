import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createOpenAiCompatibleProvider } from '../../src/adapters/llm/openaiCompatible';
import { createTradeService } from '../../src/adapters/public-data/tradeService';

const okXml =
  '<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items></items><totalCount>0</totalCount></body></response>';

describe('어댑터 운영 로그 훅', () => {
  it('공공 API 재시도와 캐시 적중을 로그 훅으로 알린다 (키·URL 미포함)', async () => {
    const events: { level: string; event: string; fields: Record<string, unknown> }[] = [];
    let calls = 0;
    const fetchFn = (async () => {
      calls += 1;
      return calls === 1 ? new Response('x', { status: 500 }) : new Response(okXml);
    }) as unknown as typeof fetch;
    const s = createTradeService({
      apiKey: 'SECRET-KEY-VALUE',
      fetchFn,
      log: (level, event, fields) => events.push({ level, event, fields }),
    });
    await s.fetchMonth('11680', '202610');
    await s.fetchMonth('11680', '202610');

    expect(events.map((e) => e.event)).toEqual([
      'public_data_retry',
      'public_data_month_loaded',
      'public_data_cache_hit',
    ]);
    expect(events[0]).toMatchObject({ level: 'warn', fields: { month: '202610', attempt: 1, code: 'none' } });
    expect(JSON.stringify(events)).not.toMatch(/SECRET-KEY-VALUE|apis\.data\.go\.kr/);
  });

  it('LLM 재시도를 로그 훅으로 알린다 (주소·키·모델명 미포함)', async () => {
    const events: { event: string; fields: Record<string, unknown> }[] = [];
    let calls = 0;
    const fetchFn = (async () => {
      calls += 1;
      return calls === 1
        ? new Response('x', { status: 503 })
        : new Response(
            JSON.stringify({
              status: 'completed',
              output: [{ type: 'message', content: [{ type: 'output_text', text: '{"a":"b"}' }] }],
            }),
          );
    }) as unknown as typeof fetch;
    const provider = createOpenAiCompatibleProvider({
      baseUrl: 'https://llm.example.test/openai/v1/responses',
      apiKey: 'LLM-SECRET',
      model: 'secret-model',
      fetchFn,
      sleep: async () => {},
      log: (event, fields) => events.push({ event, fields }),
    });
    await provider.generate({
      system: 's',
      input: 'i',
      schema: z.object({ a: z.string() }),
      schemaName: 'x',
    });
    expect(events).toEqual([{ event: 'llm_retry', fields: { attempt: 1, previous: 'http' } }]);
    expect(JSON.stringify(events)).not.toMatch(/LLM-SECRET|secret-model|llm\.example\.test/);
  });
});
