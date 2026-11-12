import { createBuildingService } from '../../../adapters/public-data/building';
import { parseJibun, resolveBjdong } from '../../../adapters/public-data/dongLookup';
import { PublicDataError } from '../../../adapters/public-data/aptTrade';
import { getLogger, newRequestId } from '../../../adapters/log/logger';

export const dynamic = 'force-dynamic';

const TAG = 'BUILDING';
// 모듈 범위에 두어 요청 간 캐시를 공유한다
let service: ReturnType<typeof createBuildingService> | undefined;

/**
 * 건축물대장 표제부 조회 (용도 확인). 전송되는 값은 시군구 코드·법정동 이름(주소 일부)·지번뿐이며
 * 성명·금액·재무 정보는 포함하지 않는다. 로그에는 요청 번호·소요 시간·건수·결과만 남기고 주소·지번은 남기지 않는다.
 */
export async function GET(request: Request) {
  const log = getLogger();
  const req = newRequestId();
  const started = Date.now();

  const apiKey = process.env.PUBLIC_DATA_API_KEY;
  if (!apiKey) {
    log.error(TAG, 'config_missing', { req, status: 503, missing: 'PUBLIC_DATA_API_KEY' });
    return Response.json(
      { error: '서버에 PUBLIC_DATA_API_KEY 가 설정되어 있지 않습니다. .env 를 확인하세요.' },
      { status: 503 },
    );
  }
  const params = new URL(request.url).searchParams;
  const lawdCd = (params.get('lawdCd') ?? '').trim();
  const address = (params.get('address') ?? '').trim().slice(0, 100);
  const jibun = parseJibun(params.get('jibun') ?? '');
  const bad = (error: string) => {
    log.warn(TAG, 'bad_request', { req, status: 400 });
    return Response.json({ error }, { status: 400 });
  };
  if (!/^\d{5}$/.test(lawdCd)) return bad('법정동코드(시군구 5자리)를 입력하세요. 예: 11680');
  if (!jibun) return bad('지번을 "12" 또는 "12-3" 형식으로 입력하세요. (도로명 주소의 건물번호가 아닙니다)');
  const dong = resolveBjdong(lawdCd, address);
  if (!dong.ok)
    return bad(
      dong.reason === 'ambiguous'
        ? '법정동을 하나로 정할 수 없습니다. 주소에 읍·면·동(리)을 정확히 적어 주세요.'
        : '주소에서 법정동(읍·면·동·리)을 찾지 못했습니다. 주소·지역 칸에 동 이름까지 적어 주세요.',
    );

  service ??= createBuildingService({
    apiKey,
    log: (level, event, fields) => log.log(level, TAG, event, fields),
  });
  try {
    const list = await service.lookup({ sigunguCd: lawdCd, bjdongCd: dong.bjdongCd, ...jibun });
    log.info(TAG, 'lookup_ok', {
      req,
      status: 200,
      ms: Date.now() - started,
      region: lawdCd,
      buildings: list.length,
    });
    return Response.json({ dong: dong.name, buildings: list });
  } catch (e) {
    const message = e instanceof PublicDataError ? e.message : '건축물대장 조회에 실패했습니다.';
    log.error(TAG, 'lookup_failed', {
      req,
      status: 502,
      ms: Date.now() - started,
      code: e instanceof PublicDataError ? (e.code ?? 'http') : 'unexpected',
    });
    return Response.json({ error: message }, { status: 502 });
  }
}
