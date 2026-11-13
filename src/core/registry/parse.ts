import type { EulEntry, GapEntry, GapEntryType, RegistryFacts } from '../types';

/**
 * 등기사항전부증명서(집합건물)에서 복사한 텍스트를 RegistryFacts 로 바꾼다.
 *
 * 원칙 (ADR-0007, 보수적 동작):
 * - 순수 함수. 네트워크·LLM·로그 없음. 주민등록번호 등 원문은 결과에 담지 않는다 (성명만 추출).
 * - 확실하지 않은 것은 채우지 않고 `warnings` 에 남기며 `parseConfidence` 를 낮춘다.
 * - 말소는 "N번…말소" 행이 있을 때만 인정한다. 취소선만 있는 행은 텍스트로 구분할 수 없으므로 미말소로 본다.
 * - 합성 문서와, 인터넷에 공개된 실제 열람본 2건(집합건물·건물, 로컬에서만 확인·저장소에는 미포함)의 형식으로 검증했다.
 *   실제 문서의 줄바꿈 순서가 다를 수 있어 사용자 확인 단계를 전제로 한다.
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
const ROW_START = /^\s*(\d{1,3}(?:-\d{1,2})?)\s+((?:[가-힣]|\d+(?:-\d+)?\s*번).*)$/;
/** 레이아웃을 유지한 텍스트에서 순위번호는 왼쪽 열에 있다. 이만큼 깊게 들여쓴 줄은 앞 행의 이어지는 내용(주소 등)이다 */
const MAX_RANK_INDENT = 12;

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
    const indent = line.length - line.trimStart().length;
    if (/^[-─=\s]*이\s*하\s*여\s*백/.test(t) || /^--\s*이하/.test(t)) break;
    // 표 머리글
    if (/^순위\s*번호/.test(t) || (/등\s*기\s*목\s*적/.test(t) && /접\s*수/.test(t))) continue;
    const m = indent <= MAX_RANK_INDENT ? ROW_START.exec(t) : null;
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

/**
 * "1번근저당권설정, 2번근저당권설정등기말소" 처럼 말소되는 순위를 뽑는다.
 * 실제 열람본은 "3번근저당권설정등 / 기말소" 처럼 목적란이 줄바꿈되어 '말소'가 접수일 뒤에 나올 수 있어,
 * 목적이 "N번…"으로 시작하는 행은 행 전체에서 '말소'를 찾는다.
 * "말소회복"(말소를 되돌려 권리를 되살리는 등기)은 말소가 아니라 회복이므로 따로 센다.
 */
function referencedRanks(purpose: string): string[] {
  return [...purpose.matchAll(/(\d+(?:-\d+)?)\s*번/g)].map((m) => m[1]!);
}

type CancelKind = 'cancel' | 'recover' | null;

function cancelKind(row: Pick<Row, 'purpose' | 'text'>): CancelKind {
  const { purpose, text } = row;
  const starts = /^\s*\d+(?:-\d+)?\s*번/.test(purpose);
  const mentions = compact(purpose).includes('말소') || (starts && compact(text).includes('말소'));
  if (!mentions || compact(purpose).includes('일부말소') || compact(text).includes('일부말소')) return null;
  if (referencedRanks(purpose).length === 0) return null;
  return compact(purpose).includes('말소회복') || (starts && compact(text).includes('말소회복'))
    ? 'recover'
    : 'cancel';
}

/** 이 행이 말소(해지)·말소회복 행인가 — 목적란이 줄바꿈되어도 인식한다 */
function isCancelRow(row: Pick<Row, 'purpose' | 'text'>): boolean {
  return cancelKind(row) !== null || compact(row.purpose).includes('말소');
}

/** 행 순서대로 말소(추가)와 말소회복(되살림)을 적용해 현재 말소된 순위 집합을 만든다 */
function cancelledSet(
  rows: Row[],
  warnings: string[],
  where: string,
): { set: Set<string>; recovered: boolean } {
  const set = new Set<string>();
  const recovered: string[] = [];
  for (const r of rows) {
    const kind = cancelKind(r);
    if (kind === null) continue;
    const ranks = referencedRanks(r.purpose);
    if (kind === 'recover') {
      for (const c of ranks) set.delete(c);
      recovered.push(...ranks);
    } else for (const c of ranks) set.add(c);
  }
  if (recovered.length > 0)
    warnings.push(
      `${where} 순위 ${[...new Set(recovered)].join('·')}번에 말소회복 등기가 있습니다. 말소됐던 권리가 되살아났을 수 있으니 원문에서 직접 확인하세요.`,
    );
  return { set, recovered: recovered.length > 0 };
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
  // 등기명의인의 성명·주소만 바뀐 부기등기 (소유권 변동 아님)
  if (/명의인표시/.test(p)) return 'ignore';
  if (p.includes('소유권보존')) return 'owner_origin';
  if (p.includes('가등기') && !p.includes('본등기')) return 'provisional_registration';
  if (p.includes('신탁') || (p.includes('소유권이전') && /신탁원부|수탁자/.test(text))) return 'trust';
  // 집합건물은 '소유권이전', 건물·토지 공유는 '공유자전원지분전부이전' 처럼 적는다 (실제 열람본 형식)
  if (p.includes('소유권이전') || /지분전부이전|지분이전|전원지분/.test(p)) return 'ownership_transfer';
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
  const gapCancel = cancelledSet(gapRows, warnings, '갑구');
  const cancelled = gapCancel.set;

  let unrecognized = 0;
  for (const r of gapRows) {
    const t = isCancelRow(r) ? 'ignore' : gapType(r.purpose, r.text);
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
    if (t === 'provisional_registration') {
      warnings.push(
        `갑구 순위 ${r.rank}: 가등기가 있습니다. 본등기로 바뀌면 소유권을 잃을 수 있으니 원인과 말소 여부를 원문에서 확인하세요.`,
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

  // 공유지분 일부만 이전된 등기는 남은 공동소유자를 마지막 행만으로 알 수 없다
  const partialShare = gapRows.some((r) => {
    const c = compact(r.purpose);
    return !isCancelRow(r) && /지분이전|일부이전/.test(c) && !/전부이전/.test(c) && !cancelled.has(r.rank);
  });
  if (partialShare) {
    confidence -= 0.3;
    warnings.push(
      '공유지분 일부가 이전된 등기가 있습니다. 현재 공동소유자와 지분을 이 도구가 모두 확인하지 못했을 수 있으니 소유자 전원과 지분을 원문에서 확인하세요.',
    );
  }

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
    const eulCancel = cancelledSet(eulRows, warnings, '을구');
    const eulCancelled = eulCancel.set;
    if (gapCancel.recovered || eulCancel.recovered) confidence -= 0.2;
    // 을구 제목은 있는데 행이 없고 "기록사항 없음"도 없으면 내용이 빠졌을 수 있다
    if (eulRows.length === 0 && !/기록사항없음/.test(compact(eulLines.join('\n')))) {
      confidence -= 0.2;
      warnings.push(
        '을구에서 등기 행을 인식하지 못했고 "기록사항 없음"도 없습니다. 내용이 빠졌을 수 있으니 확인하세요.',
      );
    }
    for (const r of eulRows) {
      const p = compact(r.purpose);
      if (isCancelRow(r)) continue;
      const isCancelled = eulCancelled.has(r.rank);
      const registeredAt = isoDate(r.text);
      if (/전세권.*근저당|임차권.*근저당/.test(p)) {
        // 전세권·임차권을 담보로 잡은 근저당은 임차인의 권리에 대한 담보라 건물의 선순위 채권이 아니다
        eul.push({ rank: r.rank, type: 'other', registeredAt, cancelled: isCancelled });
      } else if (p.includes('근저당권설정')) {
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
      } else if (p.includes('임차권')) {
        // 주택임차권(임차권등기명령): 이전 임차인이 보증금을 돌려받지 못했다는 신호
        const am = /(?:전세금|임차보증금)\s*금?\s*([\d,]+)\s*원/.exec(r.text);
        eul.push({
          rank: r.rank,
          type: 'lease_registration',
          maxClaimAmount: am ? Number(am[1]!.replace(/,/g, '')) : undefined,
          registeredAt,
          cancelled: isCancelled,
        });
      } else if (p.includes('전세권')) {
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
