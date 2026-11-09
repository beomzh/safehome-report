import { createTradeService } from '../../../adapters/public-data/tradeService';
import { PublicDataError } from '../../../adapters/public-data/aptTrade';
import { rulesConfig } from '../../../web/rulesConfig';
import { parseMarketQuery } from '../../../web/marketQuery';

export const dynamic = 'force-dynamic';

// 모듈 범위에 두어 요청 간 캐시를 공유한다 (같은 지역·월은 재호출하지 않음)
let service: ReturnType<typeof createTradeService> | undefined;

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 실거래가 기반 시세 조회. 브라우저에서 공공 API 를 직접 호출하지 않고 이 라우트가 키를 붙여 호출한다.
 * 이 경로로 전송되는 값은 법정동코드·전용면적·단지명뿐이며 성명·금액·재무 정보는 포함하지 않는다.
 */
export async function GET(request: Request) {
  const apiKey = process.env.PUBLIC_DATA_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: '서버에 PUBLIC_DATA_API_KEY 가 설정되어 있지 않습니다. .env 를 확인하세요.' },
      { status: 503 },
    );
  }
  const parsed = parseMarketQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  service ??= createTradeService({ apiKey });
  try {
    const r = await service.estimate({
      lawdCd: parsed.query.lawdCd,
      asOf: todayIso(),
      targetAreaM2: parsed.query.areaM2,
      complexName: parsed.query.complexName,
      config: rulesConfig.marketEstimate,
    });
    return Response.json({
      market: r.market ?? null,
      sampleCount: r.sampleCount,
      minWon: r.minWon ?? null,
      maxWon: r.maxWon ?? null,
      windowMonths: rulesConfig.marketEstimate.windowMonths,
    });
  } catch (e) {
    const message = e instanceof PublicDataError ? e.message : '실거래가 조회에 실패했습니다.';
    // 키·요청 URL 은 로그와 응답에 남기지 않는다
    console.error(
      '[market] lookup failed:',
      e instanceof PublicDataError ? (e.code ?? e.message) : 'unexpected error',
    );
    return Response.json({ error: message }, { status: 502 });
  }
}
