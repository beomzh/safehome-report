import { describe, expect, it } from 'vitest';
import { LOAN_PRODUCTS, loansFor } from '../../src/web/loans';
import {
  daysSince,
  isStale,
  LOAN_RATES,
  loanRateInfoSchema,
  rateInfoFor,
  STALE_AFTER_DAYS,
} from '../../src/web/loanRates';

const base = {
  productId: 'x',
  rateType: '변동금리',
  range: { minPercent: 2, maxPercent: 3 },
  adjustments: [],
  notCovered: [],
  source: { name: '공식', url: 'https://nhuf.molit.go.kr/a', checkedAt: '2026-11-09' },
};

describe('금리 데이터 파일', () => {
  it('스키마를 통과하고 모든 항목의 상품 id 가 대출 종류 목록에 있다', () => {
    const ids = new Set(LOAN_PRODUCTS.map((p) => p.id));
    for (const p of LOAN_RATES.products) expect(ids.has(p.productId)).toBe(true);
  });

  it('상품 id 가 중복되지 않는다', () => {
    const ids = LOAN_RATES.products.map((p) => p.productId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('모든 출처는 공식 사이트(https)이고 확인일이 있다', () => {
    const hosts = new Set(LOAN_RATES.products.map((p) => new URL(p.source.url).hostname));
    for (const h of hosts)
      expect(['nhuf.molit.go.kr', 'www.hf.go.kr', 'hf.go.kr', 'portal.kfb.or.kr']).toContain(h);
    for (const p of LOAN_RATES.products) expect(p.source.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('일반 버팀목·신혼·디딤돌은 공식 사이트에서 읽은 칸별 금리표를 갖고, 범위와 일치한다', () => {
    for (const id of ['buteommok', 'newlywed-jeonse', 'didimdol']) {
      const info = rateInfoFor(id)!;
      expect(info.grid).toBeDefined();
      const all = info.grid!.rows.flatMap((r) => r.percents);
      expect(Math.min(...all)).toBe(info.range!.minPercent);
      expect(Math.max(...all)).toBe(info.range!.maxPercent);
      expect(info.notCovered.some((n) => n.includes('칸 금리표'))).toBe(false);
    }
  });

  it('칸별 금리표는 소득이 높을수록(행), 보증금이 클수록(열) 금리가 낮아지지 않는다', () => {
    for (const id of ['buteommok', 'newlywed-jeonse']) {
      const rows = rateInfoFor(id)!.grid!.rows;
      for (const r of rows)
        for (let i = 1; i < r.percents.length; i++)
          expect(r.percents[i]).toBeGreaterThanOrEqual(r.percents[i - 1]!);
      for (let i = 1; i < rows.length; i++)
        expect(rows[i]!.percents[0]).toBeGreaterThanOrEqual(rows[i - 1]!.percents[0]!);
    }
  });

  it('열 수와 금리 수가 다른 표는 거부한다', () => {
    const bad = {
      ...base,
      range: undefined,
      grid: { basis: 'b', cols: ['a', 'b'], rows: [{ label: 'x', percents: [2] }] },
    };
    expect(loanRateInfoSchema.safeParse(bad).success).toBe(false);
  });

  it('은행 상품은 실제 대출금리를 확인하지 못했다고 밝힌다 (기준금리만 제공)', () => {
    for (const id of ['bank-jeonse', 'bank-mortgage']) {
      const info = rateInfoFor(id);
      expect(info?.benchmarks?.length).toBeGreaterThan(0);
      expect(info?.range).toBeUndefined();
      expect(info?.notCovered.join(' ')).toContain('확인하지 못했습니다');
    }
  });

  it('금리를 확인하지 못한 상품은 데이터가 없어 화면이 안내 문구를 쓴다', () => {
    expect(rateInfoFor('monthly-rent-loan')).toBeUndefined();
    expect(rateInfoFor('없는-상품')).toBeUndefined();
  });

  it('전세·월세·매매 각각에 금리 안내가 하나 이상 있다', () => {
    for (const kind of ['jeonse', 'monthly', 'sale'] as const) {
      expect(loansFor(kind).some((p) => rateInfoFor(p.id))).toBe(true);
    }
  });
});

describe('확인한 값 (2026-11-09, 공식 페이지)', () => {
  it('청년전용 버팀목: 소득 구간별 2.2 / 2.5 / 2.9 / 3.3', () => {
    expect(rateInfoFor('youth-buteommok')?.table?.rows.map((r) => r.percent)).toEqual([2.2, 2.5, 2.9, 3.3]);
  });

  it('보금자리론: 공시일 2026-11-09, 아낌e 10~50년 5.00~5.30', () => {
    const t = rateInfoFor('bogeumjari')?.termTable;
    expect(t?.publishedAt).toBe('2026-11-09');
    expect(t?.terms).toEqual([10, 15, 20, 30, 40, 50]);
    expect(t?.series.find((s) => s.name.includes('아낌e'))?.percents).toEqual([
      5.0, 5.1, 5.15, 5.2, 5.25, 5.3,
    ]);
  });

  it('보금자리론: 공식 설명대로 u-보금자리론은 아낌e 보다 모든 만기에서 0.1%p 높다', () => {
    const t = rateInfoFor('bogeumjari')!.termTable!;
    const a = t.series.find((s) => s.name.includes('아낌e'))!.percents;
    const u = t.series.find((s) => s.name.startsWith('u-'))!.percents;
    u.forEach((v, i) => expect(Math.round((v - a[i]!) * 100) / 100).toBe(0.1));
  });

  it('COFIX: 공시 2026-10-15 신규취급액 3.43 / 잔액 3.15 / 신 잔액 2.79', () => {
    const b = rateInfoFor('bank-mortgage')!.benchmarks!;
    expect(b.map((x) => x.percent)).toEqual([3.43, 3.15, 2.79]);
    expect(b.every((x) => x.publishedAt === '2026-10-15')).toBe(true);
  });

  it('주택도시기금 금리 범위: 버팀목 2.5~3.5, 신혼부부 1.9~3.3, 디딤돌 2.85~4.15', () => {
    expect(rateInfoFor('buteommok')?.range).toEqual({ minPercent: 2.5, maxPercent: 3.5 });
    expect(rateInfoFor('newlywed-jeonse')?.range).toEqual({ minPercent: 1.9, maxPercent: 3.3 });
    expect(rateInfoFor('didimdol')?.range).toEqual({ minPercent: 2.85, maxPercent: 4.15 });
  });
});

describe('스키마가 잘못된 데이터를 거부한다', () => {
  it('정상 샘플은 통과', () => {
    expect(loanRateInfoSchema.safeParse(base).success).toBe(true);
  });
  it('공식 도메인이 아닌 출처(블로그 등)는 거부', () => {
    expect(
      loanRateInfoSchema.safeParse({ ...base, source: { ...base.source, url: 'https://blog.example.com/x' } })
        .success,
    ).toBe(false);
  });
  it('https 가 아니면 거부', () => {
    expect(
      loanRateInfoSchema.safeParse({ ...base, source: { ...base.source, url: 'http://nhuf.molit.go.kr/a' } })
        .success,
    ).toBe(false);
  });
  it.each([0, -1, 16, 250])('범위를 벗어난 금리 %s 는 거부', (v) => {
    expect(loanRateInfoSchema.safeParse({ ...base, range: { minPercent: v, maxPercent: 3 } }).success).toBe(
      false,
    );
  });
  it('최소가 최대보다 크면 거부', () => {
    expect(loanRateInfoSchema.safeParse({ ...base, range: { minPercent: 4, maxPercent: 3 } }).success).toBe(
      false,
    );
  });
  it('만기 수와 금리 수가 다른 표는 거부', () => {
    const termTable = { publishedAt: '2026-11-09', terms: [10, 20], series: [{ name: 'a', percents: [5] }] };
    expect(loanRateInfoSchema.safeParse({ ...base, range: undefined, termTable }).success).toBe(false);
  });
  it('금리 정보가 하나도 없으면 거부', () => {
    expect(loanRateInfoSchema.safeParse({ ...base, range: undefined }).success).toBe(false);
  });
});

describe('확인일 경과 경고', () => {
  it('경과 일수 계산', () => {
    expect(daysSince('2026-11-09', '2026-11-09')).toBe(0);
    expect(daysSince('2026-10-01', '2026-11-09')).toBe(39);
  });
  it(`${STALE_AFTER_DAYS}일까지는 정상, 넘으면 오래된 정보`, () => {
    expect(isStale('2026-10-05', '2026-11-09')).toBe(false); // 35일
    expect(isStale('2026-10-04', '2026-11-09')).toBe(true); // 36일
  });
});

describe('신생아 특례·월세 대출 (공식 페이지, 2026-11-12)', () => {
  it('신생아 특례 두 상품은 연소득 9구간 × 4열 칸별 금리표를 갖고 범위와 일치한다', () => {
    for (const id of ['newborn-buteommok', 'newborn-didimdol']) {
      const info = rateInfoFor(id)!;
      expect(info.grid!.rows).toHaveLength(9);
      expect(info.grid!.cols).toHaveLength(4);
      const all = info.grid!.rows.flatMap((r) => r.percents);
      expect(Math.min(...all)).toBe(info.range!.minPercent);
      expect(Math.max(...all)).toBe(info.range!.maxPercent);
    }
    expect(rateInfoFor('newborn-buteommok')?.range).toEqual({ minPercent: 1.3, maxPercent: 4.3 });
    expect(rateInfoFor('newborn-didimdol')?.range).toEqual({ minPercent: 1.8, maxPercent: 4.5 });
  });

  it('신생아 특례 표는 소득이 높을수록(행)·보증금이 클수록(열) 금리가 낮아지지 않는다', () => {
    for (const id of ['newborn-buteommok', 'newborn-didimdol']) {
      const rows = rateInfoFor(id)!.grid!.rows;
      for (const r of rows)
        for (let i = 1; i < r.percents.length; i++)
          expect(r.percents[i]).toBeGreaterThanOrEqual(r.percents[i - 1]!);
      for (let i = 1; i < rows.length; i++)
        expect(rows[i]!.percents[0]).toBeGreaterThanOrEqual(rows[i - 1]!.percents[0]!);
    }
  });

  it('월세 대출 두 상품의 금리와 특례 종료 후 금리를 담지 않았다는 안내', () => {
    expect(rateInfoFor('housing-stable-wolse')?.table?.rows).toEqual([
      { label: '우대형', percent: 1.3 },
      { label: '일반형', percent: 1.8 },
    ]);
    expect(rateInfoFor('youth-wolse')?.table?.rows[0]).toEqual({ label: '보증금 대출', percent: 1.3 });
    expect(rateInfoFor('newborn-buteommok')?.notCovered.join(' ')).toContain('특례금리 적용 종료 후');
  });

  it('모든 새 상품은 loans 목록에 있고 계약 유형에 맞는다', () => {
    const kinds = (id: string) => LOAN_PRODUCTS.find((p) => p.id === id)?.kinds;
    expect(kinds('newborn-buteommok')).toEqual(['jeonse']);
    expect(kinds('newborn-didimdol')).toEqual(['sale']);
    expect(kinds('housing-stable-wolse')).toEqual(['monthly']);
    expect(kinds('youth-wolse')).toEqual(['monthly']);
  });
});
