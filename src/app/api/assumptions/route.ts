import { LlmError } from '../../../adapters/llm/provider';
import { createLlmFromEnv } from '../../../adapters/llm/openaiCompatible';
import { parseAssumptionRequest, suggestAssumptions } from '../../../adapters/llm/assumptions';
import { getLogger, newRequestId } from '../../../adapters/log/logger';

export const dynamic = 'force-dynamic';

const TAG = 'ASSUMPTIONS';

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 대출 기준값(LTV·DSR·금리·기간) 제안 (LLM 사용, 선택 기능). 결과는 공식 값이 아니며 사용자가 확인한 뒤에만 적용된다.
 * LLM 으로 전송되는 것은 계약 유형·보증금(매매가)·지역·보유 주택 수·생애최초 여부뿐이다.
 * 소득·자산·성명은 받지 않는다. 로그에는 요청 번호·소요 시간·채워진 항목 수만 남기고 지역·금액은 남기지 않는다.
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
      { error: 'LLM 이 설정되어 있지 않습니다 (.env 의 LLM_PROVIDER). 기준값은 직접 입력할 수 있습니다.' },
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
  const parsed = parseAssumptionRequest(body);
  if (!parsed.ok) {
    log.warn(TAG, 'bad_request', { req, status: 400, reason: 'invalid_params' });
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const suggestion = await suggestAssumptions(llm, parsed.req, todayIso());
    const filled = [
      suggestion.ltvLimitPercent,
      suggestion.dsrLimitPercent,
      suggestion.annualRatePercent,
      suggestion.stressAddPercent,
      suggestion.termYears,
    ].filter((v) => v !== null).length;
    log.info(TAG, 'suggest_ok', {
      req,
      status: 200,
      ms: Date.now() - started,
      provider: llm.name,
      kind: parsed.req.kind,
      filled,
      confidence: suggestion.confidence,
      caveats: suggestion.caveats.length,
    });
    return Response.json({ suggestion });
  } catch (e) {
    log.error(TAG, 'suggest_failed', {
      req,
      status: 502,
      ms: Date.now() - started,
      kind: e instanceof LlmError ? e.kind : 'unexpected',
    });
    return Response.json(
      { error: e instanceof LlmError ? e.message : '기준값 제안에 실패했습니다.' },
      { status: 502 },
    );
  }
}
