import type { ZodType } from 'zod';

/** LLM 호출 오류. 메시지에는 엔드포인트 주소·키·모델명을 담지 않는다 */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly kind: 'config' | 'http' | 'timeout' | 'format' | 'schema' | 'incomplete',
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export interface GenerateRequest<T> {
  system: string;
  /** 사용자 입력(신뢰할 수 없는 외부 텍스트를 포함할 수 있음) */
  input: string;
  schema: ZodType<T>;
  /** 구조화 출력 스키마 이름 (영문·숫자·밑줄) */
  schemaName: string;
  maxOutputTokens?: number;
}

/** 검증된 JSON 만 돌려주는 LLM 공급자 (ADR-0005). 판정에는 쓰지 않는다 (ADR-0003) */
export interface LlmProvider {
  readonly name: string;
  generate<T>(req: GenerateRequest<T>): Promise<T>;
}
