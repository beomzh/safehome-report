'use client';

import { useEffect, useState } from 'react';
import { runAnalysis } from '../analysis';
import type { AnalysisResult } from '../analysis';
import { emptyForm } from '../form';
import type { FormState } from '../form';
import { defaultFinanceForm } from '../financeForm';
import type { FinanceFormState } from '../financeForm';
import { gradeInfo } from '../present';
import { defaultProfile } from '../profile';
import type { ProfileState } from '../profile';
import { FinanceFields } from './FinanceFields';
import { InputForm } from './InputForm';
import { ListingImport } from './ListingImport';
import { ProfileFields } from './ProfileFields';
import { BuildingLookup } from './BuildingLookup';
import { MarketLookup } from './MarketLookup';
import { PriceLookup } from './PriceLookup';
import type { LookupInfo } from './MarketLookup';
import { SiteLinks } from './SiteLinks';
import { ReportDialog } from './ReportDialog';
import { buildReportTabs } from './reportTabs';
import { loadSession } from '../sessionState';

type Result = AnalysisResult;

export function Analyzer() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fin, setFin] = useState<FinanceFormState>(defaultFinanceForm);
  const [profile, setProfile] = useState<ProfileState>(defaultProfile);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lookupInfo, setLookupInfo] = useState<LookupInfo>({
    similar: [],
    message: null,
    rent: null,
    kind: 'jeonse',
  });

  // 방문 전 점검에서 넘어온 값이 있으면 이어받는다 (마운트 뒤에 읽어 서버 렌더와 어긋나지 않게 한다)
  useEffect(() => {
    const s = loadSession();
    if (!s) return;
    setForm(s.form);
    setFin(s.fin);
    setProfile(s.profile);
  }, []);

  const analyze = () => {
    const out = runAnalysis(form, fin, profile);
    if (!out.ok) {
      setErrors(out.errors);
      setResult(null);
      setDialogOpen(false);
      return;
    }
    setErrors([]);
    setResult(out.result);
    setDialogOpen(true);
  };

  const reset = () => {
    setForm(emptyForm());
    setFin(defaultFinanceForm());
    setProfile(defaultProfile());
    setErrors([]);
    setResult(null);
    setDialogOpen(false);
  };

  const info = result ? gradeInfo(result.report.grade) : null;

  return (
    <div className="layout">
      <InputForm
        form={form}
        setForm={setForm}
        errors={errors}
        onSubmit={analyze}
        onReset={reset}
        profileSlot={<ProfileFields profile={profile} setProfile={setProfile} fin={fin} setFin={setFin} />}
        topSlot={<ListingImport setForm={setForm} setFin={setFin} />}
        marketSlot={
          <>
            <MarketLookup form={form} setForm={setForm} onInfo={setLookupInfo} />
            <BuildingLookup form={form} setForm={setForm} />
            <PriceLookup form={form} setFin={setFin} />
          </>
        }
        extra={
          <FinanceFields
            fin={fin}
            setFin={setFin}
            kind={form.kind}
            amountManwon={form.amountManwon}
            address={form.lookupAddress}
            firstHome={profile.firstHome}
          />
        }
      />
      <div className="results">
        {result && info ? (
          <section className="card summary" aria-labelledby="summary-title">
            <h2 id="summary-title">분석 결과</h2>
            <div className={`grade grade-${info.tone}`}>
              <span className="grade-icon" aria-hidden="true">
                {info.icon}
              </span>
              <div>
                <div className="grade-label">{info.label}</div>
                <div className="grade-headline">{info.headline}</div>
              </div>
            </div>
            <button type="button" className="btn-primary" onClick={() => setDialogOpen(true)}>
              상세 리포트 열기
            </button>
            <p className="hint">입력을 바꾸고 “분석하기”를 다시 누르면 리포트가 갱신됩니다.</p>
          </section>
        ) : (
          <section className="card empty">
            <h2>분석 결과</h2>
            <p className="muted">
              왼쪽에 정보를 입력하고 “분석하기”를 누르면 상세 리포트가 팝업으로 열립니다.
            </p>
          </section>
        )}
        <SiteLinks />
      </div>

      {result && (
        <ReportDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="분석 리포트"
          tabs={buildReportTabs(result, lookupInfo)}
        />
      )}
    </div>
  );
}
