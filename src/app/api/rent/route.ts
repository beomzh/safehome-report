import { createTradeService } from '../../../adapters/public-data/tradeService';
import { PublicDataError } from '../../../adapters/public-data/aptTrade';
import { getLogger, newRequestId } from '../../../adapters/log/logger';
import { rulesConfig } from '../../../web/rulesConfig';
import { parseMarketQuery } from '../../../web/marketQuery';

export const dynamic = 'force-dynamic';

const TAG = 'RENT';
// 모듈 범위에 두어 요청 간 캐시를 공유한다 (같은 지역·월은 재호출하지 않음)
let service: ReturnType<typeof createTradeService> | undefined;

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 전월세 실거래 기반 전세·월세 시세 조회 (/api/market 과 같은 쿼리). 전송되는 값은 법정동코드·면적·단지명뿐이며
 * 로그에는 요청 번호·소요 시간·건수·결과만 남긴다.
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
  const parsed = parseMarketQuery(new URL(request.url).searchParams);
  if (!parsed.ok) {
    log.warn(TAG, 'bad_request', { req, status: 400 });
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  service ??= createTradeService({
    apiKey,
    log: (level, event, fields) => log.log(level, TAG, event, fields),
  });
  try {
    const r = await service.estimateRent({
      housing: parsed.query.housing,
      lawdCd: parsed.query.lawdCd,
      asOf: todayIso(),
      targetAreaM2: parsed.query.areaM2,
      complexName: parsed.query.complexName,
      dongName: parsed.query.dongName,
      config: rulesConfig.marketEstimate,
    });
    log.info(TAG, 'lookup_ok', {
      req,
      status: 200,
      ms: Date.now() - started,
      region: parsed.query.lawdCd,
      housing: parsed.query.housing,
      withComplex: parsed.query.complexName !== undefined,
      months: r.monthsQueried,
      jeonseSamples: r.jeonse?.sampleCount ?? 0,
      monthlySamples: r.monthly?.sampleCount ?? 0,
    });
    return Response.json({
      jeonse: r.jeonse ?? null,
      monthly: r.monthly ?? null,
      windowMonths: rulesConfig.marketEstimate.rentWindowMonths,
    });
  } catch (e) {
    const message = e instanceof PublicDataError ? e.message : '전월세 조회에 실패했습니다.';
    log.error(TAG, 'lookup_failed', {
      req,
      status: 502,
      ms: Date.now() - started,
      code: e instanceof PublicDataError ? (e.code ?? 'http') : 'unexpected',
    });
    return Response.json({ error: message }, { status: 502 });
  }
}
