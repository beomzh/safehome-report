# 운영 가이드

README의 빠른 시작을 넘어, 이미 쓰고 있는 사람이 설정과 운영에서 찾는 내용입니다.

## 환경 변수

`.env.example` 을 `.env` 로 복사해 사용합니다. `.env` 는 `.gitignore` 로 커밋되지 않고, `.dockerignore` 로 이미지에도 들어가지 않습니다. Docker 로 실행하면 `docker-compose.yml` 이 `.env` 를 컨테이너에 **실행할 때만** 주입합니다.

| 변수                  | 필수        | 설명                                                                                                                                                                                                   |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PUBLIC_DATA_API_KEY` | 선택        | 공공데이터포털 일반 인증키. "실거래가로 시세 조회"에 사용합니다. 없으면 시세 조회 버튼이 안내 메시지를 보여주고, 시세는 직접 입력할 수 있습니다. 발급할 API는 [public-data-api.md](public-data-api.md) |
| `LLM_PROVIDER`        | 선택        | `none`(기본) 또는 `openai-compatible`. `none` 이면 "AI로 항목 추출"이 안내 메시지를 보여줍니다.                                                                                                        |
| `LLM_BASE_URL`        | LLM 사용 시 | `…/responses`(Responses API) 또는 `…/chat/completions` 전체 주소. 루트(`…/v1`)만 주면 chat/completions 를 붙입니다.                                                                                    |
| `LLM_API_KEY`         | LLM 사용 시 | Bearer 인증 키                                                                                                                                                                                         |
| `LLM_MODEL`           | LLM 사용 시 | 모델(배포) 이름                                                                                                                                                                                        |
| `LLM_TIMEOUT_MS`      | 선택        | 응답 대기 시간(기본 30000)                                                                                                                                                                             |
| `LOG_LEVEL`           | 선택        | `debug` · `info`(기본) · `warn` · `error`                                                                                                                                                              |

주소·키·모델명은 저장소, 문서, 로그, 오류 메시지 어디에도 쓰지 않습니다.

## Docker 운영

```bash
docker compose up -d --build   # 빌드하고 기동
docker compose ps              # 상태 (healthy 확인)
docker compose logs -f web     # 로그
docker compose down            # 중지
```

- 포트는 `127.0.0.1:3000` 에만 바인딩됩니다.
- 컨테이너는 non-root 사용자(`node`)로 실행되고, 파일시스템은 읽기 전용(`/tmp` 만 tmpfs), 모든 capability 를 제거하고 `no-new-privileges` 를 적용합니다.
- 로그 파일은 10MB × 3개로 회전합니다.
- CI 는 PR 마다 이미지를 빌드해 읽기 전용으로 기동하고 HTTP 응답과 non-root 실행을 확인합니다.

## 이미지 취약점 스캔 (trivy)

trivy 를 설치하지 않고 컨테이너로 돌립니다(Docker 만 있으면 됨). 이미지를 만든 뒤:

```bash
docker compose build
npm run scan:image      # HIGH·CRITICAL 이 있으면 종료 코드 1
```

- 처음 한 번은 취약점 DB 를 받느라 시간이 걸리고, `trivy-cache` 볼륨에 저장해 다음부터 빠릅니다. trivy 이미지는 `0.76.2` 로 고정했습니다.
- 2026-11-13 첫 스캔: 알파인 패키지 MEDIUM 1건, 그리고 **베이스 이미지(node:22-alpine)에 번들된 npm 내부 의존성 23건**(HIGH 10·MEDIUM 12·LOW 1)이 나왔습니다. 앱 의존성(`/app`)은 0건이었습니다. 실행 이미지에는 npm 이 필요 없어서(서버는 `node server.js`) Dockerfile 에서 npm·yarn·corepack 을 지우고 `apk upgrade` 를 추가했고, 다시 스캔해 **취약점 0건·시크릿 0건**을 확인했습니다. 컨테이너는 정상 기동(healthy)합니다.
- 베이스 이미지가 갱신되면 새 취약점이 생길 수 있으니 이미지를 다시 빌드할 때마다(또는 월 1회) 실행하세요. 자동으로 막는 CI 단계는 넣지 않았습니다(베이스 이미지 변경 때문에 무관한 PR 이 막히는 것을 피하기 위해).

## 로그 보기

서버(컨테이너) 로그는 한 줄 JSON 입니다. 요청 번호, 소요 시간, 건수, 결과, 오류 종류만 남기며 **매물 텍스트·성명·금액·재무 정보·단지명·링크·키·주소는 남기지 않습니다.**

```json
{"ts":"…","level":"info","tag":"MARKET","event":"lookup_ok","req":"003805e5","status":200,"ms":459,"months":13,"samples":17,"confidence":"high"}
{"ts":"…","level":"info","tag":"LISTING","event":"extract_ok","req":"cb2ba137","status":200,"ms":3178,"provider":"openai-compatible/responses","chars":60,"extracted":5}
```

- `MARKET` 은 실거래가 시세 조회, `RENT` 는 전월세 시세 조회(월 단위 건수·표본 수만 남음), `LISTING` 은 매물 설명 AI 추출, `ASSUMPTIONS` 는 대출 기준값 AI 제안, `VERDICT` 는 기준표 결론의 AI 해석입니다. `VERDICT` 로그에는 소요 시간, 결론, 버려진 문장 수, 이견 여부만 남습니다. `ASSUMPTIONS` 로그에는 소요 시간, 채워진 항목 수, 신뢰도만 남고 지역·금액은 남지 않습니다.
- 공공데이터 응답 헤더로 받은 남은 일일 호출 수는 `public_data_quota`(`debug`, 1,000 미만이면 `warn`) 로 남습니다. 개발계정 한도(하루 10,000건)에 가까워지는지 볼 때 `LOG_LEVEL=debug` 로 확인하세요.
- 재시도는 `warn`(`public_data_retry`, `llm_retry`), 실패는 `error` 로 남습니다. `debug` 에서는 캐시 적중과 월별 로딩 건수도 보입니다.
- 설명을 비운 채 링크만 입력하면 서버를 호출하지 않고 화면에서 안내하므로 로그가 없습니다.
- 위험 점검과 자금 계산은 브라우저 안에서만 실행되어 서버 로그에 남지 않습니다.

## 문제 해결

| 증상                                            | 확인                                                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| "PUBLIC_DATA_API_KEY 가 설정되어 있지 않습니다" | `.env` 에 키가 있는지, Docker 라면 `docker compose up -d` 로 다시 기동했는지                                    |
| 시세 조회가 "한도 초과"(코드 22)                | 공공데이터 개발계정은 하루 10,000건입니다. 같은 지역·월은 6시간 캐시됩니다.                                     |
| "LLM 이 설정되어 있지 않습니다"                 | `LLM_PROVIDER=openai-compatible` 과 `LLM_BASE_URL`·`LLM_API_KEY`·`LLM_MODEL` 설정                               |
| LLM 응답이 형식과 다르다는 오류                 | 같은 요청을 다시 시도하세요(자동 재시도 1회). 계속되면 모델이 구조화 출력(JSON Schema)을 지원하는지 확인하세요. |
