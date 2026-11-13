#!/usr/bin/env node
// 대출 금리 점검: rules.config/loan-rates.json 의 주택도시기금 상품 금리가 공식 사이트의 현재 값과 같은지 비교한다.
// 파일은 고치지 않는다(읽기 전용). 차이가 있으면 공식 페이지에서 직접 확인한 뒤 loan-rates.json 과 docs/loan-rates.md 를 고친다.
//   사용: npm run rates:check        종료 코드 0 = 모두 일치, 1 = 차이 또는 확인 실패
import { readFileSync } from 'node:fs';
import {
  daysSince,
  diffEligibility,
  diffGrid,
  diffWolse,
  flattenGrid,
  GRID_PRODUCTS,
  NHUF_ENDPOINT,
  parseHousingStableWolse,
  parseLoanRates,
  pageText,
  parseYouthWolse,
} from './loanRateCheck.mjs';

const data = JSON.parse(readFileSync(new URL('../rules.config/loan-rates.json', import.meta.url), 'utf8'));
const byId = new Map(data.products.map((p) => [p.productId, p]));
const today = new Date().toISOString().slice(0, 10);
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { 'user-agent': 'Mozilla/5.0 (rate-check)' };

async function fetchText(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: { ...UA, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

for (const g of GRID_PRODUCTS) {
  const saved = byId.get(g.id);
  if (!saved?.grid) {
    problems.push(`${g.id}: 저장된 칸별 금리표가 없습니다`);
    continue;
  }
  try {
    const body = new URLSearchParams({ newBabyGetBuySelect: g.select, productgb: g.gb });
    const text = await fetchText(NHUF_ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    const diffs = diffGrid(g.id, flattenGrid(saved.grid), parseLoanRates(text));
    console.log(diffs.length === 0 ? `일치  ${g.id} (${flattenGrid(saved.grid).length}칸)` : `다름  ${g.id}`);
    problems.push(...diffs);
  } catch (e) {
    problems.push(`${g.id}: 확인하지 못했습니다 (${e.message})`);
  }
  await sleep(800);
}

const wolse = [
  ['housing-stable-wolse', parseHousingStableWolse],
  ['youth-wolse', parseYouthWolse],
];
for (const [id, parse] of wolse) {
  const saved = byId.get(id);
  try {
    const diffs = diffWolse(id, saved, parse(await fetchText(saved.source.url)));
    console.log(diffs.length === 0 ? `일치  ${id}` : `다름  ${id}`);
    problems.push(...diffs);
  } catch (e) {
    problems.push(`${id}: 확인하지 못했습니다 (${e.message})`);
  }
  await sleep(800);
}

// 대출 대상 요건(소득·순자산·보증금·나이·면적)이 공식 페이지에 그대로 적혀 있는지 확인한다
const eligibility = JSON.parse(
  readFileSync(new URL('../rules.config/loan-eligibility.json', import.meta.url), 'utf8'),
);
for (const product of eligibility.products) {
  try {
    const diffs = diffEligibility(product, pageText(await fetchText(product.source.url)));
    console.log(diffs.length === 0 ? `일치  요건 ${product.productId}` : `다름  요건 ${product.productId}`);
    problems.push(...diffs);
  } catch (e) {
    problems.push(`${product.productId} 요건: 확인하지 못했습니다 (${e.message})`);
  }
  await sleep(800);
}

// 이 스크립트가 보지 않는 상품(보금자리론·COFIX 등)은 확인일이 오래됐는지만 알린다
const covered = new Set([...GRID_PRODUCTS.map((g) => g.id), 'housing-stable-wolse', 'youth-wolse']);
for (const p of data.products) {
  if (covered.has(p.productId)) continue;
  const days = daysSince(p.source.checkedAt, today);
  console.log(
    `수동  ${p.productId} — 확인일 ${p.source.checkedAt} (${days}일 전)${days > 35 ? ' ← 35일이 지났으니 공식 페이지에서 다시 확인하세요' : ''}`,
  );
}

if (problems.length > 0) {
  console.error('\n차이 또는 확인 실패:');
  for (const p of problems) console.error(`- ${p}`);
  console.error(
    '\n공식 페이지에서 직접 확인한 뒤 rules.config/loan-rates.json(금리) 또는 loan-eligibility.json(요건)과 docs/loan-rates.md 를 고치세요.',
  );
  process.exit(1);
}
console.log('\n점검 대상 상품의 금리와 대출 대상 요건이 모두 저장값과 같습니다.');
