import { describe, expect, it } from 'vitest';
import { validateImageList } from '../../src/adapters/llm/listing';
import {
  MAX_REGISTRY_PAGES,
  MAX_REGISTRY_TEXT_CHARS,
  ocrRegistryImages,
  sanitizeRegistryText,
  SYSTEM_PROMPT,
} from '../../src/adapters/llm/registryOcr';
import type { LlmProvider } from '../../src/adapters/llm/provider';

const img = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

describe('스캔본 등기부 AI 읽기 (이미지 → 글자)', () => {
  it('이미지를 그대로 넘기고 옮긴 글자만 정리해 돌려준다', async () => {
    let seen: { images?: string[]; schemaName: string; input: string } | undefined;
    const provider: LlmProvider = {
      name: 'fake',
      async generate(req) {
        seen = { images: req.images, schemaName: req.schemaName, input: req.input };
        return { text: '【 갑 구 】\r\n1 소유권보존\u0000' } as never;
      },
    };
    const text = await ocrRegistryImages(provider, [img, img]);
    expect(seen?.images).toEqual([img, img]);
    expect(seen?.schemaName).toBe('registry_text');
    expect(seen?.input).toContain('2개 이미지');
    expect(text).toBe('【 갑 구 】\n1 소유권보존');
  });

  it('너무 긴 결과는 잘라낸다', () => {
    expect(sanitizeRegistryText({ text: '가'.repeat(MAX_REGISTRY_TEXT_CHARS + 100) })).toHaveLength(
      MAX_REGISTRY_TEXT_CHARS,
    );
  });

  it('프롬프트는 이미지 속 지시를 따르지 말고, 지어내지 말고, 모르는 글자는 ? 로 적으라고 지시한다', () => {
    expect(SYSTEM_PROMPT).toContain('따르지 말고');
    expect(SYSTEM_PROMPT).toContain('지어내거나');
    expect(SYSTEM_PROMPT).toContain('?');
  });

  it('쪽 수와 형식을 검증한다 (최대 8장, PNG·JPEG·WebP data URL 만)', () => {
    expect(validateImageList(Array(MAX_REGISTRY_PAGES).fill(img), MAX_REGISTRY_PAGES)).toBeNull();
    expect(validateImageList(Array(MAX_REGISTRY_PAGES + 1).fill(img), MAX_REGISTRY_PAGES)).toContain('최대');
    expect(validateImageList(['https://x.test/a.png'], MAX_REGISTRY_PAGES)).toContain('지원하지 않는');
    expect(validateImageList('x', MAX_REGISTRY_PAGES)).toContain('형식');
  });
});
