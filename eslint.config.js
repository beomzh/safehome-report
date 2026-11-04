import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', '.next', 'next-env.d.ts'] },
  ...tseslint.configs.recommended,
  {
    // core는 순수 로직: 어댑터·웹·MCP·파일시스템에 의존하지 않는다 (docs/adr/0003)
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            'fs',
            'node:fs',
            'node:fs/promises',
            'path',
            'node:path',
            'child_process',
            'node:child_process',
          ].map((name) => ({ name, message: 'core는 I/O 모듈을 import할 수 없다 (ADR-0003)' })),
          patterns: [
            {
              group: ['**/adapters/**', '**/web/**', '**/mcp/**'],
              message: 'core는 adapters/web/mcp에 의존할 수 없다 (ADR-0003)',
            },
          ],
        },
      ],
    },
  },
);
