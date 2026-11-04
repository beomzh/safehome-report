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

