import { LlmError } from '../../../adapters/llm/provider';
import { createLlmFromEnv } from '../../../adapters/llm/openaiCompatible';
import { validateImageList } from '../../../adapters/llm/listing';
import { MAX_REGISTRY_PAGES, ocrRegistryImages } from '../../../adapters/llm/registryOcr';
import { getLogger, newRequestId } from '../../../adapters/log/logger';

export const dynamic = 'force-dynamic';

const TAG = 'REGISTRY_OCR';

/**
 * 스캔본 등기부 이미지를 LLM 으로 글자로 옮긴다 (선택 기능, 사용자가 명시적으로 눌렀을 때만).
 * **등기부 이미지(소유자 성명·주소 등 개인정보 포함)가 LLM 서버로 전송되는 유일한 경로**다.
 * 결과는 판정이 아니라 로컬 파서가 읽을 텍스트이고, 모델이 틀리게 옮길 수 있다.
 * 로그에는 요청 번호·소요 시간·쪽 수·글자 수만 남기고 이미지·글자·키는 남기지 않는다.
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
        error: 'LLM 이 설정되어 있지 않습니다 (.env 의 LLM_PROVIDER). 텍스트 PDF 를 쓰거나 직접 입력하세요.',
      },
      { status: 503 },
    );
  }

  let body: { images?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    log.warn(TAG, 'bad_request', { req, status: 400, reason: 'invalid_json' });
    return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  const imageError = validateImageList(body.images, MAX_REGISTRY_PAGES);
  const images = (body.images as string[] | undefined) ?? [];
  if (imageError || images.length === 0) {
    log.warn(TAG, 'bad_request', { req, status: 400, reason: imageError ? 'invalid_images' : 'no_images' });
    return Response.json({ error: imageError ?? '이미지가 없습니다.' }, { status: 400 });
  }

  try {
    const text = await ocrRegistryImages(llm, images);
    log.info(TAG, 'ocr_ok', {
      req,
      status: 200,
      ms: Date.now() - started,
      provider: llm.name,
      pages: images.length,
      chars: text.length,
    });
    return Response.json({ text });
  } catch (e) {
    log.error(TAG, 'ocr_failed', {
      req,
      status: 502,
      ms: Date.now() - started,
      kind: e instanceof LlmError ? e.kind : 'unexpected',
    });
    return Response.json(
      { error: e instanceof LlmError ? e.message : '글자 읽기에 실패했습니다.' },
      { status: 502 },
    );
  }
}
