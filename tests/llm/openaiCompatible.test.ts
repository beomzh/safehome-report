import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createLlmFromEnv,
  createOpenAiCompatibleProvider,
  resolveEndpoint,
} from '../../src/adapters/llm/openaiCompatible';
import { LlmError } from '../../src/adapters/llm/provider';

const schema = z.object({ answer: z.string(), n: z.number().nullable() });
const req = { system: 'sys', input: 'hello', schema, schemaName: 'test_schema' };

const responsesBody = (text: string, status = 'completed') =>
  JSON.stringify({
    status,
    output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text }] }],
  });
const chatBody = (text: string, finish = 'stop') =>
  JSON.stringify({ choices: [{ message: { content: text }, finish_reason: finish }] });

function fake(handler: (n: number, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return handler(calls.length, init);
  }) as unknown as typeof fetch;
  return { fn, calls };
}
const opts = (fetchFn: typeof fetch, baseUrl = 'https://llm.example.test/openai/v1/responses') => ({
  baseUrl,
  apiKey: 'SECRET-KEY',
  model: 'secret-model',
  fetchFn,
  sleep: async () => {},
});

describe('resolveEndpoint', () => {
  it.each([
    ['https://h/openai/v1/responses', 'https://h/openai/v1/responses', 'responses'],
    ['https://h/openai/v1/responses/', 'https://h/openai/v1/responses', 'responses'],
    ['https://h/v1/chat/completions', 'https://h/v1/chat/completions', 'chat'],
    ['https://h/v1', 'https://h/v1/chat/completions', 'chat'],
  ])('%s', (input, url, format) => {
    expect(resolveEndpoint(input)).toEqual({ url, format });
  });
});

describe('Responses 형식', () => {
  it('요청 본문에 구조화 출력 스키마를 담고 Bearer 로 인증한다', async () => {
    const f = fake(() => new Response(responsesBody('{"answer":"ok","n":null}')));
    const out = await createOpenAiCompatibleProvider(opts(f.fn)).generate(req);
    expect(out).toEqual({ answer: 'ok', n: null });
    const call = f.calls[0]!;
    expect(call.url).toBe('https://llm.example.test/openai/v1/responses');
    expect((call.init.headers as Record<string, string>).authorization).toBe('Bearer SECRET-KEY');
    const body = JSON.parse(call.init.body as string);
    expect(body.instructions).toBe('sys');
    expect(body.input).toBe('hello');
    expect(body.text.format).toMatchObject({ type: 'json_schema', name: 'test_schema', strict: true });
    expect(body.text.format.schema.type).toBe('object');
  });

  it('완료되지 않은 응답(max tokens)은 incomplete 오류', async () => {
    const f = fake(() => new Response(responsesBody('{', 'incomplete')));
    await expect(
      createOpenAiCompatibleProvider({ ...opts(f.fn), retries: 0 }).generate(req),
    ).rejects.toMatchObject({
      kind: 'incomplete',
    });
  });
});

describe('Chat Completions 형식', () => {
  it('chat/completions 형식으로 보내고 파싱한다', async () => {
    const f = fake(() => new Response(chatBody('{"answer":"hi","n":3}')));
    const out = await createOpenAiCompatibleProvider(opts(f.fn, 'https://llm.example.test/v1')).generate(req);
    expect(out).toEqual({ answer: 'hi', n: 3 });
    const body = JSON.parse(f.calls[0]!.init.body as string);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(body.response_format.type).toBe('json_schema');
  });
});

describe('재시도와 오류 처리', () => {
  it('스키마에 맞지 않는 응답은 재시도하고, 계속 어긋나면 schema 오류', async () => {
    const f = fake(() => new Response(responsesBody('{"wrong":1}')));
    await expect(
      createOpenAiCompatibleProvider({ ...opts(f.fn), retries: 1 }).generate(req),
    ).rejects.toMatchObject({
      kind: 'schema',
    });
    expect(f.calls).toHaveLength(2);
  });

  it('JSON 이 아닌 응답도 재시도 후 format 오류', async () => {
    const f = fake(() => new Response(responsesBody('not json')));
    await expect(
      createOpenAiCompatibleProvider({ ...opts(f.fn), retries: 1 }).generate(req),
    ).rejects.toMatchObject({
      kind: 'format',
    });
  });

  it('5xx 는 재시도해서 성공할 수 있다', async () => {
    const f = fake((n) =>
      n === 1 ? new Response('x', { status: 503 }) : new Response(responsesBody('{"answer":"ok","n":1}')),
    );
    expect(await createOpenAiCompatibleProvider(opts(f.fn)).generate(req)).toEqual({ answer: 'ok', n: 1 });
    expect(f.calls).toHaveLength(2);
  });

  it('401·400 같은 클라이언트 오류는 재시도하지 않는다', async () => {
    const f = fake(() => new Response('x', { status: 401 }));
    await expect(createOpenAiCompatibleProvider({ ...opts(f.fn), retries: 3 }).generate(req)).rejects.toThrow(
      /HTTP 401/,
    );
    expect(f.calls).toHaveLength(1);
  });

  it('429 는 재시도한다', async () => {
    const f = fake((n) =>
      n === 1 ? new Response('x', { status: 429 }) : new Response(responsesBody('{"answer":"ok","n":null}')),
    );
    await createOpenAiCompatibleProvider(opts(f.fn)).generate(req);
    expect(f.calls).toHaveLength(2);
  });

  it('네트워크 오류 메시지에 주소·키·모델명이 노출되지 않는다', async () => {
    const fn = (async () => {
      throw new TypeError(
        'fetch failed: https://llm.example.test/openai/v1/responses SECRET-KEY secret-model',
      );
    }) as unknown as typeof fetch;
    const err = await createOpenAiCompatibleProvider({ ...opts(fn), retries: 0 })
      .generate(req)
      .catch((e: Error) => e);
    expect(err).toBeInstanceOf(LlmError);
    const msg = (err as Error).message;
    for (const secret of ['llm.example.test', 'SECRET-KEY', 'secret-model'])
      expect(msg).not.toContain(secret);
  });
});

describe('createLlmFromEnv', () => {
  it('none 이거나 비어 있으면 undefined', () => {
    expect(createLlmFromEnv({})).toBeUndefined();
    expect(createLlmFromEnv({ LLM_PROVIDER: 'none' })).toBeUndefined();
  });
  it('필수 설정이 빠지면 config 오류', () => {
    expect(() => createLlmFromEnv({ LLM_PROVIDER: 'openai-compatible' })).toThrow(LlmError);
  });
  it('지원하지 않는 공급자는 config 오류 (값은 메시지에만, 키는 포함하지 않음)', () => {
    expect(() => createLlmFromEnv({ LLM_PROVIDER: 'foo', LLM_API_KEY: 'SECRET' })).toThrow(/foo/);
  });
  it('설정이 갖춰지면 공급자를 만든다', () => {
    const p = createLlmFromEnv({
      LLM_PROVIDER: 'openai-compatible',
      LLM_BASE_URL: 'https://h/openai/v1/responses',
      LLM_API_KEY: 'k',
      LLM_MODEL: 'm',
    });
    expect(p?.name).toBe('openai-compatible/responses');
  });
});

describe('이미지 입력', () => {
  const img = 'data:image/jpeg;base64,AAAA';
  it('Responses 형식은 input_image 로 보낸다', async () => {
    const f = fake(() => new Response(responsesBody('{"answer":"ok","n":null}')));
    await createOpenAiCompatibleProvider(opts(f.fn)).generate({ ...req, images: [img] });
    const body = JSON.parse(f.calls[0]!.init.body as string);
    expect(body.input[0].content).toEqual([
      { type: 'input_text', text: 'hello' },
      { type: 'input_image', image_url: img },
    ]);
  });
  it('Chat 형식은 image_url 로 보낸다', async () => {
    const f = fake(() => new Response(chatBody('{"answer":"ok","n":null}')));
    await createOpenAiCompatibleProvider(opts(f.fn, 'https://h/v1')).generate({ ...req, images: [img] });
    const body = JSON.parse(f.calls[0]!.init.body as string);
    expect(body.messages[1].content).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'image_url', image_url: { url: img } },
    ]);
  });
});
