import { z } from 'zod';
import ratesJson from '../../rules.config/loan-rates.json';

/**
 * 대출 상품 금리 안내 데이터. 공식 사이트에서 확인한 값만 출처 링크와 확인일을 붙여 담는다.
 * 금리는 수시로 바뀌므로 확인일이 오래되면 화면에 경고하고, 확인하지 못한 부분은 notCovered 에 밝힌다.
 * 공식 사이트 도메인만 허용한다 (블로그 등 2차 자료 금지).
 */
const OFFICIAL_HOSTS = ['nhuf.molit.go.kr', 'www.hf.go.kr', 'hf.go.kr', 'portal.kfb.or.kr'];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const percent = z.number().gt(0).lte(15);

const sourceSchema = z.object({
  name: z.string().min(1),
  url: z
    .string()
    .url()
    .refine(
      (u) => u.startsWith('https://') && OFFICIAL_HOSTS.includes(new URL(u).hostname),
      '공식 사이트(https)만 허용',
    ),
  checkedAt: isoDate,
  /** 출처가 밝힌 공시일 (있을 때) */
  publishedAt: isoDate.optional(),
});

export const loanRateInfoSchema = z
  .object({
    productId: z.string().min(1),
    rateType: z.string().min(1),
    range: z
      .object({ minPercent: percent, maxPercent: percent })
      .refine((r) => r.minPercent <= r.maxPercent)
      .optional(),
    table: z
      .object({ basis: z.string(), rows: z.array(z.object({ label: z.string(), percent })).min(1) })
      .optional(),
    termTable: z
      .object({
        publishedAt: isoDate,
        terms: z.array(z.number().int().positive()).min(1),
        series: z.array(z.object({ name: z.string(), percents: z.array(percent).min(1) })).min(1),
      })
      .refine(
        (t) => t.series.every((s) => s.percents.length === t.terms.length),
        '만기 수와 금리 수가 같아야 한다',
      )
      .optional(),
    benchmarks: z
      .array(z.object({ name: z.string(), percent, publishedAt: isoDate, note: z.string().optional() }))
      .optional(),
    adjustments: z.array(z.string()),
    notCovered: z.array(z.string()),
    source: sourceSchema,
  })
  .refine((p) => p.range || p.table || p.termTable || p.benchmarks, '금리 정보가 하나는 있어야 한다');

export const loanRatesSchema = z.object({ checkedAt: isoDate, products: z.array(loanRateInfoSchema) });
export type LoanRateInfo = z.infer<typeof loanRateInfoSchema>;

export const LOAN_RATES = loanRatesSchema.parse(ratesJson);

export function rateInfoFor(productId: string): LoanRateInfo | undefined {
  return LOAN_RATES.products.find((p) => p.productId === productId);
}

/** 확인일로부터 경과 일수 (YYYY-MM-DD 두 날짜, UTC 기준) */
export function daysSince(checkedAt: string, today: string): number {
  return Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${checkedAt}T00:00:00Z`)) / 86_400_000);
}

/** 금리는 월 단위로 바뀌므로 이 일수를 넘으면 오래된 정보로 경고한다 */
export const STALE_AFTER_DAYS = 35;
export const isStale = (checkedAt: string, today: string): boolean =>
  daysSince(checkedAt, today) > STALE_AFTER_DAYS;
