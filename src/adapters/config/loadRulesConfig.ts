import { readFileSync } from 'node:fs';
import { rulesConfigSchema } from '../../core/config';
import type { RulesConfig } from '../../core/config';

/** rules.config/*.json 을 읽어 스키마 검증 후 반환한다 (파일 I/O는 adapters 계층의 책임) */
export function loadRulesConfig(
  path = new URL('../../../rules.config/rules.v1.json', import.meta.url),
): RulesConfig {
  return rulesConfigSchema.parse(JSON.parse(readFileSync(path, 'utf-8')));
}
