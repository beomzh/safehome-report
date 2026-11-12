/**
 * 등기사항전부증명서 PDF(텍스트 레이어)를 브라우저 안에서 읽어, 파서가 쓰는 "줄 단위 + 들여쓰기" 텍스트로 바꾼다.
 * PDF 파일은 서버로 보내지 않는다. 순위번호는 표의 왼쪽 열에 있어 줄의 x 좌표를 들여쓰기로 옮겨 주면
 * 파서가 주소·공동담보처럼 오른쪽 열에서 이어지는 줄과 구분할 수 있다.
 */

export interface TextPiece {
  str: string;
  /** PDF 좌표계 왼쪽 끝 */
  x: number;
  /** PDF 좌표계 기준선 (위쪽이 큼) */
  y: number;
  /** 글자 조각의 폭 */
  w: number;
}

/** 한 글자 폭에 해당하는 대략의 pt (들여쓰기·공백 환산용) */
const CHAR_PT = 5.5;
/** 같은 줄로 묶는 y 오차 */
const LINE_TOLERANCE = 3;

/** 한 쪽의 글자 조각을 위에서 아래로, 왼쪽에서 오른쪽으로 읽어 줄 목록으로 만든다 (순수 함수) */
export function layoutLines(pieces: TextPiece[]): string[] {
  const items = pieces.filter((p) => p.str.trim() !== '');
  if (items.length === 0) return [];
  const left = Math.min(...items.map((p) => p.x));
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: TextPiece[][] = [];
  for (const p of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs((line[0] as TextPiece).y - p.y) <= LINE_TOLERANCE) line.push(p);
    else lines.push([p]);
  }
  return lines.map((line) => {
    const row = [...line].sort((a, b) => a.x - b.x);
    let out = ' '.repeat(Math.max(0, Math.round(((row[0] as TextPiece).x - left) / CHAR_PT)));
    let end = 0;
    row.forEach((p, i) => {
      if (i > 0) {
        const gap = p.x - end;
        out += gap > 2 ? ' '.repeat(Math.max(1, Math.round(gap / CHAR_PT))) : '';
      }
      out += p.str;
      end = p.x + p.w;
    });
    return out.trimEnd();
  });
}

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 30;

export type PdfReadResult =
  | { ok: true; text: string; pages: number }
  | { ok: false; reason: 'too_large' | 'too_many_pages' | 'no_text' | 'password' | 'invalid' };

/** PDF 파일을 읽어 텍스트로 바꾼다. 텍스트 레이어가 없는 스캔본은 no_text */
export async function extractPdfText(data: ArrayBuffer): Promise<PdfReadResult> {
  if (data.byteLength > MAX_PDF_BYTES) return { ok: false, reason: 'too_large' };
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
    if (doc.numPages > MAX_PDF_PAGES) return { ok: false, reason: 'too_many_pages' };
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const pieces: TextPiece[] = [];
      for (const it of content.items) {
        if (!('str' in it)) continue;
        const t = it.transform as number[];
        pieces.push({ str: it.str, x: t[4] ?? 0, y: t[5] ?? 0, w: it.width });
      }
      pages.push(layoutLines(pieces).join('\n'));
    }
    await doc.destroy();
    const text = pages.join('\n\n');
    if (text.replace(/\s+/g, '').length < 30) return { ok: false, reason: 'no_text' };
    return { ok: true, text, pages: pages.length };
  } catch (e) {
    return {
      ok: false,
      reason: (e as { name?: string })?.name === 'PasswordException' ? 'password' : 'invalid',
    };
  }
}

export const PDF_ERROR_TEXT: Record<Exclude<PdfReadResult, { ok: true }>['reason'], string> = {
  too_large: 'PDF 가 너무 큽니다 (10MB 이하).',
  too_many_pages: `PDF 쪽수가 너무 많습니다 (${MAX_PDF_PAGES}쪽 이하).`,
  no_text:
    '이 PDF 에서 글자를 읽지 못했습니다. 스캔본(이미지)은 지원하지 않습니다. 인터넷등기소에서 발급한 PDF 인지 확인하세요.',
  password: '암호가 걸린 PDF 는 읽을 수 없습니다.',
  invalid: 'PDF 를 읽지 못했습니다. 파일이 손상되었거나 PDF 가 아닙니다.',
};
