import { z } from 'zod';
import { LlmError } from './provider';
import type { GenerateRequest, LlmProvider } from './provider';

export type ApiFormat = 'responses' | 'chat';

export interface OpenAiCompatibleOptions {
  /** 엔드포인트 전체 주소(…/responses, …/chat/completions) 또는 루트(…/v1). 로그·오류에 노출하지 않는다 */
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** 네트워크·5xx·429·형식 오류 시 재시도 횟수 */
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** URL 끝부분으로 API 형식을 판별한다. 루트만 주어지면 chat/completions 를 붙인다 */
export function resolveEndpoint(baseUrl: string): { url: string; format: ApiFormat } {
  const url = baseUrl.trim().replace(/\/+$/, '');
  if (/\/responses$/.test(url)) return { url, format: 'responses' };
  if (/\/chat\/completions$/.test(url)) return { url, format: 'chat' };
  return { url: `${url}/chat/completions`, format: 'chat' };
}

function extractText(format: ApiFormat, json: unknown): string {
  const j = json as {
    status?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  if (format === 'responses') {
    if (j.status && j.status !== 'completed')
      throw new LlmError(`LLM 응답이 완료되지 않았습니다 (${j.status})`, 'incomplete');
    const text = (j.output ?? [])
      .filter((o) => o.type === 'message')
      .flatMap((o) => o.content ?? [])
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text ?? '')
      .join('');
    if (!text) throw new LlmError('LLM 응답에 텍스트가 없습니다', 'format');
    return text;
  }
  const choice = j.choices?.[0];
  if (choice?.finish_reason === 'length')
    throw new LlmError('LLM 응답이 길이 제한으로 잘렸습니다', 'incomplete');
  if (!choice?.message?.content) throw new LlmError('LLM 응답에 텍스트가 없습니다', 'format');
  return choice.message.content;
}

/** OpenAI 호환(Responses / Chat Completions) 엔드포인트용 공급자. 구조화 출력(JSON Schema) + zod 검증 */
export function createOpenAiCompatibleProvider(opts: OpenAiCompatibleOptions): LlmProvider {
  const { url, format } = resolveEndpoint(opts.baseUrl);
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const retries = opts.retries ?? 1;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  return {
    name: `openai-compatible/${format}`,
    async generate<T>(req: GenerateRequest<T>): Promise<T> {
      const jsonSchema = z.toJSONSchema(req.schema);
      const maxTokens = req.maxOutputTokens ?? 4000;
      const body =
        format === 'responses'
          ? {
              model: opts.model,
              instructions: req.system,
              input: req.input,
              max_output_tokens: maxTokens,
              text: {
                format: { type: 'json_schema', name: req.schemaName, strict: true, schema: jsonSchema },
              },
            }
          : {
              model: opts.model,
              messages: [
                { role: 'system', content: req.system },
                { role: 'user', content: req.input },
              ],
              max_tokens: maxTokens,
              response_format: {
                type: 'json_schema',
                json_schema: { name: req.schemaName, strict: true, schema: jsonSchema },
              },
            };

      let lastError: LlmError = new LlmError('LLM 호출에 실패했습니다', 'http');
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt > 0) await sleep(400 * attempt);
        try {
          const res = await fetchFn(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.apiKey}` },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!res.ok) {
            lastError = new LlmError(`LLM 호출 실패 (HTTP ${res.status})`, 'http');
            // 인증·요청 오류는 재시도해도 같으므로 즉시 중단
            if (res.status >= 400 && res.status < 500 && res.status !== 429) throw lastError;
            continue;
          }
          const text = extractText(format, await res.json());
          let parsedJson: unknown;
          try {
            parsedJson = JSON.parse(text);
          } catch {
            lastError = new LlmError('LLM 응답이 JSON 이 아닙니다', 'format');
            continue;
          }
          const checked = req.schema.safeParse(parsedJson);
          if (!checked.success) {
            lastError = new LlmError('LLM 응답이 기대한 형식과 다릅니다', 'schema');
            continue;
          }
          return checked.data;
        } catch (e) {
          if (e instanceof LlmError) {
            if (e.kind === 'http' && /HTTP 4(?!29)\d\d/.test(e.message)) throw e;
            lastError = e;
            continue;
          }
          const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
          lastError = new LlmError(
            timeout ? 'LLM 응답 시간이 초과되었습니다' : 'LLM 서버에 연결하지 못했습니다',
            timeout ? 'timeout' : 'http',
          );
        }
      }
      throw lastError;
    },
  };
}

/** 환경변수에서 공급자를 만든다. LLM_PROVIDER 가 none/비어 있으면 undefined (LLM 없이 동작) */
export function createLlmFromEnv(
  env: Record<string, string | undefined>,
  fetchFn?: typeof fetch,
): LlmProvider | undefined {
  const provider = (env.LLM_PROVIDER ?? 'none').trim();
  if (provider === '' || provider === 'none') return undefined;
  if (provider !== 'openai-compatible') {
    throw new LlmError(`지원하지 않는 LLM_PROVIDER 입니다: ${provider}`, 'config');
  }
  const { LLM_BASE_URL: baseUrl, LLM_API_KEY: apiKey, LLM_MODEL: model } = env;
  if (!baseUrl || !apiKey || !model) {
    throw new LlmError('LLM_BASE_URL, LLM_API_KEY, LLM_MODEL 설정이 필요합니다', 'config');
  }
  return createOpenAiCompatibleProvider({
    baseUrl,
    apiKey,
    model,
    fetchFn,
    timeoutMs: Number(env.LLM_TIMEOUT_MS) || undefined,
  });
}
