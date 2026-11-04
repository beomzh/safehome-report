import rulesJson from '../../rules.config/rules.v1.json';
import { rulesConfigSchema } from '../core';

/**
 * 룰 설정은 번들에 포함된 JSON을 스키마로 검증해 사용한다.
 * 분석은 브라우저에서 실행되므로 입력 정보가 서버로 전송되지 않는다.
 */
export const rulesConfig = rulesConfigSchema.parse(rulesJson);

/** 잠정(provisional) 값이 하나라도 있으면 리포트에 안내를 표시한다 */
export const hasProvisionalThresholds = [
  rulesConfig.ltv.status,
  rulesConfig.frequentTransfer.status,
  rulesConfig.minParseConfidence.status,
].includes('provisional');
