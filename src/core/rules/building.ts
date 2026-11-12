import { RULE_VERSION } from './helpers';
import type { Rule } from './helpers';
import type { BuildingEntry } from '../types';

/** 건축물대장 주용도를 거칠게 분류한다 (건축법 시행령 별표 1 의 용도 구분 기준, 잠정) */
export type UseClass = 'residential' | 'neighborhood' | 'office' | 'other';

export function classifyPurpose(e: BuildingEntry): UseClass {
  const text = `${e.mainPurpose} ${e.etcPurpose ?? ''}`;
  if (/근린생활/.test(e.mainPurpose)) return 'neighborhood';
  if (/(단독주택|공동주택|다가구|다세대|연립|아파트)/.test(e.mainPurpose)) return 'residential';
  if (/업무시설/.test(e.mainPurpose) || /오피스텔/.test(text)) return 'office';
  return 'other';
}

/**
 * R-BLD-02: 건축물대장상 용도 확인 (주거 목적 계약 기준).
 * 위반건축물 여부는 이 API 에 없어 판정하지 않는다(R-BLD-01 은 대장 열람 화면에서 확인).
 * 건축물대장이 없으면 판단 보류지만 severity 를 info 로 두어 종합 등급에는 영향을 주지 않는다.
 * 주용도 근린생활시설은 주택이 아니라 주거용 계약 시 대출·보증보험·전입신고에 문제가 생길 수 있어 red,
 * 한 지번에 주거·근생 건물이 섞여 있으면 어느 건물인지 확인이 필요해 yellow 로 둔다.
 */
export const buildingUse: Rule = ({ input }) => {
  const id = 'R-BLD-02';
  const title = '건축물대장상 용도 (주거 목적 계약)';
  const base = { ruleId: id, ruleVersion: RULE_VERSION, title };
  const list = input.building;
  if (!list || list.length === 0) {
    return {
      ...base,
      status: 'unknown',
      severity: 'info',
      evidence: ['건축물대장 정보 없음 (시세 조회 아래 "건축물대장으로 용도 확인" 사용)'],
      action:
        '건축물대장(건축HUB·정부24)에서 주용도가 주택인지 확인하세요. 위반건축물 표시도 그곳에서 확인합니다.',
    };
  }
  const classes = list.map(classifyPurpose);
  const evidence = list.map(
    (e) => `${e.label}: 주용도 ${e.mainPurpose}${e.etcPurpose?.trim() ? ` (${e.etcPurpose.trim()})` : ''}`,
  );
  const has = (c: UseClass) => classes.includes(c);
  const data = { classes: classes.join(',') };

  if (has('neighborhood') && !has('residential')) {
    return {
      ...base,
      status: 'triggered',
      severity: 'red',
      evidence,
      data,
      action:
        '주용도가 근린생활시설이라 주택이 아닙니다. 주거용으로 계약하면 전세대출·보증보험이 거절되거나 전입신고에 문제가 생길 수 있습니다. 용도와 실제 사용 현황을 건축물대장·구청에서 확인하세요.',
    };
  }
  if (has('neighborhood')) {
    return {
      ...base,
      status: 'triggered',
      severity: 'yellow',
      evidence,
      data,
      action:
        '같은 지번에 주택과 근린생활시설 건물이 함께 있습니다. 계약할 건물이 어느 쪽인지 건축물대장의 동·호 정보로 확인하세요.',
    };
  }
  if (has('office') && !has('residential')) {
    return {
      ...base,
      status: 'info',
      severity: 'info',
      evidence,
      data,
      action:
        '업무시설(오피스텔 등)입니다. 주거 목적이면 전입신고·전세대출·보증보험 가능 여부와 주택 수 산정 여부를 확인하세요.',
    };
  }
  if (has('other') && !has('residential')) {
    return {
      ...base,
      status: 'triggered',
      severity: 'yellow',
      evidence,
      data,
      action: '주용도가 주택이 아닙니다. 주거용으로 계약해도 되는 건물인지 건축물대장으로 확인하세요.',
    };
  }
  return { ...base, status: 'clear', severity: 'red', evidence, data };
};
