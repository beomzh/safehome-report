import { describe, expect, it } from 'vitest';
import { createLogger } from '../../src/adapters/log/logger';
import type { LogLevel } from '../../src/adapters/log/logger';

function capture(opts: Parameters<typeof createLogger>[0] = {}) {
  const lines: { level: LogLevel; obj: Record<string, unknown> }[] = [];
  const logger = createLogger({
    now: () => new Date('2026-11-09T10:00:00Z'),
    write: (level, line) => lines.push({ level, obj: JSON.parse(line) }),
    ...opts,
  });
  return { logger, lines };
}

describe('logger', () => {
  it('한 줄 JSON 에 시각·레벨·태그·이벤트·필드를 담는다', () => {
    const { logger, lines } = capture();
    logger.info('MARKET', 'lookup_ok', { req: 'abc12345', ms: 120, samples: 17 });
    expect(lines[0]!.obj).toEqual({
      ts: '2026-11-09T10:00:00.000Z',
      level: 'info',
      tag: 'MARKET',
      event: 'lookup_ok',
      req: 'abc12345',
      ms: 120,
      samples: 17,
    });
  });

  it('최소 레벨 미만은 남기지 않는다', () => {
    const { logger, lines } = capture({ level: 'warn' });
    logger.debug('X', 'a');
    logger.info('X', 'b');
    logger.warn('X', 'c');
    logger.error('X', 'd');
    expect(lines.map((l) => l.obj.event)).toEqual(['c', 'd']);
  });

  it('금지된 이름의 필드(키·텍스트·성명·금액 등)는 값을 남기지 않는다', () => {
    const { logger, lines } = capture();
    logger.info('LISTING', 'extract_ok', {
      apiKey: 'sk-secret',
      listingText: '삼성동 전세 3억',
      ownerName: '홍길동',
      amountWon: 300_000_000,
      annualIncome: 60_000_000,
      address: '서울 강남구',
      chars: 312,
    });
    const o = lines[0]!.obj;
    for (const k of ['apiKey', 'listingText', 'ownerName', 'amountWon', 'annualIncome', 'address']) {
      expect(o[k]).toBe('<omitted>');
    }
    expect(o.chars).toBe(312);
    expect(JSON.stringify(o)).not.toMatch(/sk-secret|삼성동|홍길동|300000000/);
  });

  it('알려진 시크릿 값이 문자열에 섞여 있으면 가린다', () => {
    const { logger, lines } = capture({ secrets: ['SUPER-SECRET-KEY', 'https://llm.example.test/v1'] });
    logger.error('LLM', 'failed', {
      reason: 'fetch failed at https://llm.example.test/v1 with SUPER-SECRET-KEY',
    });
    expect(String(lines[0]!.obj.reason)).toBe('fetch failed at <redacted> with <redacted>');
  });

  it('긴 문자열은 200자로 자르고 undefined 필드는 생략한다', () => {
    const { logger, lines } = capture();
    logger.info('X', 'long', { note: 'a'.repeat(500), skip: undefined });
    expect(String(lines[0]!.obj.note).length).toBe(201);
    expect('skip' in lines[0]!.obj).toBe(false);
  });

  it('warn·error 는 오류 출력 채널로 구분되어 전달된다', () => {
    const { logger, lines } = capture();
    logger.warn('X', 'w');
    logger.error('X', 'e');
    expect(lines.map((l) => l.level)).toEqual(['warn', 'error']);
  });
});
