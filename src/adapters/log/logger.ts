/**
 * 구조화 로그 (한 줄 JSON, stdout/stderr). `docker compose logs -f web` 로 본다.
 *
 * 개인정보·시크릿 보호 원칙: 매물 텍스트, 성명, 금액, 재무 정보, 키·주소·모델명은 남기지 않는다.
 * 남기는 것은 이벤트 이름, 결과, 소요 시간, 건수, 오류 종류, 요청 번호 같은 운영 정보뿐이다.
 * 방어 장치로 문자열은 200자로 자르고, 알려진 시크릿 값이 포함되면 가린다.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, string | number | boolean | null | undefined>;

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
/** 이 이름이 들어간 필드는 값을 남기지 않는다 */
const FORBIDDEN_KEY = /(key|token|secret|password|authorization|text|name|amount|income|asset|address)/i;

export interface LoggerOptions {
  level?: LogLevel;
  /** 로그에 포함되면 안 되는 값(키·주소 등). 문자열에서 발견되면 <redacted> 로 바꾼다 */
  secrets?: readonly (string | undefined)[];
  write?: (level: LogLevel, line: string) => void;
  now?: () => Date;
}

export interface Logger {
  log(level: LogLevel, tag: string, event: string, fields?: LogFields): void;
  debug(tag: string, event: string, fields?: LogFields): void;
  info(tag: string, event: string, fields?: LogFields): void;
  warn(tag: string, event: string, fields?: LogFields): void;
  error(tag: string, event: string, fields?: LogFields): void;
}

const defaultWrite = (level: LogLevel, line: string) =>
  (level === 'error' || level === 'warn' ? console.error : console.log)(line);

export function createLogger(opts: LoggerOptions = {}): Logger {
  const min = ORDER[opts.level ?? 'info'];
  const secrets = (opts.secrets ?? []).filter((s): s is string => !!s && s.length >= 4);
  const write = opts.write ?? defaultWrite;
  const now = opts.now ?? (() => new Date());

  const clean = (v: LogFields[string]): LogFields[string] => {
    if (typeof v !== 'string') return v;
    let s = v.length > 200 ? `${v.slice(0, 200)}…` : v;
    for (const secret of secrets) s = s.replaceAll(secret, '<redacted>');
    return s;
  };

  const log: Logger['log'] = (level, tag, event, fields = {}) => {
    if (ORDER[level] < min) return;
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      safe[k] = FORBIDDEN_KEY.test(k) ? '<omitted>' : clean(v);
    }
    write(level, JSON.stringify({ ts: now().toISOString(), level, tag, event, ...safe }));
  };
  return {
    log,
    debug: (t, e, f) => log('debug', t, e, f),
    info: (t, e, f) => log('info', t, e, f),
    warn: (t, e, f) => log('warn', t, e, f),
    error: (t, e, f) => log('error', t, e, f),
  };
}

let shared: Logger | undefined;
/** 서버 라우트 공용 로거. LOG_LEVEL(debug|info|warn|error)과 환경변수의 키·주소를 비식별 대상으로 쓴다 */
export function getLogger(): Logger {
  shared ??= createLogger({
    level: (['debug', 'info', 'warn', 'error'] as const).find((l) => l === process.env.LOG_LEVEL) ?? 'info',
    secrets: [
      process.env.PUBLIC_DATA_API_KEY,
      process.env.LLM_API_KEY,
      process.env.LLM_BASE_URL,
      process.env.LLM_MODEL,
    ],
  });
  return shared;
}

export const newRequestId = (): string => crypto.randomUUID().slice(0, 8);
