import { describe, expect, it } from 'vitest';
import { createTradeService, monthsToFetch } from '../../src/adapters/public-data/tradeService';
import { config } from '../helpers/builders';

const rec = (amount: string, ym = '202610', day = '10', name = '가나다') =>
  `<item><aptNm>${name}</aptNm><cdealType> </cdealType><dealAmount>${amount}</dealAmount><dealDay>${day}</dealDay>` +
  `<dealMonth>${ym.slice(4)}</dealMonth><dealYear>${ym.slice(0, 4)}</dealYear><excluUseAr>84.9</excluUseAr></item>`;
const body = (items: string[], total: number) =>
  `<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>${items.join('')}</items><totalCount>${total}</totalCount></body></response>`;
const ok = (text: string) => new Response(text, { status: 200 });

/** 호출 URL 을 기록하는 가짜 fetch */
function fakeFetch(handler: (url: string, n: number) => Response | Promise<Response>) {
  const urls: string[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return handler(String(input), urls.length);
  }) as typeof fetch;
  return { fn, urls };
}

describe('monthsToFetch', () => {
  it('현재 달과 이전 N개월을 최신순으로 만든다', () => {
    const m = monthsToFetch('2026-11-09', 12);
    expect(m).toHaveLength(13);
    expect(m[0]).toBe('202611');
    expect(m[12]).toBe('202511');
  });
  it('연도 경계를 넘는다', () => {
    expect(monthsToFetch('2026-01-15', 2)).toEqual(['202601', '202512', '202511']);
  });
});

describe('createTradeService', () => {
  it('Decoding 키는 인코딩하고 Encoding 키(%)는 그대로 쓴다', async () => {
    const a = fakeFetch(() => ok(body([], 0)));
    await createTradeService({ apiKey: 'a+b/c=', fetchFn: a.fn }).fetchMonth('11680', '202610');
    expect(a.urls[0]).toContain('serviceKey=a%2Bb%2Fc%3D&');

    const b = fakeFetch(() => ok(body([], 0)));
    await createTradeService({ apiKey: 'a%2Bb', fetchFn: b.fn }).fetchMonth('11680', '202610');
    expect(b.urls[0]).toContain('serviceKey=a%2Bb&');
    expect(b.urls[0]).toContain('LAWD_CD=11680');
    expect(b.urls[0]).toContain('DEAL_YMD=202610');
  });

  it('전체 건수만큼 페이지를 이어서 가져오고 멈춘다', async () => {
    const f = fakeFetch((_u, n) => ok(body(n < 3 ? [rec('1,000'), rec('2,000')] : [rec('3,000')], 5)));
    const s = createTradeService({ apiKey: 'k', fetchFn: f.fn, pageSize: 2 });
    const records = await s.fetchMonth('11680', '202610');
    expect(records).toHaveLength(5);
    expect(f.urls).toHaveLength(3);
  });

  it('최대 페이지 수를 넘겨 호출하지 않는다 (일일 한도 보호)', async () => {
    const f = fakeFetch(() => ok(body([rec('1,000')], 1_000_000)));
    const s = createTradeService({ apiKey: 'k', fetchFn: f.fn, pageSize: 1, maxPages: 3 });
    await s.fetchMonth('11680', '202610');
    expect(f.urls).toHaveLength(3);
  });

  it('같은 지역·월은 캐시하고 TTL 이 지나면 다시 호출한다', async () => {
    let t = 0;
    const f = fakeFetch(() => ok(body([rec('1,000')], 1)));
    const s = createTradeService({ apiKey: 'k', fetchFn: f.fn, cacheTtlMs: 1000, now: () => t });
    await s.fetchMonth('11680', '202610');
    await s.fetchMonth('11680', '202610');
    expect(f.urls).toHaveLength(1);
    t = 1500;
    await s.fetchMonth('11680', '202610');
    expect(f.urls).toHaveLength(2);
  });

  it('일시적 실패는 재시도해서 성공한다', async () => {
    const f = fakeFetch((_u, n) =>
      n === 1 ? new Response('x', { status: 500 }) : ok(body([rec('1,000')], 1)),
    );
    const records = await createTradeService({ apiKey: 'k', fetchFn: f.fn }).fetchMonth('11680', '202610');
    expect(records).toHaveLength(1);
    expect(f.urls).toHaveLength(2);
  });

  it('한도 초과(22) 같은 오류는 재시도하지 않는다', async () => {
    const f = fakeFetch(() =>
      ok('<response><header><resultCode>22</resultCode><resultMsg>LIMIT</resultMsg></header></response>'),
    );
    await expect(
      createTradeService({ apiKey: 'k', fetchFn: f.fn }).fetchMonth('11680', '202610'),
    ).rejects.toThrow(/한도/);
    expect(f.urls).toHaveLength(1);
  });

  it('계속 실패하면 재시도 횟수만큼만 호출하고 오류를 던진다', async () => {
    const f = fakeFetch(() => new Response('x', { status: 500 }));
    await expect(
      createTradeService({ apiKey: 'k', fetchFn: f.fn, retries: 2 }).fetchMonth('11680', '202610'),
    ).rejects.toThrow(/HTTP 500/);
    expect(f.urls).toHaveLength(3);
  });

  it('오류 메시지에 서비스 키가 노출되지 않는다', async () => {
    const f = fakeFetch(() => new Response('x', { status: 500 }));
    const err = await createTradeService({ apiKey: 'SECRET-KEY-123', fetchFn: f.fn, retries: 0 })
      .fetchMonth('11680', '202610')
      .catch((e: Error) => e);
    expect(String((err as Error).message)).not.toContain('SECRET-KEY-123');
  });

  it('여러 달 거래를 모아 중앙값 시세를 추정한다', async () => {
    const f = fakeFetch((url) => {
      const ym = /DEAL_YMD=(\d{6})/.exec(url)![1]!;
      if (ym === '202610') return ok(body([rec('50,000', ym), rec('52,000', ym), rec('48,000', ym)], 3));
      return ok(body([], 0));
    });
    const r = await createTradeService({ apiKey: 'k', fetchFn: f.fn }).estimate({
      lawdCd: '11680',
      asOf: '2026-11-09',
      targetAreaM2: 85,
      config: config.marketEstimate,
    });
    expect(r.monthsQueried).toBe(13);
    expect(r.sampleCount).toBe(3);
    expect(r.market).toEqual({ estimatedValue: 500_000_000, source: 'trade_median', confidence: 'high' });
  });
});

describe('estimateRent (전월세 시세)', () => {
  const rent = (dep: string, monthly: string, ym = '202610', renewal = '신규') =>
    `<item><aptNm>가나다</aptNm><contractType>${renewal}</contractType><deposit>${dep}</deposit><monthlyRent>${monthly}</monthlyRent>` +
    `<dealDay>10</dealDay><dealMonth>${ym.slice(4)}</dealMonth><dealYear>${ym.slice(0, 4)}</dealYear><excluUseAr>84.9</excluUseAr></item>`;

  it('전월세 엔드포인트를 월 단위로 호출하고 전세 중앙값을 낸다', async () => {
    const f = fakeFetch(() =>
      ok(body([rent('30,000', '0'), rent('32,000', '0'), rent('34,000', '0'), rent('1,000', '100')], 4)),
    );
    const s = createTradeService({ apiKey: 'k', fetchFn: f.fn });
    const r = await s.estimateRent({
      lawdCd: '11680',
      asOf: '2026-11-09',
      targetAreaM2: 84.9,
      complexName: '가나다',
      config: config.marketEstimate,
    });
    expect(f.urls.every((u) => u.includes('RTMSDataSvcAptRent'))).toBe(true);
    expect(f.urls).toHaveLength(config.marketEstimate.rentWindowMonths + 1);
    expect(r.jeonse?.confidence).toBe('high');
    expect(r.monthly?.sampleCount).toBeGreaterThan(0);
  });

  it('같은 월은 캐시를 재사용한다', async () => {
    const f = fakeFetch(() => ok(body([rent('30,000', '0')], 1)));
    const s = createTradeService({ apiKey: 'k', fetchFn: f.fn });
    await s.fetchRentMonth('11680', '202610');
    await s.fetchRentMonth('11680', '202610');
    expect(f.urls).toHaveLength(1);
    expect(f.urls[0]).toContain('numOfRows=1000');
  });
});

describe('429(요청 과다) 처리', () => {
  const noWait = async () => {};
  it('429 는 기다렸다가 다시 시도해 성공하면 결과를 돌려준다', async () => {
    const waits: number[] = [];
    const f = fakeFetch((_u, n) =>
      n <= 2 ? new Response('too many', { status: 429 }) : ok(body([rec('1,000')], 1)),
    );
    const s = createTradeService({
      apiKey: 'k',
      fetchFn: f.fn,
      retries: 0,
      sleepFn: async (ms) => {
        waits.push(ms);
      },
    });
    const records = await s.fetchMonth('11680', '202610');
    expect(records).toHaveLength(1);
    expect(f.urls).toHaveLength(3);
    expect(waits).toEqual([1500, 3000]); // 점점 길게 기다린다
  });

  it('계속 429 면 친절한 문구와 http429 코드로 실패한다', async () => {
    const f = fakeFetch(() => new Response('', { status: 429 }));
    const s = createTradeService({ apiKey: 'k', fetchFn: f.fn, sleepFn: noWait });
    await expect(s.fetchMonth('11680', '202610')).rejects.toMatchObject({
      code: 'http429',
      message: expect.stringContaining('잠시 제한'),
    });
    expect(f.urls).toHaveLength(4); // 처음 + 재시도 3번
  });

  it('429 가 아닌 오류는 기존 재시도 횟수만 따른다', async () => {
    const f = fakeFetch(() => new Response('', { status: 500 }));
    const s = createTradeService({ apiKey: 'k', fetchFn: f.fn, retries: 1, sleepFn: noWait });
    await expect(s.fetchMonth('11680', '202610')).rejects.toThrow('HTTP 500');
    expect(f.urls).toHaveLength(2);
  });
});

describe('남은 호출 한도 로그', () => {
  it('X-RateLimit-Remaining 헤더를 읽고, 적으면 경고로 남긴다', async () => {
    const logs: { level: string; event: string; fields: Record<string, unknown> }[] = [];
    const f = fakeFetch(
      () => new Response(body([rec('1,000')], 1), { headers: { 'x-ratelimit-remaining': '312' } }),
    );
    const s = createTradeService({
      apiKey: 'k',
      fetchFn: f.fn,
      log: (level, event, fields) => logs.push({ level, event, fields }),
    });
    await s.fetchMonth('11680', '202610');
    expect(logs.find((l) => l.event === 'public_data_quota')).toMatchObject({
      level: 'warn',
      fields: { remaining: 312 },
    });
  });

  it('여유가 있으면 debug, 헤더가 없으면 아무것도 남기지 않는다', async () => {
    const logs: { level: string; event: string }[] = [];
    const ok1 = fakeFetch(
      () => new Response(body([rec('1,000')], 1), { headers: { 'x-ratelimit-remaining': '9000' } }),
    );
    await createTradeService({
      apiKey: 'k',
      fetchFn: ok1.fn,
      log: (level, event) => logs.push({ level, event }),
    }).fetchMonth('11680', '202610');
    expect(logs.find((l) => l.event === 'public_data_quota')?.level).toBe('debug');

    const none: { event: string }[] = [];
    const ok2 = fakeFetch(() => ok(body([rec('1,000')], 1)));
    await createTradeService({
      apiKey: 'k',
      fetchFn: ok2.fn,
      log: (_l, event) => none.push({ event }),
    }).fetchMonth('11680', '202610');
    expect(none.some((l) => l.event === 'public_data_quota')).toBe(false);
  });
});
