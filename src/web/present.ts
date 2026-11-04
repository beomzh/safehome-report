import type { Grade, RuleResult } from '../core';

export interface GradeInfo {
  label: string;
  /** CSS 클래스 접미사 (색에만 의존하지 않도록 아이콘·문구를 함께 쓴다) */
  tone: 'red' | 'yellow' | 'green' | 'gray';
  icon: string;
  headline: string;
  guidance: string;
}

export function gradeInfo(grade: Grade): GradeInfo {
  switch (grade) {
    case 'red':
      return {
        label: '위험',
        tone: 'red',
        icon: '⛔',
        headline: '위험 신호가 발견되었습니다',
        guidance:
          '계약금 지급 등 계약을 진행하기 전에 아래 위험 신호를 먼저 확인하고 전문가와 상담하길 강력히 권장합니다.',
      };
    case 'yellow':
      return {
        label: '주의',
        tone: 'yellow',
        icon: '⚠️',
        headline: '주의가 필요한 항목이 있습니다',
        guidance: '아래 항목을 확인하고 필요한 서류·조건을 보완한 뒤 계약 진행 여부를 판단하세요.',
      };
    case 'green':
      return {
        label: '탐지된 위험 신호 없음',
        tone: 'green',
        icon: '✅',
        headline: '입력한 정보에서는 위험 신호가 탐지되지 않았습니다',
        guidance: '안전을 보증하는 결과가 아닙니다. 계약 당일과 잔금 전에 등기부를 다시 확인하세요.',
      };
    case 'inconclusive':
      return {
        label: '판단 보류',
        tone: 'gray',
        icon: '❔',
        headline: '정보가 부족해 판단을 보류합니다',
        guidance: '등기부 정보나 시세 등 부족한 입력을 보완하면 더 정확히 분석할 수 있습니다.',
      };
  }
}

export interface GroupedResults {
  risks: RuleResult[];
  pending: RuleResult[];
  info: RuleResult[];
  clear: RuleResult[];
}

/** 표시 순서: 위험 신호(red 먼저) → 판단 보류 → 정보·체크리스트 → 이상 없음. not_applicable 은 숨긴다 */
export function groupResults(results: readonly RuleResult[]): GroupedResults {
  const rank = (r: RuleResult) => (r.severity === 'red' ? 0 : r.severity === 'yellow' ? 1 : 2);
  return {
    risks: results.filter((r) => r.status === 'triggered').sort((a, b) => rank(a) - rank(b)),
    pending: results.filter((r) => r.status === 'unknown' && r.severity !== 'info'),
    info: results.filter((r) => r.status === 'info' || (r.status === 'unknown' && r.severity === 'info')),
    clear: results.filter((r) => r.status === 'clear'),
  };
}

/** 350,000,000 → "3억 5,000만원" */
export function formatWon(won: number): string {
  if (won === 0) return '0원';
  const eok = Math.floor(won / 100_000_000);
  const man = Math.floor((won % 100_000_000) / 10_000);
  const rest = won % 10_000;
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man > 0) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (rest > 0) parts.push(`${rest.toLocaleString('ko-KR')}`);
  return `${parts.join(' ')}원`;
}
