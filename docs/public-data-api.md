# 공공데이터 API 정리 (시세·건축물대장)

작성: 2026-11-09. **공식 상세 페이지에서 확인한 것**과 **아직 확인하지 못한 것**을 구분해 적는다. 확인하지 못한 항목은 키 발급 후 실제 호출로 검증(ROADMAP M0)한 뒤 이 문서를 갱신한다.

## 발급받을 API (공공데이터포털 data.go.kr → 각 API 상세 페이지 → "활용신청")

| 용도                   | API                                             | 데이터셋                                                    | 상태                                     |
| ---------------------- | ----------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| 아파트 매매 시세       | 국토교통부_아파트 매매 실거래가 상세 자료       | [15126468](https://www.data.go.kr/data/15126468/openapi.do) | 확인함                                   |
| 아파트 전세 시세       | 국토교통부_아파트 전월세 실거래가 자료          | [15126474](https://www.data.go.kr/data/15126474/openapi.do) | 확인함                                   |
| 다가구·단독 전월세     | 국토교통부_단독/다가구 전월세 실거래가 자료     | [15126472](https://www.data.go.kr/data/15126472/openapi.do) | 페이지 존재 확인, 엔드포인트·필드 미확인 |
| 오피스텔 전월세        | 국토교통부_오피스텔 전월세 실거래가 자료        | [15126475](https://www.data.go.kr/data/15126475/openapi.do) | 페이지 존재 확인, 엔드포인트·필드 미확인 |
| 연립다세대 전월세·매매 | 국토교통부_연립다세대 전월세/매매 실거래가 자료 | 미확인 (15126473 은 번호 추정)                              | 데이터포털에서 검색해 확인 필요          |
| 위반건축물·용도        | 국토교통부_건축HUB_건축물대장정보 서비스        | [15134735](https://www.data.go.kr/data/15134735/openapi.do) | 엔드포인트만 확인                        |

우선순위: 아파트 매매·전월세 → 다가구·연립다세대·오피스텔 전월세(전세사기 피해가 많은 유형) → 건축물대장.

## 확인된 사실 (공식 상세 페이지 기준)

- 아파트 매매 상세: `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev`
  - 요청 변수(모두 필수): `LAWD_CD`(법정동코드 앞 5자리), `DEAL_YMD`(계약년월 6자리), `serviceKey`, `pageNo`, `numOfRows`
- 아파트 전월세: `https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent`
  - 요청 변수: `LAWD_CD`, `DEAL_YMD`, `serviceKey`
- 두 API 모두 REST, 응답 XML, **개발계정 자동 승인, 일 10,000건**, 이용 무료. 운영계정 상향은 활용사례 등록 시 신청.
- 개인정보 보호를 위해 동·호 정보는 제공되지 않는다(층 정보 중심).
- 오류 코드 예: 20 키 없음/접근 거부, 22 일일 한도 초과, 23 초당 한도 초과, 30 미등록 키, 31 만료 키.
- 건축물대장 표제부: `http://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo`, 월 단위 갱신, `_type=json` 으로 JSON 요청 가능, 활용 신청은 PC 버전에서만 가능.

## 실제 호출로 확인한 사실 (2026-11-09, 강남구 11680 · 2025-10)

- 두 API 모두 HTTP 200, `resultCode 000`, 응답 끝에 `numOfRows`·`pageNo`·`totalCount`(매매 311건, 전월세 2,073건)가 있다.
- **아파트 매매** 항목 필드: `aptNm`(단지명), `dealAmount`(만원, 쉼표 포함 예 `154,000`), `excluUseAr`(전용면적 ㎡), `dealYear`/`dealMonth`/`dealDay`, `floor`, `buildYear`, `umdNm`, `jibun`, `sggCd`, `cdealType`·`cdealDay`(**해제 시 값이 채워지고 평소에는 공백**), `dealingGbn`, `rgstDate` 등
- **아파트 전월세** 항목 필드: `aptNm`, `deposit`(만원, 쉼표 포함), `monthlyRent`(만원, 전세는 0), `excluUseAr`, `dealYear`/`dealMonth`/`dealDay`, `contractType`, `contractTerm`, `preDeposit`, `preMonthlyRent`, `floor`, `buildYear` 등
- 발급받은 키는 **Encoding 형식(% 포함)** 이었고 그대로 쓰면 동작했다. Decoding 형식 키를 `encodeURIComponent` 로 인코딩하는 경로는 단위 테스트로만 확인했다(실제 호출 미확인).
- `numOfRows=100` 으로 여러 페이지를 받는 것은 동작한다. 허용 최대값은 확인하지 못했다.
- 실제 응답 샘플은 `tests/fixtures/public-data/` 에 있고 계약 테스트에 쓴다. 이 응답에는 키가 포함되지 않는다.
- 현재 앱이 쓰는 것은 아파트 **매매** API 뿐이다. 깡통전세 판단의 시세는 매매 시세와 비교하기 때문이다(전월세 API는 전세가율 참고용으로 후속 검토).

## 연립다세대·오피스텔 매매 (2026-11-09)

- **오피스텔은 활용신청 승인 후 실제 응답으로 확인했다**: `offiNm`, `dealAmount`(만원, 쉼표), `excluUseAr`, `dealYear/Month/Day`, `cdealType`, `floor`, `buildYear`, `umdNm`, `jibun`, `totalCount`. 샘플은 `tests/fixtures/public-data/offi-trade-11680-202510.xml`.
- **단독/다가구는 2026-11-11 승인 후 실제 응답으로 확인했다**: `houseType`(단독/다가구), `dealAmount`(만원), `totalFloorAr`(연면적㎡), `plottageAr`(대지면적㎡), `umdNm`(법정동), `jibun`(마스킹), `buildYear`, `dealYear/Month/Day`. 건물명·전용면적이 없어 앱은 연면적 ±20% 와 법정동명으로 시세를 추정한다(신뢰도 낮음). 샘플은 `tests/fixtures/public-data/house-trade-11680-202510.xml`.
- **연립다세대는 엔드포인트를 잘못 쓰고 있었다**: 정확한 주소는 `RTMSDataSvcRHTrade2/getRTMSDataSvcRHTrade2`(상세 페이지 swagger 의 host 로 확인)이고, 구버전 `RTMSDataSvcRHTrade` 는 폐기되어 승인된 키로도 코드 30 이 돌아왔다. 올바른 주소로 실제 응답을 확인했다(2026-11-11): `mhouseNm`(건물명), `excluUseAr`, `dealAmount`, `houseType`(연립/다세대), `umdNm`, `landAr`. 샘플은 `tests/fixtures/public-data/rowhouse-trade-11680-202510.xml`. 다른 API도 막히면 코드 30 만 믿지 말고 상세 페이지의 swagger host 를 확인한다.

- 엔드포인트 경로는 존재한다: `RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade`(연립다세대), `RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade`(오피스텔), `RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade`(단독/다가구). 현재 키로 호출하면 세 곳 모두 오류 코드 30(등록되지 않은 서비스 키)이 돌아온다. **각 API 상세 페이지에서 따로 활용신청해야 한다.**
- 따라서 응답 필드는 실제로 확인하지 못했다. 앱은 연립다세대 `mhouseNm`, 오피스텔 `offiNm` 을 건물명으로, 나머지(`dealAmount`, `excluUseAr`, `dealYear/Month/Day`, `cdealType`)는 아파트와 같다고 가정해 읽는다. 이 가정이 틀리면 항목이 건너뛰어져 "조건에 맞는 거래 없음"으로 나타난다.
- 활용신청을 하면 실제 응답으로 `src/adapters/public-data/housing.ts` 의 `verified` 를 올리고 `tests/fixtures/public-data/` 에 샘플을 추가한다.

## 확인하지 못한 것

- `numOfRows` 허용 최대값(자료마다 1000/9999로 설명이 엇갈림).
- 건축물대장 요청 변수(`sigunguCd`, `bjdongCd`, `bun`, `ji`)의 필수 여부와 코드 형식.
- 공시가격(공동주택가격) API와 중개업 조회 API는 아직 후보를 정하지 못했다(ROADMAP M0).

## 주의

- 실거래가 공개시스템(rt.molit.go.kr) 웹 화면을 스크래핑하는 것은 이용 안내에서 금지된다. 반드시 공공데이터포털 API를 쓴다.
- API 키는 `.env` 에만 두고(`PUBLIC_DATA_API_KEY`) 브라우저에서 직접 호출하지 않는다. 호출은 로컬 컨테이너의 서버 라우트가 대신한다.
- 일일 한도(개발계정 10,000건)를 넘지 않도록 응답을 캐시한다. 지역·계약월 단위 조회이므로 같은 달·지역 요청은 재사용한다.
- 주소 → 법정동코드(5자리) 변환이 필요하다. 행정표준코드 법정동코드 데이터를 별도로 받아 사용한다(M4에서 다룸).
