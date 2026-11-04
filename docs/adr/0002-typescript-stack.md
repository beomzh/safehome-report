# ADR-0002: 구현 언어·스택 — TypeScript

- 상태: 승인 (PDF 파서 라이브러리는 M0에서 비교 후 재확인)
- 날짜: 2026-11-04

## 맥락

병목은 공공API·LLM 네트워크 대기이고, 룰·대출 계산과 PDF 파싱은 가볍다. 언어의 실행 속도보다 개발 속도, 생태계(pdf.js, zod, Playwright, MCP SDK), UI와의 코드 공유가 중요하다.

## 결정

- **TypeScript** (strict). 런타임 검증은 zod, 테스트는 vitest.
- UI·로컬 API는 Next.js(M3에서 도입). core는 프레임워크 무의존 순수 TS로 분리한다.
- 대안: Python(pdfplumber)은 파서 품질이 부족할 때 파서만 별도 서비스로 분리하는 방안으로 남긴다. Rust/Tauri는 Docker 없는 데스크톱 배포가 필요해질 때(v1 이후) 검토한다.

## 결과

- 한 언어로 UI·API·룰 엔진을 작성하고 core를 브라우저·서버에서 공유할 수 있다.
- 런타임 타입 안전은 zod 스키마 경계 검증으로 보완한다.
