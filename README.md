# SafeHomeReport (가칭)

전세·매매 계약 전에 등기부등본과 공공데이터를 **로컬에서** 분석해 사기·깡통 위험 신호를 근거와 함께 보여주는 **설치형(로컬 실행)** 점검 도구.

> 참고용 점검 도구이며 법률·중개·투자 자문이 아닙니다. 계약 전 법무사·변호사·보증기관 상담을 권장합니다.
> "Green"은 *탐지된 위험 신호 없음*이지 안전 보증이 아닙니다.

## 현재 상태

M1(룰 엔진 core) 완료, M3(웹 UI) 1차 구현. 등기부 PDF 파서·공공데이터·LLM 연동은 아직 구현 전입니다 → [ROADMAP](docs/ROADMAP.md)

## 원칙

- 위험 판정은 결정적 룰 엔진이 한다. LLM은 보조(필드 추출·문장화)이며 판정하지 않는다. ([ADR-0003](docs/adr/0003-deterministic-core-llm-assist.md))
- 등기부 원문·성명·자산·소득은 사용자 PC 밖(LLM 포함)으로 보내지 않는다.
- 금액은 원 단위 정수, 임계치는 출처가 붙은 설정 파일로 관리한다. ([ADR-0004](docs/adr/0004-money-and-rules-config.md))
- 입력이 부족하면 Green 대신 **판단 보류**(`inconclusive`)로 표시한다.

## 개발

요구사항: Node.js 20 이상

```bash
npm install
npm run check   # typecheck + lint + test
```

| 명령                          | 설명                                   |
| ----------------------------- | -------------------------------------- |
| `npm run dev`                 | 로컬 개발 서버 (http://127.0.0.1:3000) |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행                   |
| `npm run typecheck`           | TypeScript 타입 검사                   |
| `npm run lint`                | ESLint (core 경계 규칙 포함)           |
| `npm test`                    | vitest (골든셋 포함)                   |
| `npm run format`              | Prettier 적용                          |

## 구조

```
src/core/        순수 로직(타입·스키마, 룰, 엔진) — I/O·다른 계층 의존 금지
src/app/         Next.js 라우트·레이아웃
src/web/         UI 컴포넌트, 폼→입력 변환, 표시 로직
src/adapters/    파일 I/O, (예정) 공공API·LLM provider·저장소
rules.config/    임계치·기준값 (source/status 포함)
tests/golden/    입력 facts → 기대 판정 회귀 테스트
docs/            PRD, ADR, 아키텍처, 위협 모델, 로드맵
```

## 문서

- [PRD](docs/PRD.md) · [로드맵](docs/ROADMAP.md) · [아키텍처](docs/architecture.md) · [위협 모델](docs/threat-model.md)
- 결정 기록: [docs/adr](docs/adr/)
- 기여·커밋·릴리즈 규칙: [CONTRIBUTING](CONTRIBUTING.md)

## 설정

`.env.example` 을 복사해 `.env` 로 사용합니다. API 키·LLM 엔드포인트는 절대 커밋하지 않습니다(`.gitignore` 처리됨).
