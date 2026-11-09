import { LlmError } from '../../../adapters/llm/provider';
import { createLlmFromEnv } from '../../../adapters/llm/openaiCompatible';
import { explainVerdict, verdictRequestSchema } from '../../../adapters/llm/verdict';
import { getLogger, newRequestId } from '../../../adapters/log/logger';

export const dynamic = 'force-dynamic';

const TAG = 'VERDICT';

/**
 * 기준표 결론의 AI 해석 (LLM 사용, 선택 기능, 버튼을 눌렀을 때만 호출).
 * 전송되는 것은 계약 유형·결론·기준별 상태와 비율뿐이다. 자산·소득·매물 가격·성명·지역은 보내지 않는다.
 * 로그에는 요청 번호·소요 시간·결론·버려진 문장 수만 남긴다.
 */
export async function POST(request: Request) {
  const log = getLogger();
  const req = newRequestId();
  const started = Date.now();

  let llm;
  try {
    llm = createLlmFromEnv(process.env, undefined, (event, fields) => log.warn(TAG, event, fields));
  } catch (e) {
    log.error(TAG, 'config_invalid', {
      req,
      status: 503,
      kind: e instanceof LlmError ? e.kind : 'unexpected',
    });
    return Response.json({ error: 'LLM 설정이 올바르지 않습니다. .env 를 확인하세요.' }, { status: 503 });
  }
  if (!llm) {
    log.warn(TAG, 'llm_not_configured', { req, status: 503 });
    return Response.json(
      {
        error:
          'LLM 이 설정되어 있지 않습니다 (.env 의 LLM_PROVIDER). 기준표 결론은 AI 없이도 볼 수 있습니다.',
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    log.warn(TAG, 'bad_request', { req, status: 400, reason: 'invalid_json' });
    return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  const parsed = verdictRequestSchema.safeParse(body);
  if (!parsed.success) {
    log.warn(TAG, 'bad_request', { req, status: 400, reason: 'invalid_params' });
    return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    const explanation = await explainVerdict(llm, parsed.data);
    log.info(TAG, 'explain_ok', {
      req,
      status: 200,
      ms: Date.now() - started,
      provider: llm.name,
      verdict: parsed.data.verdict,
      dropped: explanation.droppedForNumbers,
      disagreement: explanation.disagreement !== null,
    });
    return Response.json({ explanation });
  } catch (e) {
    log.error(TAG, 'explain_failed', {
      req,
      status: 502,
      ms: Date.now() - started,
      kind: e instanceof LlmError ? e.kind : 'unexpected',
    });
    return Response.json({ error: 'AI 해석에 실패했습니다. 잠시 후 다시 시도하세요.' }, { status: 502 });
  }
}
