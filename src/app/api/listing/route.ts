import { LlmError } from '../../../adapters/llm/provider';
import { createLlmFromEnv } from '../../../adapters/llm/openaiCompatible';
import { extractListing, MAX_LISTING_CHARS, parseListingUrl } from '../../../adapters/llm/listing';

export const dynamic = 'force-dynamic';

/**
 * 매물 설명 텍스트에서 항목을 추출한다 (LLM 사용, 선택 기능).
 * 이 경로로 LLM 서버에 전송되는 것은 사용자가 붙여넣은 매물 설명뿐이다(전화번호·이메일은 제거).
 * 성명·재무 정보·등기부 내용은 받지 않는다. 링크는 읽지 않고 플랫폼·매물 번호 힌트만 해석한다.
 */
export async function POST(request: Request) {
  let llm;
  try {
    llm = createLlmFromEnv(process.env);
  } catch (e) {
    console.error('[listing] config error:', e instanceof LlmError ? e.kind : 'unexpected');
    return Response.json({ error: 'LLM 설정이 올바르지 않습니다. .env 를 확인하세요.' }, { status: 503 });
  }
  if (!llm) {
    return Response.json(
      { error: 'LLM 이 설정되어 있지 않습니다 (.env 의 LLM_PROVIDER). 항목은 직접 입력할 수 있습니다.' },
      { status: 503 },
    );
  }

  let body: { text?: unknown; url?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 10) {
    return Response.json(
      { error: '매물 설명 텍스트를 붙여넣어 주세요. (링크만으로는 내용을 읽을 수 없습니다)' },
      { status: 400 },
    );
  }
  if (text.length > MAX_LISTING_CHARS * 2) {
    return Response.json(
      { error: `텍스트가 너무 깁니다. ${MAX_LISTING_CHARS}자 이내로 줄여 주세요.` },
      { status: 413 },
    );
  }

  try {
    const fields = await extractListing(llm, text);
    const hint = typeof body.url === 'string' && body.url.trim() ? parseListingUrl(body.url) : null;
    return Response.json({ fields, urlHint: hint, truncated: text.length > MAX_LISTING_CHARS });
  } catch (e) {
    // 매물 텍스트·키·주소는 로그에 남기지 않는다
    console.error('[listing] extraction failed:', e instanceof LlmError ? e.kind : 'unexpected');
    return Response.json(
      { error: e instanceof LlmError ? e.message : '항목 추출에 실패했습니다.' },
      { status: 502 },
    );
  }
}
