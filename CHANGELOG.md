[2026-11-09 15:40]
- [Added] - src/adapters/public-data/aptTrade.ts `parseAptTradeXml` `PublicDataError`: 실제 응답 구조(쉼표 포함 만원 금액, 해제 표시, totalCount)로 아파트 매매 XML을 `TradeRecord`로 정규화하고 오류 코드(22 한도 초과 등)를 해석
- [Added] - src/adapters/public-data/tradeService.ts `createTradeService` `monthsToFetch`: 키 인코딩 처리, 페이지네이션(최대 페이지 제한), 재시도(복구 불가 오류 제외), 타임아웃, 지역·월 단위 TTL 캐시, 여러 달 거래로 시세 추정
- [Added] - src/app/api/market/route.ts, src/web/marketQuery.ts: 키를 서버에서만 사용하는 시세 조회 라우트와 쿼리 검증 (법정동코드·면적·단지명만 수신, 키는 응답·로그에 남기지 않음)
- [Added] - src/web/components/MarketLookup.tsx: 실거래가 시세 조회 UI, 단지명 없이 지역 전체로 계산하면 신뢰도 low 와 경고 표시
- [Changed] - src/web/components/InputForm.tsx, Analyzer.tsx, src/app/page.tsx: 시세 조회 슬롯 연결, 전송 범위 안내 문구를 실제 동작에 맞게 수정
- [Added] - tests/adapters/*.test.ts, tests/web/marketQuery.test.ts, tests/fixtures/public-data/: 실제 응답 픽스처 기반 계약 테스트와 서비스·검증 테스트 32건
- [Changed] - docs/public-data-api.md, docs/threat-model.md, docs/ROADMAP.md, README.md: 실제 호출로 확인한 필드·키 형식, 시세 조회 전송 범위, 환경변수 설명 갱신

[2026-11-09 13:30]
- [Added] - src/core/market/estimate.ts `estimateMarketValue` `medianWon`: 정규화된 실거래 목록에서 해제·면적 범위·조회 기간·단지명 조건으로 거르고 중앙값 시세와 표본 수 기반 신뢰도 산출 (순수 함수, 기준값은 호출자가 주입)
- [Added] - src/core/config.ts, rules.config/rules.v1.json: marketEstimate 설정(조회 기간 12개월, 최소 표본 3건, 면적 ±3㎡, 모두 provisional) 추가
- [Added] - tests/golden/market-estimate.test.ts: 중앙값, 해제·면적·기간·단지 필터 경계값, 신뢰도, 입력 검증 테스트 (합성 데이터)
- [Added] - docs/public-data-api.md: 발급할 공공데이터 API 목록과 공식 페이지에서 확인한 사실, 확인하지 못한 항목, 주의사항
- [Changed] - docs/ROADMAP.md: M4 진행 상태 갱신

[2026-11-09 11:10]
- [Changed] - .github/workflows/ci.yml: check 잡에 `npm run build` 단계 추가 (Next.js 프로덕션 빌드 실패를 CI에서 조기 발견)
- [Added] - .github/workflows/ci.yml docker 잡: 이미지 빌드, 읽기 전용으로 기동해 HTTP 응답 확인, non-root 실행 확인 (게시하지 않음)
- [Changed] - docs/ROADMAP.md: M6 진행 상태 갱신

[2026-11-09 10:20]
- [Added] - Dockerfile: node:22-alpine 3단계 빌드(deps/build/runtime), Next.js standalone 출력, non-root(node) 실행, 텔레메트리 비활성화, 헬스체크
- [Added] - docker-compose.yml: 127.0.0.1:3000 에만 바인딩, 읽기 전용 파일시스템(/tmp 는 tmpfs), 모든 capability 제거, no-new-privileges, .env 는 있으면 읽는 선택 항목
- [Changed] - README.md, docs/ROADMAP.md: Docker 실행·중지·로그 사용법 추가, M6 진행 상태 갱신

[2026-11-06 11:40]
- [Added] - src/web/financeForm.ts `buildAffordabilityInput` `parsePercent`: 대출·자금 폼 입력을 검증해 계산 입력으로 변환 (만원→원, 년→개월, 기본값 없이 필수값 검증, 담보가치 규칙)
- [Added] - src/web/components/FinanceFields.tsx, FinanceReport.tsx: 재무·대출 기준값·부대비용 입력과 필요 자금·대출 한도·과부족·월 상환 리포트 (위험 등급이 red 이면 확인 우선 안내)
- [Changed] - src/web/components/Analyzer.tsx, InputForm.tsx: 분석 시 자금 계획 계산을 함께 실행하고 `extra` 슬롯으로 입력 섹션 연결, 초기화 시 재무 입력도 삭제
- [Added] - tests/web/financeForm.test.ts: 변환·필수값·담보가치·부대비용·계약금 시점·core 연동 테스트 19건
- [Changed] - src/app/globals.css, docs/ROADMAP.md, docs/adr/0007-finance-assumptions-user-provided.md: 표 스타일 추가, 진행 상태와 UI 가정 기록

[2026-11-06 09:50]
- [Added] - src/core/finance/money.ts `mulPercent` `monthlyPayment` `principalFromAnnualPayment`: BigInt 기반 금액×비율(내림)과 원리금균등 상환액·역산 원금 계산 (부동소수점·정수 범위 초과 방지)
- [Added] - src/core/finance/types.ts: 재무 프로필·대출 기준값·부대비용·계산 입력 zod 스키마 (대출 기준값은 기본값 없이 필수 입력)
- [Added] - src/core/finance/affordability.ts `evaluateAffordability` `estimateLoanScenario` `buildFundingPlan`: LTV·DSR·상품 한도 중 최솟값과 병목, 기준·보수 시나리오, 필요 자금 항목, 자산 대비 과부족, 시점별 현금, 월 상환액·상환 비율 계산
- [Added] - tests/golden/finance.test.ts: 한도 병목·선순위 차감·동률·보수 시나리오·전세/매매 항목·계약금 시점·입력 검증 테스트
- [Added] - docs/adr/0007-finance-assumptions-user-provided.md: 규제·세금 기준값을 사용자 입력으로 두고 앱은 계산만 하는 결정 기록
- [Changed] - docs/PRD.md, docs/ROADMAP.md: §5.5·§5.6 기준값을 설정 파일 관리에서 사용자 입력으로 정정, 로드맵 진행 상태 갱신
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

