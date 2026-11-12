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

## 전월세 API 4종 (2026-11-12 실제 호출, 강남구 11680 · 2025-10)

현재 키로 네 곳 모두 HTTP 200, `resultCode 000`. 요청 변수는 매매와 같다(`LAWD_CD`, `DEAL_YMD`, `serviceKey`, `pageNo`, `numOfRows`). 응답에 키는 포함되지 않았다. 샘플은 `tests/fixtures/public-data/*-rent-11680-202510.xml`.

| 유형       | 엔드포인트 (`/1613000/`)                     | 건수(totalCount) | 이름 필드  | 면적 필드                           |
| ---------- | -------------------------------------------- | ---------------- | ---------- | ----------------------------------- |
| 아파트     | `RTMSDataSvcAptRent/getRTMSDataSvcAptRent`   | 2,073 (2025-10)  | `aptNm`    | `excluUseAr` (전용)                 |
| 오피스텔   | `RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent` | 317              | `offiNm`   | `excluUseAr`                        |
| 연립다세대 | `RTMSDataSvcRHRent/getRTMSDataSvcRHRent`     | 524              | `mhouseNm` | `excluUseAr`, `houseType`           |
| 단독다가구 | `RTMSDataSvcSHRent/getRTMSDataSvcSHRent`     | 453              | 없음       | `totalFloorAr`(연면적), `houseType` |

- 공통 필드: `deposit`(만원, 쉼표 포함), `monthlyRent`(만원, **전세는 0**), `dealYear/Month/Day`, `floor`, `buildYear`, `umdNm`, `jibun`, `sggCd`, `contractType`(신규/갱신, 공백 가능), `contractTerm`(예 `25.12~26.12`, 공백 가능), `preDeposit`·`preMonthlyRent`(갱신 전 금액, 공백 가능), `useRRRight`(갱신요구권 사용, 공백 가능). 아파트는 `aptSeq`, 도로명 필드도 있다.
- 매매와 달리 **해제 필드(`cdealType`)가 없다.** 전월세 신고 취소는 응답에서 구분되지 않는다.
- 단독다가구는 건물명·전용면적이 없고 `totalFloorAr`·법정동만 있어 매매와 같은 방식(연면적 ±20% + 법정동)으로만 추정할 수 있다(신뢰도 낮음).
- 활용신청 승인 상태: 아파트·오피스텔·연립다세대·단독다가구 전월세 모두 현재 키로 호출됨. 오피스텔·연립다세대는 필드명을 추정하지 않고 실제 응답으로 확인했다.

### 앱 연결 (2026-11-12 구현)

- `GET /api/rent` (`/api/market` 과 같은 쿼리): 최근 `rentWindowMonths`(6개월)를 3개월씩 묶어 호출하고 월 단위로 캐시한다. `numOfRows=9999` 가 허용되는 것을 확인했고(강남구 아파트 2,073건을 한 번에 수신) 앱은 1000 으로 받는다. 한 번의 조회가 월당 1~3회 호출이다.
- 전세는 신규 계약이 `minSamples` 이상이면 신규만, 부족하면 갱신을 포함하고 신뢰도를 낮춘다. 월세는 보증금·월세 중앙값을 각각 낸다.
- 전세가율(전세 중앙값 ÷ 매매 중앙값)과 입력 보증금 비교는 **참고용**이며 위험 판정(R-RATIO-01 등)에는 쓰지 않는다.
- 실제 호출 확인: 강남구 개나리SK뷰 84.99㎡, 전세 4건·월세 5건, 조회 약 4초.

### 설계 메모 (구현 전 검토 내용)

1. **전세가율 참고**: 같은 단지·면적의 최근 전세 거래 중앙값 ÷ 매매 중앙값. 지금의 사전 점검은 입력 보증금 ÷ 매매 시세만 본다.
2. **입력 보증금이 주변 전세 시세보다 높은지** 비교(매물 가격이 시세보다 비싼지).
3. **월세 환산**: 월세 거래의 보증금·월세 조합 참고.

설계할 때 정해야 할 점: 갱신 계약(`contractType=갱신`)은 신규보다 낮게 형성되는 경향이 있어 신규만 쓸지, 표본이 적은 단지의 신뢰도 기준, 전월세 API 호출량(월 단위 호출 × 12개월 × 유형)이 일일 한도 10,000건에 미치는 영향(캐시 필요).

## 건축물대장 (건축HUB, 2026-11-12 실제 호출)

- 현재 키로 `BldRgstHubService` 의 표제부(`getBrTitleInfo`)·총괄표제부(`getBrRecapTitleInfo`)·기본개요(`getBrBasisOulnInfo`)·층별개요(`getBrFlrOulnInfo`)가 호출된다(`_type=json`, `resultCode 00`). 전용부(`getBrExposPubuseAreaInfo`)는 JSON 응답이 아니라 확인하지 못했다.
- 요청 변수: `sigunguCd`(5자리) + `bjdongCd`(**법정동코드 뒤 5자리**) + `platGbCd`(0 대지) + `bun`(본번 4자리) + `ji`(부번 4자리). 예: 서울 강남구 개포동 12 → `11680`, `10300`, `0`, `0012`, `0000`.
- 표제부 필드(일부): `bldNm`, `dongNm`, `mainPurpsCdNm`(주용도, 예 공동주택), `etcPurps`(기타용도, 예 아파트), `hhldCnt`, `grndFlrCnt`, `ugrndFlrCnt`, `totArea`, `useAprDay`(사용승인일). 층별개요에는 층마다 `mainPurpsCdNm`·`etcPurps`·`area` 가 있다.
- **위반건축물 여부 필드는 위 네 API 응답에서 찾지 못했다.** 위반건축물 표시(R-BLD-01)는 이 API 로 판정할 수 없고 건축물대장 열람 화면에서 확인해야 한다.
- 주용도·층별 용도로 근린생활시설을 주거로 쓰는 건물(R-BLD-02 후보)은 판단할 수 있다.
- **구현함 (2026-11-12)**: `GET /api/building`(시군구 코드·주소·지번) → 표제부 목록 → 건축물 선택 → 룰 R-BLD-02(주용도로 주택 여부 판단). 위반건축물은 판정하지 않는다.
- 법정동코드 10자리 표(`src/adapters/public-data/dongCodes.json`): 법정동코드 전체자료(2022 판, [gist](https://gist.github.com/hansim/34246d350f61475257c7721f8549b57a))에서 폐지 항목을 빼고 이 앱의 시군구 표(200곳)에 맞춰 추렸다(강원 42→51, 전북 45→52 코드 변환). 14,263행.
- **표본 확인**: 무작위 79곳을 시군구+법정동만으로 실제 호출(`totalCount>0`)해 74곳에서 건물이 있음을 확인했다(강원·전북 새 코드 포함). 4곳은 읍·면 **상위 행**(예: 송해면)이라 건축물이 리 단위로만 등록돼 0건이었고 이런 행은 표에서 뺐다(1,170행). 군위군(27720)은 100행 중 일부만 응답해 코드를 신뢰할 수 없어 통째로 뺐다. 제주 안덕면 대평리 1곳은 원인을 확인하지 못했다. 전체 14,263행을 모두 호출해 검증하지는 않았다.
- 데이터포털 건축HUB 는 가끔 HTTP 503 을 돌려준다(표본 중 8건). 앱은 1회 재시도한다.

## 공시가격 (2026-11-12 조사)

- 국가공간정보포털(NSDI) 계열 공동주택가격·개별주택가격 속성 API(`1611000/nsdi/...PriceService/attr/...`)는 현재 키로 호출하면 "해당 오픈API 서비스가 없거나 폐기됨"(코드 12)이 돌아온다. 쓰려면 다른 엔드포인트(브이월드 `ned` API 등)와 별도 키·활용신청이 필요한데 이 조사에서는 확인하지 못했다.
- 건축HUB 의 `getBrHsprcInfo`(건축물대장 주택가격)는 현재 키로 호출된다. 하지만 **한 지번에서 역대 기준일(2009·2010·2012·2020…)의 가격이 모두** 최대 83,867건(개포동 12번지)으로 섞여 오고, 응답에 호·동·면적·층이 없어(`bldNm`·`hsprc`·`stdDay`·`crtnDay` 정도) 특정 호의 현재 공시가격을 가려낼 수 없다. 이 응답에서 값을 골라 쓰면 틀린 공시가격이 나올 수 있어 앱에는 연결하지 않았다.
- 현재는 사용자가 [부동산공시가격 알리미](https://www.realtyprice.kr)에서 확인한 공시가격을 직접 입력한다(재산세 계산용, 이미 있음).
- 연결하려면 공시가격을 호 단위로 주는 API 를 찾아 활용신청하거나, 가격 열람 화면에서 복사한 값을 붙여넣는 입력을 만드는 방법이 있다.

## 확인하지 못한 것

- `numOfRows` 허용 최대값(자료마다 1000/9999로 설명이 엇갈림).
- 건축물대장 요청 변수(`sigunguCd`, `bjdongCd`, `bun`, `ji`)의 필수 여부와 코드 형식.
- 공시가격(공동주택가격) API와 중개업 조회 API는 아직 후보를 정하지 못했다(ROADMAP M0).

## 주의

- 실거래가 공개시스템(rt.molit.go.kr) 웹 화면을 스크래핑하는 것은 이용 안내에서 금지된다. 반드시 공공데이터포털 API를 쓴다.
- API 키는 `.env` 에만 두고(`PUBLIC_DATA_API_KEY`) 브라우저에서 직접 호출하지 않는다. 호출은 로컬 컨테이너의 서버 라우트가 대신한다.
- 일일 한도(개발계정 10,000건)를 넘지 않도록 응답을 캐시한다. 지역·계약월 단위 조회이므로 같은 달·지역 요청은 재사용한다.
- 주소 → 시군구 법정동코드(5자리) 변환은 `src/core/region/sigunguCodes.ts` 표로 한다. 법정동코드 전체자료(2022 판)에서 시·구 단위를 추려 코드마다 단독다가구·연립다세대 API 로 실제 응답이 오는 것만 담았다(2026-11-11, 201곳). 강원·전북 특별자치도, 군위군은 새 코드로 바꿔 검증했다. 인천 중·동·서구, 광주·전남, 부천, 화성 등 2026 개편으로 옛 코드가 폐기된 곳은 새 코드를 확인하지 못해 제외했고 직접 입력해야 한다. 데이터포털 API 는 짧은 시간에 많이 호출하면 HTTP 429 를 돌려준다(검증 시 동시 8건에서 발생, 순차 호출로 해결).
