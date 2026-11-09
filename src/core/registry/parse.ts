import type { EulEntry, GapEntry, GapEntryType, RegistryFacts } from '../types';

/**
 * 등기사항전부증명서(집합건물)에서 복사한 텍스트를 RegistryFacts 로 바꾼다.
 *
 * 원칙 (ADR-0007, 보수적 동작):
 * - 순수 함수. 네트워크·LLM·로그 없음. 주민등록번호 등 원문은 결과에 담지 않는다 (성명만 추출).
 * - 확실하지 않은 것은 채우지 않고 `warnings` 에 남기며 `parseConfidence` 를 낮춘다.
 * - 말소는 "N번…말소" 행이 있을 때만 인정한다. 취소선만 있는 행은 텍스트로 구분할 수 없으므로 미말소로 본다.
 * - 합성 문서로만 검증했다. 실제 문서의 줄바꿈 순서가 다를 수 있어 사용자 확인 단계를 전제로 한다.
 */

export interface RegistryParseResult {
  ok: boolean;
  /** ok=false 일 때 사유 */
  error?: string;
  facts?: RegistryFacts;
  /** 사용자가 원문과 대조해야 할 항목 */
  warnings: string[];
}

interface Row {
  rank: string;
  /** 순위번호를 뺀 행 전체 텍스트 (줄바꿈은 공백으로) */
  text: string;
  /** 접수일 앞까지의 등기목적 */
  purpose: string;
}

const DATE_RE = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
const ROW_START = /^\s*(\d+(?:-\d+)?)\s+((?:[가-힣]|\d+(?:-\d+)?\s*번).*)$/;

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const compact = (s: string): string => s.replace(/\s+/g, '');

function isoDate(text: string): string | undefined {
  const m = DATE_RE.exec(text);
  if (!m) return undefined;
  const [y, mo, d] = [m[1]!, m[2]!.padStart(2, '0'), m[3]!.padStart(2, '0')];
  const iso = `${y}-${mo}-${d}`;
  const t = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === iso ? iso : undefined;
}

/** 【 갑 구 】 처럼 글자 사이에 공백이 있는 제목을 찾는다 */
function findHeading(lines: string[], name: '갑구' | '을구'): number {
  return lines.findIndex((l) => {
    const c = compact(l);
    return c.startsWith(`【${name}】`) || c.startsWith(`[${name}]`);
  });
}

function rowsOf(lines: string[]): Row[] {
  const rows: { rank: string; parts: string[] }[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^[-─=\s]*이\s*하\s*여\s*백/.test(t) || /^--\s*이하/.test(t)) break;
    // 표 머리글
    if (/^순위\s*번호/.test(t) || (/등\s*기\s*목\s*적/.test(t) && /접\s*수/.test(t))) continue;
    const m = ROW_START.exec(t);
    if (m) rows.push({ rank: m[1]!, parts: [m[2]!] });
    else if (rows.length > 0) rows[rows.length - 1]!.parts.push(t);
  }
  return rows.map((r) => {
    const text = norm(r.parts.join(' '));
    const d = DATE_RE.exec(text);
    const purpose = norm(d ? text.slice(0, d.index) : text.slice(0, 30));
    return { rank: r.rank, text, purpose };
  });
}

/** "1번근저당권설정, 2번근저당권설정등기말소" 처럼 말소되는 순위를 뽑는다 */
function cancelledRanks(purpose: string): string[] {
  if (!compact(purpose).includes('말소') || compact(purpose).includes('일부말소')) return [];
  return [...purpose.matchAll(/(\d+(?:-\d+)?)\s*번/g)].map((m) => m[1]!);
}

function ownerNames(text: string): string[] {
  const names: string[] = [];
  // 공유자 지분 2분의 1 홍길동 800101-*******
  for (const m of text.matchAll(/공유자\s+지분\s+\S+\s+([가-힣]{2,20})/g)) names.push(m[1]!);
  if (names.length > 0) return names;
  const m =
    /소유자\s+(.+?)\s+(?:\d{6}\s*[-*]|\*{6}|\d{6}\s)/.exec(text) ??
    /소유자\s+([가-힣]{2,4})(?=\s|$)/.exec(text);
  return m ? [norm(m[1]!)] : [];
}

function gapType(purpose: string, text: string): GapEntryType | 'owner_origin' | 'ignore' {
  const p = compact(purpose);
  if (p.includes('말소')) return 'ignore';
  if (p.includes('소유권보존')) return 'owner_origin';
  if (p.includes('가등기')) return 'other';
  if (p.includes('신탁') || (p.includes('소유권이전') && /신탁원부|수탁자/.test(text))) return 'trust';
  if (p.includes('소유권이전')) return 'ownership_transfer';
  if (p.includes('가압류')) return 'provisional_seizure';
  if (p.includes('가처분')) return 'provisional_disposition';
  if (p.includes('경매개시결정') || p.includes('임의경매') || p.includes('강제경매')) return 'auction_start';
  if (p.includes('임차권등기') || p.includes('주택임차권')) return 'lease_registration_order';
  if (p.includes('압류')) return 'seizure';
  return 'other';
}

export function parseRegistryText(raw: string): RegistryParseResult {
  const warnings: string[] = [];
  const lines = raw.split(/\r?\n/);
  const gapAt = findHeading(lines, '갑구');
  const eulAt = findHeading(lines, '을구');

  if (gapAt < 0) {
    return {
      ok: false,
      error:
        '갑구(소유권에 관한 사항)를 찾지 못했습니다. 등기사항전부증명서 PDF 전체를 복사했는지 확인하세요.',
      warnings,
    };
  }

  let confidence = 1;
  const gapLines = lines.slice(gapAt + 1, eulAt > gapAt ? eulAt : undefined);
  const eulLines = eulAt >= 0 ? lines.slice(eulAt + 1) : [];
  if (eulAt < 0) {
    confidence -= 0.5;
    warnings.push(
      '을구(소유권 이외의 권리) 제목을 찾지 못했습니다. 근저당 정보는 인식하지 못했으니 직접 확인하세요.',
    );
  }

  // ---- 갑구
  const gapRows = rowsOf(gapLines);
  const gap: GapEntry[] = [];
  const ownerRows: { rank: string; names: string[] }[] = [];
  const cancelled = new Set<string>();
  for (const r of gapRows) for (const c of cancelledRanks(r.purpose)) cancelled.add(c);

  let unrecognized = 0;
  for (const r of gapRows) {
    const t = gapType(r.purpose, r.text);
    if (t === 'ignore') continue;
    const isCancelled = cancelled.has(r.rank);
    const registeredAt = isoDate(r.text);
    if (t === 'owner_origin') {
      if (!isCancelled) ownerRows.push({ rank: r.rank, names: ownerNames(r.text) });
      gap.push({ rank: r.rank, type: 'other', registeredAt, cancelled: isCancelled });
      continue;
    }
    if (t === 'ownership_transfer') {
      if (!isCancelled) ownerRows.push({ rank: r.rank, names: ownerNames(r.text) });
    }
    if (t === 'other') {
      unrecognized += 1;
      warnings.push(
        `갑구 순위 ${r.rank} “${r.purpose}” 은(는) 자동 판정 대상이 아닙니다. 원문에서 직접 확인하세요.`,
      );
    }
    if (t === 'trust') {
      warnings.push(
        `갑구 순위 ${r.rank}: 신탁 관련 등기가 있습니다. 신탁원부와 말소 여부를 원문에서 확인하세요.`,
      );
      // 신탁 중에는 수탁자가 등기상 소유자다
      const tm = /수탁자\s+(\S+)/.exec(r.text);
      if (tm && !isCancelled) ownerRows.push({ rank: r.rank, names: [tm[1]!] });
    }
    gap.push({ rank: r.rank, type: t, registeredAt, cancelled: isCancelled });
  }
  if (unrecognized > 0) confidence -= Math.min(0.3, 0.1 * unrecognized);

  const lastOwner = ownerRows[ownerRows.length - 1];
  const owners = (lastOwner?.names ?? []).map((name) => ({ name }));
  if (owners.length === 0) {
    confidence -= 0.3;
    warnings.push('현재 소유자 성명을 인식하지 못했습니다. 직접 입력하세요.');
  }
  if (gapRows.length === 0) {
    confidence -= 0.4;
    warnings.push('갑구에서 등기 행을 하나도 인식하지 못했습니다. 붙여넣은 내용이 맞는지 확인하세요.');
  }

  // ---- 을구
  const eul: EulEntry[] = [];
  if (eulAt >= 0) {
    const eulRows = rowsOf(eulLines);
    const eulCancelled = new Set<string>();
    for (const r of eulRows) for (const c of cancelledRanks(r.purpose)) eulCancelled.add(c);
    for (const r of eulRows) {
      const p = compact(r.purpose);
      if (p.includes('말소')) continue;
      const isCancelled = eulCancelled.has(r.rank);
      const registeredAt = isoDate(r.text);
      if (p.includes('근저당권설정')) {
        const am = /채권최고액\s*금?\s*([\d,]+)\s*원/.exec(r.text);
        const amount = am ? Number(am[1]!.replace(/,/g, '')) : undefined;
        if (amount === undefined || !Number.isSafeInteger(amount)) {
          confidence -= 0.2;
          warnings.push(`을구 순위 ${r.rank}: 근저당 채권최고액을 인식하지 못했습니다. 직접 입력하세요.`);
          eul.push({ rank: r.rank, type: 'mortgage', registeredAt, cancelled: isCancelled });
        } else {
          eul.push({
            rank: r.rank,
            type: 'mortgage',
            maxClaimAmount: amount,
            registeredAt,
            cancelled: isCancelled,
          });
        }
      } else if (p.includes('전세권') || p.includes('임차권')) {
        const am = /(?:전세금|임차보증금)\s*금?\s*([\d,]+)\s*원/.exec(r.text);
        eul.push({
          rank: r.rank,
          type: 'lease_right',
          maxClaimAmount: am ? Number(am[1]!.replace(/,/g, '')) : undefined,
          registeredAt,
          cancelled: isCancelled,
        });
      } else {
        if (/변경|이전|양도|가등기|질권/.test(p)) {
          confidence -= 0.1;
          warnings.push(
            `을구 순위 ${r.rank} “${r.purpose}”: 채권최고액·권리자가 달라졌을 수 있습니다. 원문에서 직접 확인하세요.`,
          );
        }
        eul.push({ rank: r.rank, type: 'other', registeredAt, cancelled: isCancelled });
      }
    }
  }

  const facts: RegistryFacts = {
    owners,
    gap,
    eul,
    parseConfidence: Math.max(0, Math.round(confidence * 100) / 100),
  };
  return { ok: true, facts, warnings };
}
