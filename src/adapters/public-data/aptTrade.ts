import { rentRecordSchema, tradeRecordSchema } from '../../core';
import type { RentRecord, TradeRecord } from '../../core';

/** 공공데이터포털 API 오류. code 는 응답에 담긴 오류 코드(예: 22 = 일일 한도 초과) */
export class PublicDataError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'PublicDataError';
  }
}

const ERROR_MESSAGE: Record<string, string> = {
  '10': '요청 변수가 올바르지 않습니다',
  '20': '서비스 접근이 거부되었습니다 (키 확인 필요)',
  '22': '일일 호출 한도를 초과했습니다',
  '23': '초당 호출 한도를 초과했습니다',
  '30': '등록되지 않은 서비스 키입니다',
  '31': '만료된 서비스 키입니다',
};

const tag = (xml: string, name: string): string | undefined => {
  const m = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml);
  return m?.[1];
};

const decodeEntities = (s: string): string =>
  s
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');

export interface ParsedTrades {
  records: TradeRecord[];
  /** 응답의 전체 건수 (페이지 수 계산용) */
  totalCount: number;
  /** 형식이 맞지 않아 건너뛴 항목 수 */
  skipped: number;
}

/** 오류 응답이면 PublicDataError 를 던진다 */
function assertOk(xml: string): void {
  const reasonCode = tag(xml, 'returnReasonCode');
  if (reasonCode !== undefined) {
    const msg = tag(xml, 'returnAuthMsg') ?? tag(xml, 'errMsg') ?? '';
    throw new PublicDataError(
      `${ERROR_MESSAGE[reasonCode] ?? '공공데이터 API 오류'} (${reasonCode}${msg ? `: ${msg}` : ''})`,
      reasonCode,
    );
  }
  const resultCode = tag(xml, 'resultCode');
  if (resultCode === undefined) throw new PublicDataError('인식할 수 없는 응답 형식입니다');
  if (resultCode !== '000') {
    throw new PublicDataError(
      `${ERROR_MESSAGE[resultCode] ?? '공공데이터 API 오류'} (${resultCode}: ${tag(xml, 'resultMsg') ?? ''})`,
      resultCode,
    );
  }
}

/**
 * 아파트 매매 실거래 응답(XML)을 정규화한다.
 * 실제 응답(2025-10, 강남구)으로 확인한 필드: dealAmount(만원, 쉼표 포함), excluUseAr(㎡),
 * dealYear/dealMonth/dealDay, aptNm, cdealType(해제 시 값이 채워짐), totalCount.
 */
export function parseAptTradeXml(xml: string): ParsedTrades {
  return parseTradeXml(xml, 'aptNm');
}

/** 단지(건물)명 태그만 다른 매매 실거래 응답을 같은 방식으로 정규화한다 */
export function parseTradeXml(xml: string, nameTag: string, areaTag = 'excluUseAr'): ParsedTrades {
  assertOk(xml);

  const records: TradeRecord[] = [];
  let skipped = 0;
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = m[1] ?? '';
    const amountMan = Number((tag(item, 'dealAmount') ?? '').replace(/[,\s]/g, ''));
    const year = tag(item, 'dealYear')?.trim();
    const month = tag(item, 'dealMonth')?.trim().padStart(2, '0');
    const day = (tag(item, 'dealDay')?.trim() || '1').padStart(2, '0');
    const candidate = {
      amountWon: amountMan * 10_000,
      areaM2: Number(tag(item, areaTag)),
      dealDate: `${year}-${month}-${day}`,
      complexName: decodeEntities((tag(item, nameTag) ?? '').trim()) || undefined,
      dongName: decodeEntities((tag(item, 'umdNm') ?? '').trim()) || undefined,
      cancelled: (tag(item, 'cdealType') ?? '').trim() !== '',
    };
    const parsed = tradeRecordSchema.safeParse(candidate);
    if (parsed.success) records.push(parsed.data);
    else skipped += 1;
  }
  return { records, totalCount: Number(tag(xml, 'totalCount') ?? records.length), skipped };
}

export interface ParsedRents {
  records: RentRecord[];
  totalCount: number;
  skipped: number;
}

/**
 * 전월세 실거래 응답(XML)을 정규화한다. 실제 응답(2026-11-12)으로 확인한 필드:
 * deposit·monthlyRent(만원, 쉼표 포함, 전세는 월세 0), 면적(excluUseAr 또는 단독다가구 totalFloorAr),
 * dealYear/Month/Day, contractType(신규·갱신·공백), umdNm, 건물명(aptNm·offiNm·mhouseNm).
 */
export function parseRentXml(xml: string, nameTag: string, areaTag = 'excluUseAr'): ParsedRents {
  assertOk(xml);
  const records: RentRecord[] = [];
  let skipped = 0;
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = m[1] ?? '';
    const man = (name: string) => Number((tag(item, name) ?? '').replace(/[,\s]/g, '') || '0');
    const year = tag(item, 'dealYear')?.trim();
    const month = tag(item, 'dealMonth')?.trim().padStart(2, '0');
    const day = (tag(item, 'dealDay')?.trim() || '1').padStart(2, '0');
    const parsed = rentRecordSchema.safeParse({
      depositWon: man('deposit') * 10_000,
      monthlyRentWon: man('monthlyRent') * 10_000,
      areaM2: Number(tag(item, areaTag)),
      dealDate: `${year}-${month}-${day}`,
      complexName: decodeEntities((tag(item, nameTag) ?? '').trim()) || undefined,
      dongName: decodeEntities((tag(item, 'umdNm') ?? '').trim()) || undefined,
      renewal: (tag(item, 'contractType') ?? '').trim() === '갱신',
    });
    if (parsed.success) records.push(parsed.data);
    else skipped += 1;
  }
  return { records, totalCount: Number(tag(xml, 'totalCount') ?? records.length), skipped };
}
