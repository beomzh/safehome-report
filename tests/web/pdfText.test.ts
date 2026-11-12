import { describe, expect, it } from 'vitest';
import { layoutLines } from '../../src/web/pdfText';
import type { TextPiece } from '../../src/web/pdfText';
import { parseRegistryText } from '../../src/core';

const p = (str: string, x: number, y: number, w = str.length * 8): TextPiece => ({ str, x, y, w });

describe('layoutLines', () => {
  it('위에서 아래, 왼쪽에서 오른쪽으로 읽고 같은 줄의 조각을 잇는다', () => {
    const lines = layoutLines([
      p('근저당권설정', 100, 600),
      p('1', 55, 600),
      p('2번말소', 100, 560),
      p('2', 55, 560),
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/1\s+근저당권설정/);
    expect(lines[1]).toMatch(/2\s+2번말소/);
  });

  it('y 가 조금 어긋나도 같은 줄로 묶는다', () => {
    expect(layoutLines([p('가', 50, 500), p('나', 70, 502)])).toHaveLength(1);
  });

  it('왼쪽 열은 들여쓰기가 작고 오른쪽 열에서 이어지는 줄은 크다', () => {
    const lines = layoutLines([p('1', 55, 700), p('소유권보존', 100, 700), p('서울특별시 가상구', 330, 680)]);
    const indent = (s: string) => s.length - s.trimStart().length;
    expect(indent(lines[0] as string)).toBeLessThanOrEqual(12);
    expect(indent(lines[1] as string)).toBeGreaterThan(12);
  });

  it('빈 조각은 무시하고 조각이 없으면 빈 목록', () => {
    expect(layoutLines([p('  ', 50, 500)])).toEqual([]);
    expect(layoutLines([])).toEqual([]);
  });

  it('이 변환의 출력을 파서가 읽을 수 있다 (순위는 왼쪽, 주소·공동담보는 오른쪽 열)', () => {
    // 가상 문서: PDF 좌표 형태의 조각으로 갑구·을구를 만든다 (실제 인물·주소 아님)
    const rows: [number, TextPiece[]][] = [
      [800, [p('【 갑 구 】', 200, 800)]],
      [
        770,
        [
          p('1', 55, 770),
          p('소유권보존', 100, 770),
          p('2005년3월2일', 215, 770),
          p('소유자 홍가상 700101-*******', 330, 770),
        ],
      ],
      [
        740,
        [
          p('2', 55, 740),
          p('소유권이전', 100, 740),
          p('2012년6월20일', 215, 740),
          p('소유자 김예시 750505-*******', 330, 740),
        ],
      ],
      [700, [p('【 을 구 】', 200, 700)]],
      [
        670,
        [
          p('1', 55, 670),
          p('근저당권설정', 100, 670),
          p('2012년6월20일', 215, 670),
          p('채권최고액 금240,000,000원', 330, 670),
        ],
      ],
      [650, [p('공동담보 토지 서울특별시 가상구 예시동', 330, 650)]],
      [630, [p('12-34 김예시지분', 330, 630)]],
      [600, [p('2', 55, 600), p('1번근저당권설정등', 100, 600), p('2020년2월27일', 215, 600)]],
      [580, [p('기말소', 100, 580), p('해지', 330, 580)]],
    ];
    const text = layoutLines(rows.flatMap(([, ps]) => ps)).join('\n');
    const r = parseRegistryText(text);
    expect(r.ok).toBe(true);
    expect(r.facts?.owners).toEqual([{ name: '김예시' }]);
    expect(r.facts?.eul.map((e) => [e.rank, e.maxClaimAmount, e.cancelled])).toEqual([
      ['1', 240_000_000, true],
    ]);
  });
});
