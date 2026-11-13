#!/usr/bin/env node
// 시중은행 실제 대출금리(은행연합회 비교공시) 조회. 기본은 화면에 표로 출력만 한다.
//   npm run rates:banks                 최신 공시월의 은행별 평균금리를 출력
//   npm run rates:banks -- --write      rules.config/loan-rates.json 의 bank-jeonse·bank-mortgage 에 반영(결과는 git diff 로 검토)
import { readFileSync, writeFileSync } from 'node:fs';
import {
  buildRequestBody,
  KFB_LOAN_TYPE,
  KFB_PAGE,
  KFB_RESULT,
  monthsAgo,
  parseBankRates,
  parseBankValues,
} from './bankRates.mjs';

const write = process.argv.includes('--write');
const UA = { 'user-agent': 'Mozilla/5.0 (rate-check)' };
const today = new Date().toISOString().slice(0, 10);

const page = new Uint8Array(await (await fetch(KFB_PAGE, { headers: UA })).arrayBuffer());
const bankValues = parseBankValues(page);
if (bankValues.length === 0) {
  console.error('은행 목록을 읽지 못했습니다 (사이트 구조가 바뀌었을 수 있음)');
  process.exit(1);
}

async function load(loanType) {
  // 직전 달부터 최대 3개월 전까지 금리가 있는 가장 최근 공시월을 찾는다
  const now = new Date();
  let ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  for (let back = 1; back <= 3; back++) {
    const cand = monthsAgo(ym, back);
    const res = await fetch(KFB_RESULT, {
      method: 'POST',
      headers: {
        ...UA,
        'content-type': 'application/x-www-form-urlencoded',
        referer: KFB_PAGE,
      },
      body: buildRequestBody({ year: cand.slice(0, 4), month: cand.slice(4), loanType, bankValues }),
    });
    const parsed = parseBankRates(new Uint8Array(await res.arrayBuffer()));
    if (parsed.banks.length > 0) return { ym: cand, ...parsed };
    await new Promise((r) => setTimeout(r, 800));
  }
  return undefined;
}

const targets = [
  { productId: 'bank-mortgage', label: '분할상환방식 주택담보대출', type: KFB_LOAN_TYPE.mortgage },
  { productId: 'bank-jeonse', label: '전세자금대출', type: KFB_LOAN_TYPE.jeonse },
];
const json = JSON.parse(readFileSync(new URL('../rules.config/loan-rates.json', import.meta.url), 'utf8'));

for (const t of targets) {
  const r = await load(t.type);
  if (!r) {
    console.error(`${t.label}: 공시된 금리를 찾지 못했습니다`);
    process.exitCode = 1;
    continue;
  }
  console.log(
    `\n${t.label} — ${r.ym.slice(0, 4)}-${r.ym.slice(4)} 공시, 신규취급액 기준 평균금리 (${r.banks.length}개 은행)`,
  );
  for (const b of [...r.banks].sort((a, c) => (a.avgPercent ?? 99) - (c.avgPercent ?? 99)))
    console.log(`  ${b.name.padEnd(14)} 평균 ${b.avgPercent ?? '-'}%  (평균 신용점수 ${b.avgScore ?? '-'})`);
  if (write) {
    const p = json.products.find((x) => x.productId === t.productId);
    p.bankRates = {
      basis: `${t.label} 신규취급액 기준 평균금리 (CB사 신용점수 구간별, 은행연합회 비교공시)`,
      publishedYm: `${r.ym.slice(0, 4)}-${r.ym.slice(4)}`,
      scoreBands: r.scoreBands,
      banks: r.banks,
    };
    p.source = {
      ...p.source,
      name: '전국은행연합회 소비자포털 — 대출금리비교(가계대출금리), COFIX 공시',
      url: KFB_PAGE,
      checkedAt: today,
    };
    p.notCovered = [
      '공시 금리는 직전 달 신규 취급 대출의 신용점수 구간별 평균이라 실제 적용 금리와 다를 수 있습니다. 은행별 우대금리·보증기관·상환 방식에 따라 달라지니 최종 금리는 은행에 확인하세요.',
    ];
  }
}
if (write) {
  writeFileSync(
    new URL('../rules.config/loan-rates.json', import.meta.url),
    `${JSON.stringify(json, null, 2)}\n`,
  );
  console.log('\nrules.config/loan-rates.json 에 반영했습니다. git diff 로 확인하고 prettier 를 돌리세요.');
}
