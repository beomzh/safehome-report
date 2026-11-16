'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { VERDICT_LABEL } from '../../core';
import { runAnalysis } from '../analysis';
import type { AnalysisResult } from '../analysis';
import { CHECKLIST } from '../checklist';
import { emptyForm } from '../form';
import type { FormState } from '../form';
import { defaultFinanceForm } from '../financeForm';
import type { FinanceFormState } from '../financeForm';
import { LOAN_PRODUCTS } from '../loans';
import { gradeInfo, formatWon } from '../present';
import { defaultProfile } from '../profile';
import type { ProfileState } from '../profile';
import { saveSession } from '../sessionState';
import { ListingImport } from './ListingImport';
import { MarketLookup } from './MarketLookup';
import type { LookupInfo } from './MarketLookup';
import { ProfileFields } from './ProfileFields';
import { ReportDialog } from './ReportDialog';
import { buildReportTabs } from './reportTabs';

const TONE = { go: 'green', conditional: 'yellow', avoid: 'red' } as const;
const ICON = { go: '✅', conditional: '⚠️', avoid: '⛔' } as const;
const REC_LABEL = { likely: '해당 가능', check: '확인 필요', unlikely: '해당 안 됨' } as const;
/** 대략의 규모를 보여주는 화면이라 만원 단위로 올림(소득·자금)·반올림(월 상환) 한다 */
const upMan = (won: number) => Math.ceil(won / 10_000) * 10_000;
const roundMan = (won: number) => Math.round(won / 10_000) * 10_000;
const nameOf = (id: string) => LOAN_PRODUCTS.find((p) => p.id === id)?.name ?? id;

/** 방문 전 점검 — 링크·캡처만 넣으면 "보러 갈지"와 대략의 대출 규모를 바로 보여준다. 입력은 최소한만 받는다 */
export function PreVisit() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fin, setFin] = useState<FinanceFormState>(defaultFinanceForm);
  const [profile, setProfile] = useState<ProfileState>(defaultProfile);
  const [open, setOpen] = useState(false);
  const [lookupInfo, setLookupInfo] = useState<LookupInfo>({
    similar: [],
    message: null,
    rent: null,
    kind: 'jeonse',
  });

  const outcome = useMemo(() => runAnalysis(form, fin, profile), [form, fin, profile]);
  const result: AnalysisResult | null = outcome.ok ? outcome.result : null;
  const hasAmount = form.amountManwon.trim() !== '';

  const goAfter = () => saveSession({ form, fin, profile });

  return (
    <div className="layout">
      <div className="inputs">
        <section className="card">
          <h2>1. 매물 넣기</h2>
          <ListingImport setForm={setForm} setFin={setFin} autoApply />
        </section>

        <section className="card">
          <h2>2. 읽은 내용 (틀리면 고치세요)</h2>
          <div className="row2">
            <label className="field">
              <span>거래 유형</span>
              <select
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as FormState['kind'] }))}
              >
                <option value="jeonse">전세</option>
                <option value="monthly">월세</option>
                <option value="sale">매매</option>
              </select>
            </label>
            <label className="field">
              <span>{form.kind === 'sale' ? '매매가 (만원)' : '보증금 (만원)'}</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                placeholder="예: 30,000"
                value={form.amountManwon}
                onChange={(e) => setForm((f) => ({ ...f, amountManwon: e.target.value }))}
              />
            </label>
          </div>
          {form.kind === 'monthly' && (
            <label className="field">
              <span>월세 (만원)</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                placeholder="예: 80"
                value={fin.monthlyRentManwon}
                onChange={(e) => setFin((f) => ({ ...f, monthlyRentManwon: e.target.value }))}
              />
            </label>
          )}
          <label className="field">
            <span>주소</span>
            <input
              autoComplete="off"
              placeholder="예: 서울특별시 동대문구 휘경동 123-4"
              value={form.lookupAddress}
              onChange={(e) => setForm((f) => ({ ...f, lookupAddress: e.target.value }))}
            />
          </label>
          <div className="row2">
            <label className="field">
              <span>전용면적 (㎡)</span>
              <input
                inputMode="decimal"
                autoComplete="off"
                placeholder="예: 59.9"
                value={form.lookupAreaM2}
                onChange={(e) => setForm((f) => ({ ...f, lookupAreaM2: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>주택 유형</span>
              <select
                value={form.lookupHousing}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lookupHousing: e.target.value as FormState['lookupHousing'] }))
                }
              >
                <option value="apt">아파트</option>
                <option value="rowhouse">연립·다세대(빌라)</option>
                <option value="officetel">오피스텔</option>
                <option value="house">단독·다가구</option>
              </select>
            </label>
          </div>
          <details className="fold">
            <summary>시세 조회 (자동) — 단지명·법정동코드 확인</summary>
            <MarketLookup form={form} setForm={setForm} onInfo={setLookupInfo} />
          </details>
        </section>

        <section className="card">
          <h2>3. 내 상황 (대출 추정용)</h2>
          <ProfileFields profile={profile} setProfile={setProfile} fin={fin} setFin={setFin} compact />
        </section>
      </div>

      <div className="results">
        {!hasAmount ? (
          <section className="card empty">
            <h2>방문 전 점검 결과</h2>
            <p className="muted">
              매물 링크와 캡처(또는 설명 글)를 넣고 “AI로 항목 추출”을 누르면, 보러 갈지와 대략의 대출 규모를
              여기에 바로 보여줍니다. AI를 쓰지 않으려면 금액만 직접 입력해도 됩니다.
            </p>
          </section>
        ) : !result ? (
          <section className="card">
            <h2>방문 전 점검 결과</h2>
            <p className="errors" role="alert">
              {outcome.ok ? '' : outcome.errors.join(' ')}
            </p>
          </section>
        ) : (
          <ResultCard result={result} onOpen={() => setOpen(true)} onAfter={goAfter} />
        )}
      </div>

      {result && (
        <ReportDialog
          open={open}
          onClose={() => setOpen(false)}
          title="방문 전 점검 리포트"
          tabs={buildReportTabs(result, lookupInfo)}
        />
      )}
    </div>
  );
}

function ResultCard({
  result,
  onOpen,
  onAfter,
}: {
  result: AnalysisResult;
  onOpen: () => void;
  onAfter: () => void;
}) {
  const v = result.verdict;
  const g = gradeInfo(result.report.grade);
  const kind = result.input.contract.kind;
  const req = result.requirements;
  const full = req?.rows.find((r) => r.loanSharePercent === 100);
  const recs = result.loanRecs.filter((r) => r.status !== 'unlikely').slice(0, 3);
  const todo = CHECKLIST.filter((c) => c.kinds.includes(kind));

  return (
    <section className="card summary" aria-labelledby="pv-title">
      <h2 id="pv-title">방문 전 점검 결과</h2>
      <div className={`grade grade-${TONE[v.verdict]}`}>
        <span className="grade-icon" aria-hidden="true">
          {ICON[v.verdict]}
        </span>
        <div>
          <div className="grade-label">{VERDICT_LABEL[v.verdict]}</div>
          <div className="grade-headline">위험 신호: {g.label}</div>
        </div>
      </div>
      {v.reasons.length > 0 && (
        <ul className="evidence">
          {v.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {req && (
        <>
          <h3>대략 대출 규모</h3>
          <ul className="evidence">
            <li>
              받을 수 있는 최대 대출(추정): <strong>{formatWon(req.maxLoan)}</strong>
            </li>
            {full && (
              <>
                <li>
                  이때 필요한 자기자금: <strong>{formatWon(full.ownFundsNeeded)}</strong>
                </li>
                <li>
                  필요한 연소득(대출 전액 기준): <strong>{formatWon(upMan(full.minIncomeBase))}</strong> 이상
                </li>
                <li>예상 월 상환액: 약 {formatWon(roundMan(full.monthlyPayment))}</li>
              </>
            )}
          </ul>
        </>
      )}

      {recs.length > 0 && (
        <>
          <h3>해당될 수 있는 정책 대출</h3>
          <ul className="evidence">
            {recs.map((r) => (
              <li key={r.productId}>
                <strong>{nameOf(r.productId)}</strong> — {REC_LABEL[r.status]}
                {r.rate &&
                  ` · 연 ${
                    r.rate.minPercent === r.rate.maxPercent
                      ? `${r.rate.minPercent}%`
                      : `${r.rate.minPercent}~${r.rate.maxPercent}%`
                  }`}
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="fold">
        <summary>방문·연락 전에 확인할 것 ({todo.length})</summary>
        <ul className="evidence">
          {todo.map((c) => (
            <li key={c.id}>{c.text}</li>
          ))}
        </ul>
      </details>

      <button type="button" className="btn-primary" onClick={onOpen}>
        상세 리포트 열기
      </button>
      <p className="hint">
        등기부·건축물대장까지 확인하는 정밀 분석은 방문한 뒤에 하세요.{' '}
        <Link href="/after" onClick={onAfter}>
          보고 온 뒤 정밀 분석 →
        </Link>
      </p>
    </section>
  );
}
