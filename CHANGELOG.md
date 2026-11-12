# Changelog

이 프로젝트의 버전별 변경 내역입니다. 각 버전이 이전 버전과 무엇이 달라졌는지 적습니다.

## [Unreleased]

> 이전 상태(PR #8까지) 대비: 취득세·중개보수를 법정 요율로 자동 계산해 필요 자금에 포함하고, 분석 결과를 팝업 리포트로 보여줍니다. README를 새로 썼습니다. 영향도: recommended (필요 자금 합계의 기본값이 달라집니다)

### Added

- **실제 등기부 형식으로 파서 검증·수정**: 인터넷에 공개된 실제 등기사항전부증명서 PDF 2건(집합건물 4쪽, 건물 6쪽, 텍스트 레이어 PDF)을 `pdftotext -layout` 으로 읽어 기존 파서와 비교해 네 가지를 고쳤습니다. (1) 말소 행의 목적란이 줄바꿈되어 "3번근저당권설정등 / 기말소" 처럼 '말소'가 접수일 뒤에 오면 말소를 놓쳐 이미 말소된 근저당을 유효로 계산하던 문제(실제 문서에서 3건 중 3건이 이 경우), (2) 공동담보·주소의 "75-267 …" 줄을 순위번호로 오인해 가짜 행이 생기고 채권최고액 인식 실패 경고가 뜨던 문제(순위번호 형식 제한과 깊게 들여쓴 줄은 앞 행의 이어짐으로 처리), (3) 등기명의인표시변경 부기등기를 "자동 판정 대상 아님" 경고로 처리하던 문제(소유권 변동이 아니므로 무시), (4) 전세권·임차권에 설정된 근저당을 건물의 선순위 채권으로 취급할 위험(건물 담보가 아니므로 기타로 분류). 실제 문서는 소유자 개인정보가 있어 저장소에 넣지 않았고, 같은 형식을 가상 이름·주소로 재현한 `synthetic-layout.txt` 골든 테스트 4개(이전 파서는 4개 모두 실패)를 추가했습니다. 한계: 붙여넣은 텍스트에서 들여쓰기가 사라지면 순위번호 형식 제한만으로 구분하고, 말소선(취소선)만 있는 행은 텍스트로 구분할 수 없습니다. 공개 API 변경 없음. — 관련 파일: `src/core/registry/parse.ts`, `tests/fixtures/registry/synthetic-layout.txt`, `tests/golden/registry-parse.test.ts`, `docs/ROADMAP.md`
- **AI 출력의 안전·승인 단정 문장 제거, 공시가격 API 조사 기록**: AI 해석과 기준값 제안의 근거·유의점에서 "안전합니다", "문제없습니다", "대출이 됩니다", "계약해도 됩니다", "돌려받을 수 있습니다" 같은 단정 문장을 코드로 버립니다("안전하지 않습니다", "보증하지 않습니다" 같은 부정형은 통과). 버린 개수는 화면에 알립니다. 프롬프트에도 금지 표현을 명시했고 테스트 21개(금지 표현·통과 표현·AI 해석·기준값 제안·주입 회귀)를 추가했습니다. 공시가격은 건축HUB `getBrHsprcInfo` 가 호·면적 없이 역대 기준일 가격을 섞어 돌려주고(개포동 12번지 83,867건) NSDI API 는 폐기되어 있어 앱에 연결하지 않고 조사 결과를 문서에 기록했습니다. 로드맵의 완료된 항목(IN-03·IN-05, LLM 인터페이스)도 정리했습니다. 공개 API 변경: `/api/verdict` 응답의 `explanation` 에 `droppedForClaims` 추가. — 관련 파일: `src/adapters/llm/{guard,verdict,assumptions}.ts`, `src/web/components/VerdictPanel.tsx`, `tests/llm/guard.test.ts`, `docs/{public-data-api,ROADMAP,threat-model}.md`
- **경매 시 보증금 회수 가능액 시나리오(R-RECOV-01)**: 전세 계약에서 시세가 있으면 낙찰가가 시세의 100·90·80·70%일 때 보증금을 얼마나 돌려받는지 보여줍니다. 계산 순서는 소액임차인 최우선변제(낙찰가의 1/2 한도) → 선순위 채권(등기부의 미말소 근저당 채권최고액, 없으면 매물 설명의 융자금, 둘 다 없으면 0 으로 가정하고 "최선의 경우"라고 표시) → 확정일자 임차인 순입니다. 소액임차인 기준(서울 1억 6,500만원 이하 5,500만원 등 4개 지역 구분)은 국가법령정보센터의 주택임대차보호법 시행령 제10·11조(2026-07-01 시행본)로 확인해 `rules.config` 에 넣었고, 낙찰가율 시나리오는 예측이 아닌 가정(잠정)입니다. 정보 룰이라 종합 등급에는 영향이 없습니다. 월세는 환산보증금 기준이라 지원하지 않고, 인천 대부분의 구·남양주·시흥처럼 일부 지역만 과밀억제권역인 곳은 지역 구분을 정하지 않고 최우선변제를 계산하지 않습니다. 국세·당해세, 경매비용, 다른 임차인은 반영하지 않습니다. 공개 API 변경: `RiskInput.regionCode`(선택) 추가, `rules.config` 에 `recovery` 추가. — 관련 파일: `src/core/{recovery.ts,region/smallTenant.ts,rules/recovery.ts}`, `src/core/config.ts`, `rules.config/rules.v1.json`, `src/web/form.ts`, `tests/golden/recovery.test.ts`
- **건축물대장으로 용도 확인(R-BLD-02)**: 시세 조회 아래 "건축물대장으로 용도 확인"에서 지번(예: 12 또는 12-3)을 넣고 조회하면 건축HUB 표제부의 건물 목록(주용도·층수·세대수·사용승인일)을 보여주고, 계약할 건물을 체크하면 위험 신호 점검에 용도가 반영됩니다(주택이 있으면 주택 건물만 먼저 체크). 주용도가 근린생활시설뿐이면 위험(근생빌라: 전세대출·보증보험·전입신고 문제 가능), 주택과 근생이 섞이면 주의, 오피스텔 등 업무시설은 정보, 조회하지 않으면 판단 보류(등급 영향 없음)입니다. 매물 설명 적용 시 주소에서 지번도 자동으로 읽습니다. 위반건축물은 이 API 에 필드가 없어 판정하지 않고 대장 열람 화면에서 확인하도록 안내합니다. 법정동코드 10자리 표(14,263행, 2022 판 기준·강원/전북 새 코드 반영)를 추가했고 무작위 79곳 중 74곳을 실제 응답으로 확인했습니다. 공개 API 변경: `GET /api/building` 추가, `RiskInput.building`(선택) 추가. — 관련 파일: `src/core/rules/building.ts`, `src/adapters/public-data/{building,dongLookup}.ts`·`dongCodes.json`, `src/app/api/building/route.ts`, `src/web/components/{BuildingLookup,ListingImport,Analyzer}.tsx`, `src/web/form.ts`, `docs/`
- **데이터 흐름 문서, 건축물대장 API 조사 기록**: 버튼별로 PC 밖으로 나가는 값과 나가지 않는 값, 사이드바(사이트 직접 로드)의 흐름, 브라우저 저장 항목을 `docs/data-flow.md` 에 정리하고 README 문서 표에 추가했습니다. 건축HUB 건축물대장 API 4종이 현재 키로 호출되는 것과, 위반건축물 필드는 응답에서 찾지 못했고 구현에는 법정동코드 10자리 표가 필요하다는 점을 `docs/public-data-api.md` 에 기록했습니다. 운영 가이드 로그 태그에 `RENT` 를 추가했습니다. 앱 동작 변경 없음. — 관련 파일: `docs/{data-flow,public-data-api,operations,ROADMAP}.md`, `README.md`
- **전월세 실거래 연결(전세가율 참고)과 대안 단지 검색 링크**: 시세 조회에 성공하면 같은 조건의 전월세 실거래(최근 6개월)도 조회해 전세 중앙값, 전세가율(전세 ÷ 매매), 입력한 보증금과의 차이, 월세 거래의 보증금·월세 중앙값을 보여주고 리포트의 "시세·대안 단지" 시트에도 넣습니다. 신규 계약 표본이 부족하면 갱신 계약을 포함하고 신뢰도를 낮춥니다. 참고용이며 위험 판정에는 쓰지 않습니다. 아파트·오피스텔·연립다세대·단독다가구를 지원하고(단독다가구는 연면적±20%·법정동 기준), 강남구 실제 응답으로 확인했습니다. 대안 단지마다 "네이버 부동산에서 검색"·"네이버 검색" 링크를 붙였습니다(실거래 사례에는 매물 주소가 없어 특정 매물이 아니라 검색 결과로 연결). 공개 API 변경: `GET /api/rent` 추가, `rules.config` 의 `marketEstimate.rentWindowMonths`(6, 잠정) 추가. — 관련 파일: `src/core/market/rent.ts`, `src/adapters/public-data/{aptTrade,housing,tradeService}.ts`, `src/app/api/rent/route.ts`, `src/web/components/{RentSummary,SimilarList,MarketLookup,MarketNotes}.tsx`, `src/web/siteLinks.ts`, `rules.config/rules.v1.json`
- **리포트에 시세 조회 결과·비슷한 단지·확인 사이트 시트 추가, AI 해석 안내 문구 가림 수정, 전월세 API 조사 기록**: (1) 시세 조회에서 나온 "같은 지역 다른 단지" 거래 사례와 조회 안내 문구(조건에 맞는 거래 없음 등)가 리포트의 "시세·대안 단지" 시트에도 나오고, "함께 확인할 사이트" 링크가 같이 보입니다. (2) "분석하기" 버튼 고정 스타일이 리포트 안의 "AI 해석 요청" 버튼에도 적용돼 아래 안내 문구를 가리던 문제를 고쳤습니다. (3) 전월세 실거래 API 4종(아파트·오피스텔·연립다세대·단독다가구)을 실제로 호출해 필드를 확인하고 샘플·문서에 기록했습니다(앱 기능은 아직 연결하지 않음). 공개 API 변경 없음. — 관련 파일: `src/web/components/{MarketNotes,MarketLookup,SiteLinks,Analyzer}.tsx`, `src/app/globals.css`, `docs/public-data-api.md`, `tests/fixtures/public-data/`
- **매물 설명의 융자금을 사전 점검에 반영**: 매물 설명이나 캡처에 융자금이 금액으로 적혀 있으면 AI가 추출하고("융자 있음"처럼 금액이 없거나 근저당 채권최고액은 추출하지 않음), 확인 후 "입력칸에 적용"하면 계약 정보의 "융자금" 칸에 들어갑니다. 등기부를 입력하지 않았을 때 R-RATIO-01 이 (융자금 + 보증금) / 시세로 계산하며, 이 값은 등기부로 확인되지 않은 하한값이라고 근거에 밝힙니다(채권최고액으로 환산하지 않음). 등기부를 입력하면 무시하고 R-LTV-01 이 판정합니다. 매매에는 쓰지 않습니다. 공개 API 변경: `RiskInput.statedPriorLoan`(선택) 추가, `/api/listing` 응답에 `priorLoanManwon` 추가. — 관련 파일: `src/core/{types.ts,rules/ratio.ts}`, `src/adapters/llm/listing.ts`, `src/web/form.ts`, `src/web/components/{InputForm,ListingImport}.tsx`
- **월세 금액도 "입력칸에 적용"에 반영**: 매물 설명에서 추출한 월세(만원)를 대출·자금 계획의 "월세" 칸에도 넣어 중개보수 환산에 쓰입니다(전에는 추출만 하고 입력칸에 넣지 않았음). 추출 값이 없으면 기존 입력을 유지합니다. 의존성 감사 결과(운영 취약점 0건)를 로드맵에 기록했습니다. 공개 API 변경 없음. — 관련 파일: `src/web/components/{ListingImport,Analyzer}.tsx`, `docs/ROADMAP.md`
- **리포트 시트(탭) 분리, 입력 화면 정리, AI 기준값 지역 자동 입력, 막힌 사이트는 사이드바 생략**: (1) 분석 리포트를 종합 판정·위험 신호·필요 조건·자금 여력·대출 안내·체크리스트 시트로 나눴습니다(인쇄 때는 전체 출력). (2) 입력 화면을 섹션별 접이식으로 정리하고 AI 자동 채우기·세금·AI 기준값 제안은 접어 두어 필수 입력이 한 화면에 보이게 했습니다. (3) "AI로 기준값 제안받기"의 지역이 시세 조회의 주소·지역에서 자동으로 들어오고 시군구 목록에서 고를 수도 있습니다(전에는 빈 칸에 직접 써야 했음). (4) 네이버·호갱노노 링크는 빈 사이드바를 열지 않고 입력칸 아래에 "새 창에서 열기" 링크만 보여줍니다. 공개 API 변경 없음. — 관련 파일: `src/web/components/{ReportDialog,Analyzer,InputForm,FinanceFields,AssumptionAdvisor,ListingImport}.tsx`, `src/core/region/lookup.ts`, `src/app/globals.css`
- **좁은 창 레이아웃 수정, 분석하기 버튼 고정, 지역 자동 인식**: (1) 화면 폭이 아니라 본문 영역 폭을 기준으로 열을 나눠(컨테이너 쿼리) 사이드바가 열려 본문이 좁아져도 레이아웃이 깨지지 않습니다. (2) "분석하기·초기화" 버튼을 입력 카드 아래에 고정해 스크롤 없이 항상 보입니다. (3) 대출 기준값과 세금·수수료는 접이식으로 바꿔 화면이 한눈에 들어오게 했습니다(예시 가정 적용 상태 표시). (4) 시세 조회에 "주소·지역" 칸을 추가해 주소나 "서울 동대문구 휘경동"처럼 적으면 시군구 법정동코드와 법정동명을 자동으로 채우고, 매물 설명 추출 결과의 주소도 이 칸에 들어갑니다. 못 찾거나 시·도가 없어 하나로 정해지지 않으면 추측하지 않고 안내합니다. 공개 API 변경 없음. — 관련 파일: `src/app/globals.css`, `src/web/form.ts`, `src/web/components/{MarketLookup,FinanceFields,ListingImport}.tsx`
- **자산·소득 없이도 필요 조건 표시, 오피스텔 세금, 링크 사이드바, 설명 칸에 캡처 붙여넣기**: (1) 매매·매매가만 넣고 분석해도 "이 매물에 필요한 조건"(대출 한도, 필요 자기자금, 최소 연소득, 월 상환액)이 나옵니다. 이전에는 "대출·자금 계획"을 직접 켜고 기준값 5개를 입력해야 해서 아무것도 나오지 않았습니다. 처음에는 예시 가정(LTV 70·DSR 40·금리 4%·스트레스 +1.5%p·30년)을 채워 두고, 값을 그대로 쓰면 리포트에 "예시 가정이며 실제 은행·규제 기준이 아님"을 표시합니다. (2) 주택 유형이 오피스텔이면 주택 세율이 아니라 취득세 4.6%(4%+지방교육세 0.4%+농어촌특별세 0.2%)와 주거용 오피스텔 중개보수 상한(매매 0.5%, 임대차 0.4%)으로 계산합니다(잠정값, 공식 원문 미확인). (3) 매물 링크를 입력하면 오른쪽 사이드바에서 사이트를 보여줍니다(팝업 대신). 네이버 부동산·호갱노노는 표시를 막아 안내와 "새 창" 버튼만 보입니다. "함께 확인할 사이트"는 다시 링크만 제공합니다. (4) 별도 캡처 항목을 없애고 "매물 설명 붙여넣기" 칸에 캡처를 붙여넣으면 썸네일로 첨부됩니다. 공개 API 변경 없음. — 관련 파일: `src/web/financeForm.ts`, `src/web/components/{Analyzer,FinanceFields,ListingImport,SiteViewer,SiteLinks}.tsx`, `src/app/globals.css`
- **캡처 붙여넣기 전용으로 변경**: 이미지 선택 버튼을 없애고 점선 붙여넣기 영역을 두었습니다. 캡처를 클립보드에 복사한 뒤 이 화면 어디서든 Ctrl/⌘+V 하면 첨부됩니다(이전에는 입력칸에 포커스가 있어야만 동작). 붙여넣기 이벤트를 브라우저에서 시험했습니다. 공개 API 변경 없음. — 관련 파일: `src/web/components/ListingImport.tsx`, `src/app/globals.css`
- **매물 화면 캡처 첨부 + 사이트 보기 패널**: "매물 링크·설명으로 시작하기"에 캡처 이미지(최대 4장)를 붙여넣기(Ctrl/⌘+V) 또는 파일 선택으로 넣을 수 있습니다. 드래그가 안 되는 사이트(다방 등)도 캡처 → 붙여넣기로 됩니다. 이미지는 브라우저에서 긴 변 1600px 이하 JPEG 로 줄이고, "AI로 항목 추출"을 눌렀을 때만 비전 모델로 전송합니다(텍스트 없이 캡처만으로도 추출, 이미지 속 전화번호는 지울 수 없어 화면에 안내). 서버는 PNG·JPEG·WebP data URL 만 받고 개수·크기를 제한합니다. 또 매물 찾기 사이트와 입력한 매물 링크를 화면 안 팝업(프레임)으로 볼 수 있습니다. 응답 헤더를 확인해 프레임을 막는 네이버 부동산·호갱노노는 작은 팝업 창으로 열고(2026-11-12 확인), KB부동산·다방은 프레임에 표시됩니다. 앱은 프레임 안의 내용을 읽지 않습니다. 공개 API 변경: `POST /api/listing` 에 선택 필드 `images` 추가(텍스트 없이 이미지만도 허용). 실제 모델로 캡처 이미지만 보내 추출을 시험했습니다. — 관련 파일: `src/adapters/llm/{provider,openaiCompatible,listing}.ts`, `src/app/api/listing/route.ts`, `src/web/{imageAttach,siteViewer}.ts`, `src/web/components/{ListingImport,SiteViewer,SiteLinks}.tsx`
- **매물 설명 적용 시 시세 조회 자동 실행**: 매물 설명을 붙여넣고 "AI로 항목 추출 → 입력칸에 적용"을 누르면 매매·매매가뿐 아니라 주택 유형(아파트·빌라·오피스텔·단독다가구), 전용면적(평수로 적힌 값은 3.3058로 환산), 주소에서 찾은 시군구 법정동코드와 법정동명까지 채우고 시세 조회를 바로 실행합니다. 단지명이 없으면 같은 법정동 거래만 쓰도록 `dongName` 필터를 추가했습니다. 법정동코드 표(201곳)는 국토부 API로 코드마다 실제 응답이 오는지 검증한 것만 담았고, 2026 행정구역 개편으로 코드가 바뀐 지역(인천 일부, 광주·전남, 부천, 화성 등)과 주소만으로 지역이 하나로 정해지지 않는 경우는 추측하지 않고 직접 입력하도록 안내합니다. 실제 모델과 실제 API로 신길동 빌라 매물을 끝까지 시험했습니다. 공개 API 변경: `GET /api/market` 에 선택 쿼리 `dongName` 추가. — 관련 파일: `src/core/region/`, `src/adapters/llm/listing.ts`, `src/web/components/ListingImport.tsx`, `src/web/components/MarketLookup.tsx`
- **일반 버팀목·신혼부부 전세자금·디딤돌 칸별 금리표**: 이전에 추출하지 못했던 소득 구간 × 보증금(또는 대출기간)별 금리표를 공식 사이트(주택도시기금)가 페이지에서 쓰는 요청으로 읽어 대출 종류 카드에 표로 보여줍니다(확인 2026-11-11). 범위와 표의 최솟값·최댓값이 일치하는지 테스트로 확인합니다. 월세 대출·신생아 특례·은행별 실제 금리는 여전히 확인하지 못했습니다. 공개 API 변경 없음. — 관련 파일: `rules.config/loan-rates.json`, `src/web/loanRates.ts`, `src/web/components/RateBlock.tsx`, `docs/loan-rates.md`
- **단독·다가구 시세 조회**: 시세 조회에서 "단독·다가구"를 고르면 연면적(㎡)과 법정동명으로 같은 동·연면적 ±20% 거래의 중앙값을 시세로 입력합니다. 활용신청 승인 후 실제 응답으로 필드(`totalFloorAr`, `umdNm`)를 확인했고, 건물명이 없고 건물마다 대지·구조가 달라 항상 신뢰도 낮음으로 입력하며 단지 비교는 하지 않습니다. 연립다세대는 아직 승인 전이라 미검증입니다. 공개 API 변경: `GET /api/market` 의 `housing` 에 `house` 추가(면적은 연면적, `complexName` 은 법정동명). — 관련 파일: `src/adapters/public-data/housing.ts`, `tradeService.ts`, `src/web/components/MarketLookup.tsx`
- **화면 색상 선택(시스템 / 라이트 / 다크)**: 화면 오른쪽 위에서 시스템 설정을 따를지 라이트·다크로 고정할지 고를 수 있습니다. 기본은 이전처럼 시스템 설정을 따르고, 선택은 이 브라우저에만 저장됩니다(저장소를 쓸 수 없으면 시스템 설정). 깜빡임 없이 처음부터 선택한 색으로 그려집니다. 계산 로직은 바뀌지 않았습니다. — 관련 파일: `src/app/globals.css`, `src/app/layout.tsx`, `src/web/theme.ts`, `src/web/components/ThemeToggle.tsx`
- **방문 전 결론 (기준표 C1~C6) + AI 해석**: 분석 팝업 맨 위에 "보러 가도 됨 / 조건부 / 보러 가지 않음 권장" 결론을 보여줍니다. 결론은 AI가 아니라 공개된 기준표가 정합니다: C1·C2 필요 자기자금 대비 보유 자산(기준·스트레스 금리, 부족률 10% 이내 주의), C3 연소득 대비 상환 부담(DSR 한도 90% 이하 충족), C4 보증금/시세(70%·80%), C5 시세 신뢰도, C6 규칙 점검 등급. 미달이 하나라도 있으면 방문 비권장, 주의·판단 불가가 있으면 조건부입니다. 시세가 없으면 미달이 아니라 주의로 처리합니다. 기준 임계치는 `rules.config` 의 `verdict` 에 있는 잠정값이며 써 본 뒤 조정합니다. "AI 해석 요청"을 누르면 LLM이 기준별 해석, 확인할 조건, 다음 행동을 쓰고, 결론에 이견이 있으면 근거와 함께 따로 표시합니다(결론은 바뀌지 않음). 안전장치: LLM에는 금액 없이 상태·비율만 보내고, 기준표에 없는 숫자나 금액 표현이 든 문장은 버립니다. 실제 모델로 시험해 기준표 숫자만 인용하는 것을 확인했습니다(13초). 공개 API 추가: `POST /api/verdict`. — 관련 파일: `src/core/verdict/criteria.ts`, `src/adapters/llm/verdict.ts`, `src/app/api/verdict/route.ts`, `src/web/components/VerdictPanel.tsx`, `rules.config/rules.v1.json`
- **비슷한 실거래 단지 비교**: 시세 조회 결과 아래에 같은 지역에서 비슷한 면적(±허용 오차)으로 최근 거래된 다른 단지를 최대 5곳, 조회 시세에 가까운 순으로 보여줍니다(단지별 중앙값·거래 건수·시세 대비 %). 거래가 1건뿐인 단지는 우연일 수 있어 제외하고 해제 거래도 뺍니다. 판매 중인 매물이 아니라 실제 거래 사례이며, 지금 나온 매물은 매물 사이트 링크에서 확인하도록 안내합니다. 공개 API 변경: `GET /api/market` 응답에 `similar` 배열 추가. — 관련 파일: `src/core/market/similar.ts`, `src/adapters/public-data/tradeService.ts`, `src/web/components/MarketLookup.tsx`
- **함께 확인할 사이트 링크**: 결과 영역에 매물 찾기(네이버 부동산·직방·다방·호갱노노·KB부동산), 가격·건물 확인(실거래가 공개시스템·공시가격 알리미·건축HUB), 계약 전 확인(인터넷등기소·HUG·위택스·홈택스) 링크를 접이식으로 보여줍니다. 링크만 제공하며 앱이 해당 사이트로 정보를 보내지 않습니다(매물 목록은 공개 API가 없고 스크래핑은 약관상 위험). 접속 확인은 2026-11-09, 직방은 봇 접근을 막아 브라우저에서만 열립니다. 공개 API 변경 없음. — 관련 파일: `src/web/siteLinks.ts`, `src/web/components/SiteLinks.tsx`
- **오피스텔 시세 조회 검증 완료·등기부 파서 형식 보강**: 활용신청 승인 후 오피스텔 매매 API를 실제로 호출해 필드(`offiNm`, `dealAmount`, `excluUseAr`)가 맞는 것을 확인하고 실제 응답을 계약 테스트로 추가했습니다(신뢰도는 계속 낮음으로 입력). 등기부 파서는 실제 열람본("현재 유효사항")에 나온 `공유자전원지분전부이전` 등기목적을 소유권 이전으로 읽고 "기록사항 없음" 을구를 처리합니다. 공개 API 변경 없음. — 관련 파일: `src/adapters/public-data/housing.ts`, `src/core/registry/parse.ts`, `tests/`
- **MIT 라이선스**: `LICENSE` 파일을 추가하고 `package.json` 의 `license` 를 `UNLICENSED` 에서 `MIT` 로 바꿨습니다. 이전에는 라이선스가 없어 재사용 허가가 정해지지 않았습니다. 저작권자 표기는 GitHub 계정명(`beomzh`)이며 실명으로 바꾸려면 `LICENSE` 한 줄만 고치면 됩니다. 공개 API 변경 없음. — 관련 파일: `LICENSE`, `package.json`, `README.md`
- **빌라(연립·다세대)·오피스텔 시세 조회 (미검증)**: 시세 조회에서 주택 유형을 고를 수 있습니다. 엔드포인트는 존재하지만 현재 키에는 활용신청이 되어 있지 않아(오류 30) 실제 응답으로 필드를 확인하지 못했습니다. 건물명 필드(`mhouseNm`, `offiNm`)는 추정이라 틀리면 "거래 없음"으로 보입니다. 이 유형은 항상 신뢰도 낮음으로 입력하고, 키에 권한이 없으면 활용신청 안내를 보여줍니다. 다가구·단독은 지원하지 않습니다. 공개 API 변경: `GET /api/market` 에 선택 쿼리 `housing=apt|rowhouse|officetel`(기본 apt) 추가. — 관련 파일: `src/adapters/public-data/housing.ts`, `tradeService.ts`, `src/web/components/MarketLookup.tsx`, `docs/public-data-api.md`
- **재산세 계산 (매매)**: 공시가격(만원)을 입력하면 공정시장가액비율(일반 60%, 1세대 1주택 공시가 3억 이하 43%·6억 이하 44%·초과 45%)로 과세표준을 구해 누진세율(0.1~0.4%, 1세대 1주택 특례 0.05~0.35%)과 도시지역분 0.14%, 지방교육세 20%를 더한 연간 재산세를 세금 근거 패널에 안내합니다. 필요 자금에는 넣지 않습니다. 세율표는 세무 칼럼 사이트 기재 내용(2차 자료)이라 잠정값이고, 세부담상한·조례 탄력세율·소방분은 반영하지 않으며 종합부동산세는 세제 개편이 진행 중이라 계산하지 않습니다. 공개 API 변경 없음. — 관련 파일: `src/core/finance/taxes.ts`, `rules.config/rules.v1.json`, `src/web/financeForm.ts`, `src/web/components/FinanceFields.tsx`
- **등기부 텍스트 자동 입력**: 등기사항전부증명서 PDF에서 복사한 텍스트를 붙여넣으면 소유자, 소유권이전 일자, 갑구의 미말소 신탁·압류·가압류·가처분·경매·임차권등기, 을구 근저당(채권최고액·설정일·말소 여부)을 읽어 입력칸을 채웁니다. "N번…등기말소" 행이 있는 항목만 말소로 보고, 신탁·변경등기·가등기 등 불확실한 것은 채우지 않고 경고로 남기며 인식 신뢰도를 낮춥니다. 분석은 브라우저 안에서만 실행되고 주민등록번호 등 원문은 결과에 담지 않습니다. 합성 문서로만 검증했고 실제 문서는 아직 시험하지 못했습니다. 공개 API 변경 없음. — 관련 파일: `src/core/registry/parse.ts`, `src/web/registryImport.ts`, `src/web/components/RegistryImport.tsx`
- **대출 상품 금리 안내**: 대출 종류 카드에 공식 사이트에서 확인한 금리를 출처 링크와 확인일(2026-11-09)과 함께 보여줍니다. 청년전용 버팀목은 소득 구간별 2.2/2.5/2.9/3.3%, 일반 버팀목 2.5~3.5%, 신혼부부 전세 1.9~3.3%, 디딤돌 2.85~4.15%(공식 안내 범위), 보금자리론은 만기별 고정금리 표(공시 2026-11-09), 시중은행은 기준금리 COFIX(공시 2026-10-15)입니다. 일반 버팀목·신혼·디딤돌의 칸별 금리표와 은행별 실제 금리, 월세 대출·신생아 특례는 확인하지 못해 화면에 그렇게 표시합니다. 확인일이 35일을 넘으면 경고합니다. 이전에는 금리 숫자를 보여주지 않았습니다. 공개 API 변경 없음. — 관련 파일: `rules.config/loan-rates.json`, `src/web/loanRates.ts`, `src/web/components/RateBlock.tsx`, `docs/loan-rates.md`
- **AI 기준값 제안 (선택)**: 지역·보유 주택 수·생애최초 여부에 따라 달라지는 대출 기준값(LTV·DSR·금리·스트레스 가산·기간)을 AI가 제안합니다. 확인한 뒤 "적용"을 눌러야 입력 칸이 채워지고, 적용한 칸은 리포트에 "다음 대출 기준값은 AI가 제안한 값입니다: …"로 표시됩니다(그 칸을 직접 고치면 그 칸만 표시에서 빠짐). 모르면 `null`, 신뢰도는 `low`/`medium` 만 허용, 범위 검증, 소득·자산·성명은 전송하지 않습니다. 실제 모델로 시험한 결과 DSR·기간 정도만 채우고 LTV·금리는 "판단하지 못함"으로 답하는 경우가 많았습니다(한 번에 10~20초). 공개 API 추가: `POST /api/assumptions`. — 관련 파일: `src/adapters/llm/assumptions.ts`, `src/app/api/assumptions/route.ts`, `src/web/components/AssumptionAdvisor.tsx`, `src/web/assumptions.ts`
- **취득세·중개보수 법정 계산**: 매매는 취득세(6억 이하 1%, 9억 이상 3%, 사이는 선형 산식)에 지방교육세와 전용 85㎡ 초과 시 농어촌특별세를 더하고, 중개보수는 매매·전세 구간 요율과 한도액, 월세 환산보증금 기준으로 계산합니다. 다주택·조정대상지역 중과와 감면은 반영하지 않고 그 사실을 근거 문구로 알립니다. 중과 세율은 직접 입력할 수 있습니다. 취득세 표준세율은 법 조문 사본으로 확인했고, 중개보수 요율표는 서울시 조례 원문을 확인하지 못해 잠정값입니다. 공개 API 변경 없음. — 관련 파일: `src/core/finance/taxes.ts`, `rules.config/rules.v1.json`
- **월세 입력**: 월세를 입력하면 중개보수를 환산보증금(보증금 + 월세 × 100, 5천만 원 미만이면 × 70)으로 계산합니다. — 관련 파일: `src/web/components/FinanceFields.tsx`
- **세금·수수료 계산 근거 패널**: 리포트에서 어떤 요율을 적용했고 무엇을 반영하지 않았는지(중과, 감면, 부가세, 보유세) 확인할 수 있습니다. — 관련 파일: `src/web/components/RequirementsReport.tsx`
- **운영 가이드** `docs/operations.md`: 환경 변수, Docker 운영, 로그 형식, 문제 해결을 README에서 분리했습니다.

### Changed

- **연립다세대(빌라) 시세 조회를 실제 응답으로 검증하고 엔드포인트를 바로잡았습니다**: 폐기된 구버전 주소(`RTMSDataSvcRHTrade`)를 쓰고 있어 승인된 키로도 "미등록(코드 30)"이 나왔습니다. 올바른 주소(`RTMSDataSvcRHTrade2`)로 실제 응답을 받아 필드(`mhouseNm`, `excluUseAr`)를 확인하고 계약 테스트를 추가했으며, 화면의 "미검증" 표시를 없앴습니다. 신뢰도는 계속 낮음으로 입력합니다. 공개 API 변경 없음. — 관련 파일: `src/adapters/public-data/housing.ts`, `docs/public-data-api.md`
- **AI 해석에 영어 등급명이 섞이던 문제를 고쳤습니다**: 규칙 점검 등급을 LLM에 "yellow" 대신 "주의"처럼 한글로 전달합니다. — 관련 파일: `src/core/verdict/criteria.ts`
- **넓은 화면에서 입력 폼을 2단으로 배치**: 1100px 이상에서 왼쪽에 매물 가져오기·계약 정보, 오른쪽에 시세·등기부·대출 계획을 두고 분석 결과 요약은 오른쪽 끝에 고정합니다. 페이지 최대 너비를 1120px에서 1480px로 넓혀 옆 여백과 세로 스크롤을 줄였습니다. 좁은 화면은 이전처럼 한 줄입니다. 계산 로직은 바뀌지 않았습니다. — 관련 파일: `src/app/globals.css`, `src/web/components/InputForm.tsx`
- **필요 자금 합계의 기본값이 달라집니다**: 이전에는 부대비용을 비워 두면 0원으로 계산했는데, 이제 "법정 요율로 자동 계산"이 기본으로 켜져 있어 비워 두면 취득세(매매)와 중개보수가 자동으로 들어갑니다. 세율·금액을 직접 입력하면 그 값을 쓰고, 체크를 끄면 예전처럼 입력한 값만 씁니다. 코드 API는 바뀌지 않았고 화면 설정과 결과 금액이 달라집니다. — 관련 파일: `src/web/financeForm.ts`
- **분석 결과가 오른쪽 패널 대신 팝업으로 열립니다**: 분석하기를 누르면 상세 리포트가 팝업(ESC·배경 클릭·닫기로 닫힘)으로 열리고, 오른쪽에는 등급 요약과 "상세 리포트 열기" 버튼이 남습니다. 인쇄는 팝업 내용만 인쇄합니다. 계산 로직은 바뀌지 않았습니다. — 관련 파일: `src/web/components/ReportDialog.tsx`, `src/web/components/Analyzer.tsx`
- **README를 새로 썼습니다**: 정의, 실제 실행 결과, 입력별로 알 수 있는 것, 설치·빠른 시작, 지금 안 되는 것, FAQ 순으로 재구성했습니다. 낡은 설명("환경 변수가 필요 없다", 어댑터 "예정")을 바로잡았습니다. — 관련 파일: `README.md`
- **문서를 코드에 맞췄습니다**: 아키텍처 문서의 룰 목록에 빠져 있던 `R-RATIO-01`과 모듈 설명을 갱신하고, `docker-compose.yml`의 낡은 주석을 바로잡았습니다. — 관련 파일: `docs/architecture.md`, `docker-compose.yml`

### 확인하지 못한 것

- 보유세(재산세·종합부동산세)는 세율표를 확인하지 못했고 2026년 세제 개편이 진행 중이라 계산하지 않습니다.
- 서울시 중개보수 조례 원문과 2026년 취득세 개정 여부는 공식 원문으로 최종 확인이 필요합니다.

[2026-11-10 10:20]
- [Added] - src/core/finance/taxes.ts `acquisitionTax` `brokerageFee`: 주택 유상취득 취득세(6억 이하 1%·9억 이상 3%·사이 선형 산식, 지방교육세, 85㎡ 초과 농어촌특별세)와 중개보수 상한(매매·전세 구간 요율, 한도액, 월세 환산보증금) 법정 계산. 중과·감면은 미반영하고 그 사실을 근거 문구로 알림
- [Added] - src/core/config.ts, rules.config/rules.v1.json: 취득세·중개보수 표 설정(출처·잠정 표시). 취득세는 법 조문 사본으로 확인, 중개보수는 서울 조례 원문 미확인으로 provisional
- [Added] - tests/golden/taxes.test.ts: 5억·7억·8억 취득세, 85㎡ 경계, 중과 직접 입력, 매매·전세·월세 중개보수 구간·한도·경계 손계산 검증 25건

[2026-11-09 21:10]
- [Added] - src/adapters/log/logger.ts `createLogger` `getLogger`: 한 줄 JSON 구조화 로그. 성명·금액·텍스트·키 등 금지 이름의 필드는 값을 남기지 않고, 알려진 시크릿 값은 가리며, 문자열은 200자로 제한
- [Changed] - src/app/api/market/route.ts, src/app/api/listing/route.ts: 성공·실패·잘못된 요청마다 요청 번호·소요 시간·건수·결과·오류 종류를 로그로 남김 (매물 텍스트·단지명·링크·키는 미포함)
- [Changed] - src/adapters/public-data/tradeService.ts, src/adapters/llm/openaiCompatible.ts: 재시도·캐시 적중 등 운영 이벤트 로그 훅 추가 (키·URL·모델명 미전달)
- [Changed] - docker-compose.yml, .env.example: 로그 회전(10MB×3), LOG_LEVEL 설명 추가
- [Added] - tests/log/*.test.ts: 로거 금지 필드·시크릿 가림·레벨, 어댑터 로그 훅 비식별 테스트 8건
- [Added] - src/core/finance/requirements.ts `evaluateRequirements`: 이 가격이면 최대 대출·필요 자기자금·월 상환액·필요 연소득(DSR, 스트레스 포함)을 대출 비율별로 역산. 자산·소득 없이 대출 기준값만으로 계산
- [Changed] - src/core/finance/affordability.ts `requiredFundItems`: 입력 타입을 필요한 필드만으로 완화해 역산에서 재사용
- [Added] - src/web/financeForm.ts `buildFinancePlan`: 자산·소득을 선택 입력으로 하고(하나만 입력하면 오류) 필요 조건과 내 상황 판정 입력을 함께 생성
- [Added] - src/web/components/RequirementsReport.tsx: "이 매물에 필요한 조건" 표(대출 최대 요약, 총 필요 자금, 대출 비율별 자기자금·월 상환·필요 연소득)
- [Changed] - src/web/components/FinanceFields.tsx, Analyzer.tsx: 자산·소득 선택 입력, 예시 값 채우기 버튼(공식 값 아님 명시), 결과에 필요 조건 섹션 연결
- [Added] - tests/golden/requirements.test.ts, tests/web/financeForm.test.ts: 역산 값·단조성·정방향 일치·병목·검증 12건과 변환 5건
- [Changed] - docs/ADR-0007, docs/ROADMAP.md, README.md: 필요 조건 역산과 예시 버튼 결정, 로그 보는 법 문서화

[2026-11-09 19:20]
- [Added] - src/web/loans.ts `LOAN_PRODUCTS` `loansFor`: 계약 유형별 대출 상품 종류(버팀목·청년전용·신혼·신생아·시중은행 전세·월세 관련·디딤돌·보금자리론·시중은행 주담대)와 매물 점검 연계 확인 포인트. 한도·금리·소득 기준 같은 낡기 쉬운 숫자는 담지 않음
- [Added] - src/web/components/LoanCatalog.tsx: 분석 결과 아래에 대출 종류 카드 표시, 위험·주의 등급의 전세 매물에는 보증 거절·한도 축소 가능성 경고
- [Added] - tests/web/loans.test.ts: 유형별 안내, 중복·누락, 숫자 미포함(금리·금액 패턴 금지) 테스트 5건
- [Changed] - src/web/components/Analyzer.tsx, docs/ROADMAP.md: 대출 카드 연결과 진행 상태 갱신

[2026-11-09 18:10]
- [Added] - src/adapters/llm/provider.ts, openaiCompatible.ts: LLM 공급자 인터페이스와 OpenAI 호환(Responses·Chat Completions) 공급자. 구조화 출력(JSON Schema)+zod 검증, 재시도(4xx 제외), 타임아웃, 주소·키·모델명이 오류 메시지에 노출되지 않도록 비식별, 환경변수 팩토리
- [Added] - src/adapters/llm/listing.ts: 매물 설명 항목 추출. 전화번호·이메일 제거, `<listing>` 구획 입력과 주입 방어 시스템 프롬프트, LLM 출력 범위 검증(`sanitizeListing`), 링크의 플랫폼·매물 번호 힌트 해석(링크 내용은 읽지 않음)
- [Added] - src/app/api/listing/route.ts: LLM 항목 추출 서버 라우트 (LLM 미설정 시 503 안내, 텍스트·키는 로그에 남기지 않음)
- [Added] - src/web/components/ListingImport.tsx: 링크·설명 붙여넣기, AI 추출, 결과 확인 후 입력칸 적용, 설명에 적힌 주의 문구 표시
- [Changed] - src/web/form.ts, MarketLookup.tsx, InputForm.tsx, Analyzer.tsx: 시세 조회 입력을 폼 상태로 올려 추출 결과가 단지명·면적을 채우도록 연결, 리포트 모드 문구를 사전 점검으로 변경
- [Added] - tests/llm/*.test.ts: 공급자(Responses·Chat, 재시도, 비식별, 환경변수)와 추출(PII 제거, 구획·주입, 범위 검증, URL 힌트) 테스트 29건
- [Changed] - docs/adr/0005-llm-provider.md, docs/threat-model.md, docs/ROADMAP.md, README.md, .env.example: 실제 연동 결과(Responses API, Bearer 인증), 전송 범위, 주입 방어, 환경변수 설명 갱신

[2026-11-09 18:10]
- [Added] - src/adapters/llm/provider.ts, openaiCompatible.ts: LLM 공급자 인터페이스와 OpenAI 호환(Responses·Chat Completions) 공급자. 구조화 출력(JSON Schema)+zod 검증, 재시도(4xx 제외), 타임아웃, 주소·키·모델명이 오류 메시지에 노출되지 않도록 비식별, 환경변수 팩토리
- [Added] - src/adapters/llm/listing.ts: 매물 설명 항목 추출. 전화번호·이메일 제거, `<listing>` 구획 입력과 주입 방어 시스템 프롬프트, LLM 출력 범위 검증(`sanitizeListing`), 링크의 플랫폼·매물 번호 힌트 해석(링크 내용은 읽지 않음)
- [Added] - src/app/api/listing/route.ts: LLM 항목 추출 서버 라우트 (LLM 미설정 시 503 안내, 텍스트·키는 로그에 남기지 않음)
- [Added] - src/web/components/ListingImport.tsx: 링크·설명 붙여넣기, AI 추출, 결과 확인 후 입력칸 적용, 설명에 적힌 주의 문구 표시
- [Changed] - src/web/form.ts, MarketLookup.tsx, InputForm.tsx, Analyzer.tsx: 시세 조회 입력을 폼 상태로 올려 추출 결과가 단지명·면적을 채우도록 연결, 리포트 모드 문구를 사전 점검으로 변경
- [Added] - tests/llm/*.test.ts: 공급자(Responses·Chat, 재시도, 비식별, 환경변수)와 추출(PII 제거, 구획·주입, 범위 검증, URL 힌트) 테스트 29건
- [Changed] - docs/adr/0005-llm-provider.md, docs/threat-model.md, docs/ROADMAP.md, README.md, .env.example: 실제 연동 결과(Responses API, Bearer 인증), 전송 범위, 주입 방어, 환경변수 설명 갱신

[2026-11-09 16:30]
- [Added] - src/core/rules/ratio.ts `depositToMarketRatio`: 등기부 없이 보증금/시세 비율(R-RATIO-01)로 방문 전 사전 점검. 선순위를 모르는 하한값임을 근거에 명시하고, 기준 초과 시 등기부 없이도 red/yellow 판정 (등기부가 있으면 R-LTV-01 이 대신 판정)
- [Changed] - src/core/engine.ts `RULES`: R-RATIO-01 등록
- [Added] - tests/golden/pre-visit-ratio.test.ts: 70/80% 경계값, 하한값 안내, 시세 없음, 등기부 있음·매매 비적용, 판단 보류 테스트 8건

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

