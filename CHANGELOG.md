[2026-11-04 18:10]
- [Added] - package.json, next.config.ts, tsconfig.json: Next.js(App Router) 의존성과 dev/build/start 스크립트, standalone 출력 설정
- [Added] - src/web/form.ts `buildRiskInput` `parseManwon`: 만원 단위 폼 입력을 검증해 원 단위 정수 RiskInput 으로 변환 (소수·음수·잘못된 날짜 거부)
- [Added] - src/web/present.ts, checklist.ts, rulesConfig.ts: 등급 라벨, 결과 그룹화, 금액 표기, 확인할 일 목록, 번들 룰 설정 로드
- [Added] - src/app/layout.tsx, page.tsx, globals.css: 한국어 레이아웃과 라이트/다크 대응 스타일
- [Added] - src/web/components/*.tsx: 입력 폼, 등급 리포트, 체크리스트(localStorage), 면책 고지 컴포넌트. 분석은 브라우저에서 실행되어 입력이 전송되지 않음
- [Added] - tests/web/form.test.ts: 변환·검증·엔진 연동·표시 로직 테스트 26건
- [Changed] - src/core/rules/mortgage.ts `ltvRatio`: 근거 문구의 시세 출처·신뢰도를 내부 값(user/high) 대신 한글로 표시
- [Added] - docs/adr/0006-web-ui-client-side-evaluation.md, docs/ROADMAP.md, docs/architecture.md, README.md: 웹 UI 결정 기록과 진행 상태·구조 갱신

[2026-11-04 18:00]
- [Changed] - docs/PRD.md, docs/threat-model.md, docs/ROADMAP.md, CONTRIBUTING.md, README.md: 사내망 전용 전제를 제거하고 개인 프로젝트·공개 저장소 기준(LLM 엔드포인트는 사용자가 .env 로 지정)으로 정리
- [Changed] - docs/adr/0001-product-model-installable.md, docs/adr/0005-llm-provider.md: 파일명과 결정 내용을 사내망 전용에서 설치형·공개 저장소, LLM 선택 기능으로 개정
- [Changed] - package.json, .env.example: 설명과 LLM_PROVIDER 후보(internal → openai-compatible)에서 사내 표현 제거
- [Changed] - .gitignore: 시크릿(*.pem 등)·로컬 DB·실제 등기부 PDF 차단, 마스킹 샘플(tests/fixtures/masked)만 예외로 허용
- [Added] - .dockerignore: Dockerfile 추가 시 .env·실제 자료·키가 이미지에 들어가지 않도록 미리 차단

[2026-11-04 17:52]
- [Added] - src/core/types.ts: 등기부 facts·계약·시세 입력과 룰 결과 zod 스키마 (금액은 원 단위 정수만 허용)
- [Added] - src/core/engine.ts `evaluateRisk` `computeGrade`: 룰 실행과 종합 등급(red/yellow/green/inconclusive) 산출, 판단 보류 시 green 불가
- [Added] - src/core/rules/ownership.ts: R-OWN-01~04 소유자 불일치·신탁·권리 제한·잦은 이전 룰 (말소 항목 제외)
- [Added] - src/core/rules/mortgage.ts: R-MORT-01 근저당 합산, R-LTV-01 보증금 대비 담보 비율
- [Added] - src/core/rules/priority.ts, checklist.ts: R-PRIO-01 대항력 기준일 비교, R-TAX-01 체납 확인 체크리스트
- [Added] - src/core/config.ts, rules.config/rules.v1.json: 출처·검증 상태가 붙은 임계치 설정 (현재 모두 provisional)
- [Added] - src/adapters/config/loadRulesConfig.ts: 설정 파일 로드와 스키마 검증 (파일 I/O는 adapters 담당)
- [Added] - tests/golden/*.test.ts, tests/helpers/builders.ts: 경계값·말소 제외·판단 보류·결정성 골든셋 38건

[2026-11-04 17:51]
- [Added] - docs/PRD.md: 설치형 기준 제품 요구사항 정의서 v0.2 (룰 명세, 대출·필요자금 산출, 마일스톤)
- [Added] - docs/adr/0001~0005: 제품 모델, TypeScript 스택, 결정적 core, 금액·룰 설정, LLM provider 결정 기록
- [Added] - docs/architecture.md, docs/threat-model.md, docs/ROADMAP.md: 아키텍처 경계, 위협 모델, 마일스톤별 작업 목록
- [Added] - README.md, CONTRIBUTING.md: 프로젝트 소개와 커밋·룰 변경·릴리즈 규칙

[2026-11-04 17:50]
- [Added] - package.json, package-lock.json: TypeScript/zod/vitest/eslint/prettier 기반 프로젝트 설정 (Node 20+)
- [Added] - tsconfig.json, vitest.config.ts: strict 타입 검사와 tests/ 하위 테스트 실행 설정
- [Added] - eslint.config.js: src/core 가 I/O 모듈·adapters/web/mcp 를 import 못 하도록 경계 규칙 추가 (ADR-0003)
- [Added] - .prettierrc.json, .prettierignore, .gitignore, .env.example: 포맷·무시 규칙과 환경변수 템플릿 (키·실제 자료 커밋 방지)
- [Added] - .github/workflows/ci.yml, .github/pull_request_template.md: CI(typecheck·lint·format·test)와 PR 보안·룰 변경 체크리스트

