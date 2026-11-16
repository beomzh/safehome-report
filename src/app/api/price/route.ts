import { PublicDataError } from '../../../adapters/public-data/aptTrade';
import { parseJibun, resolveBjdong } from '../../../adapters/public-data/dongLookup';
import { buildPnu, createPublicPriceService } from '../../../adapters/public-data/vworld';
import { getLogger, newRequestId } from '../../../adapters/log/logger';

export const dynamic = 'force-dynamic';

const TAG = 'PRICE';

/**
 * 공동주택 동·호별 공시가격 조회(브이월드). 전송되는 값은 법정동코드·지번·동·호뿐이며 성명·금액·재무 정보는 포함하지 않는다.
 * 로그에는 요청 번호·소요 시간·건수·결과만 남기고 주소·동·호·키는 남기지 않는다.
 */
export async function GET(request: Request) {
  const log = getLogger();
  const req = newRequestId();
  const started = Date.now();

  const apiKey = process.env.VWORLD_API_KEY;
  if (!apiKey) {
    log.warn(TAG, 'config_missing', { req, status: 503, missing: 'VWORLD_API_KEY' });
    return Response.json(
      {
        error:
          '서버에 VWORLD_API_KEY 가 설정되어 있지 않습니다. .env 를 확인하세요. 공시가격은 직접 입력할 수 있습니다.',
      },
      { status: 503 },
    );
  }
  const params = new URL(request.url).searchParams;
  const lawdCd = (params.get('lawdCd') ?? '').trim();
  const address = (params.get('address') ?? '').trim().slice(0, 100);
  const jibun = parseJibun(params.get('jibun') ?? '');
  const dong = (params.get('dong') ?? '').trim().slice(0, 10);
  const ho = (params.get('ho') ?? '').trim().slice(0, 10);
  const bad = (error: string) => {
    log.warn(TAG, 'bad_request', { req, status: 400 });
    return Response.json({ error }, { status: 400 });
  };
  if (!/^\d{5}$/.test(lawdCd)) return bad('법정동코드(시군구 5자리)를 입력하세요. 예: 11680');
  if (!jibun) return bad('지번을 "12" 또는 "12-3" 형식으로 입력하세요. (도로명 건물번호가 아닙니다)');
  if (!/^\d{1,4}$/.test(ho)) return bad('호를 숫자로 입력하세요. 예: 704 (정확히 일치해야 조회됩니다)');
  if (dong && !/^[0-9A-Za-z가-힣]{1,10}$/.test(dong)) return bad('동 표기가 올바르지 않습니다. 예: 107');
  const bjdong = resolveBjdong(lawdCd, address);
  if (!bjdong.ok)
    return bad(
      bjdong.reason === 'ambiguous'
        ? '법정동을 하나로 정할 수 없습니다. 주소에 읍·면·동(리)을 정확히 적어 주세요.'
        : '주소에서 법정동(읍·면·동·리)을 찾지 못했습니다. 주소·지역 칸에 동 이름까지 적어 주세요.',
    );

  const service = createPublicPriceService({
    apiKey,
    domain: process.env.VWORLD_DOMAIN?.trim() || 'localhost',
    log: (level, event, fields) => log.log(level, TAG, event, fields),
  });
  try {
    const list = await service.lookup({
      pnu: buildPnu(lawdCd, bjdong.bjdongCd, jibun.platGbCd, jibun.bun, jibun.ji),
      dong,
      ho,
      thisYear: new Date().getFullYear(),
    });
    log.info(TAG, 'lookup_ok', {
      req,
      status: 200,
      ms: Date.now() - started,
      region: lawdCd,
      prices: list.length,
    });
    return Response.json({ dong: bjdong.name, prices: list });
  } catch (e) {
    const message = e instanceof PublicDataError ? e.message : '공시가격 조회에 실패했습니다.';
    log.error(TAG, 'lookup_failed', {
      req,
      status: 502,
      ms: Date.now() - started,
      code: e instanceof PublicDataError ? (e.code ?? 'http') : 'unexpected',
    });
    return Response.json({ error: message }, { status: 502 });
  }
}
