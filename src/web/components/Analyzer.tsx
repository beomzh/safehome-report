'use client';

import { useState } from 'react';
import {
  evaluateAffordability,
  evaluateRequirements,
  evaluateRisk,
  evaluateVerdict,
  policyAssumptions,
  recommendLoans,
} from '../../core';
import type {
  Affordability,
  Recommendation,
  Requirements,
  RiskInput,
  RiskReport,
  VerdictResult,
} from '../../core';
import { buildRiskInput, emptyForm, todayIso } from '../form';
import type { FormState } from '../form';
import { buildFinancePlan, defaultFinanceForm } from '../financeForm';
import type { FinanceFormState } from '../financeForm';
import { LOAN_ELIGIBILITY } from '../loanEligibility';
import { rateInfoFor } from '../loanRates';
import { gradeInfo } from '../present';
import { buildLoanDeal, defaultProfile, toLoanProfile } from '../profile';
import { applyPolicyBasis } from '../policyFinance';
import { LOAN_PRODUCTS } from '../loans';
import type { ProfileState } from '../profile';
import { rulesConfig } from '../rulesConfig';
import { ChecklistPanel } from './ChecklistPanel';
import { FinanceFields } from './FinanceFields';
import { FinanceReport } from './FinanceReport';
import { InputForm } from './InputForm';
import { ListingImport } from './ListingImport';
import { LoanRecommendations } from './LoanRecommendations';
import { ProfileFields } from './ProfileFields';
import { LoanCatalog } from './LoanCatalog';
import { BuildingLookup } from './BuildingLookup';
import { MarketLookup } from './MarketLookup';
import { PriceLookup } from './PriceLookup';
import type { LookupInfo } from './MarketLookup';
import { MarketNotes } from './MarketNotes';
import { VerdictPanel } from './VerdictPanel';
import { SiteLinks } from './SiteLinks';
import { ReportDialog } from './ReportDialog';
import { ReportView } from './ReportView';
import { RequirementsReport } from './RequirementsReport';

interface Result {
  report: RiskReport;
  input: RiskInput;
  finance?: Affordability;
  requirements?: Requirements;
  costNotes?: string[];
  assumptionNotes?: string[];
  verdict: VerdictResult;
  loanRecs: Recommendation[];
}

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

  const analyze = () => {
    const built = buildRiskInput(form, todayIso());
    const errs: string[] = built.ok ? [] : [...built.errors];

    // 대출 후보 추천(공식 요건)을 먼저 구해, 해당할 수 있는 정책 대출이 있으면 그 상품의 공식 조건을 계산 기준값으로 쓴다
    let loanRecs: Recommendation[] = [];
    let effectiveFin = fin;
    let policyNotes: string[] = [];
    if (built.ok) {
      const loanProfile = toLoanProfile(profile, fin.annualIncomeManwon);
      const deal = buildLoanDeal({
        kind: built.input.contract.kind,
        amountWon: built.input.contract.amount,
        monthlyRentManwon: fin.monthlyRentManwon,
        lawdCd: form.lookupLawdCd,
        areaM2: form.lookupAreaM2,
      });
      loanRecs = recommendLoans(LOAN_ELIGIBILITY.products, loanProfile, deal, rateInfoFor);
      const top = loanRecs.find(
        (r) =>
          r.status !== 'unlikely' &&
          LOAN_ELIGIBILITY.products.find((p) => p.productId === r.productId)?.financing,
      );
      const topProduct = top && LOAN_ELIGIBILITY.products.find((p) => p.productId === top.productId);
      const policy =
        topProduct && policyAssumptions(topProduct, loanProfile, deal, rateInfoFor(topProduct.productId));
      if (policy && topProduct) {
        const name = LOAN_PRODUCTS.find((l) => l.id === topProduct.productId)?.name ?? topProduct.productId;
        const applied = applyPolicyBasis(fin, policy, name);
        effectiveFin = applied.fin;
        policyNotes = applied.notes;
      }
    }

    let finance: Affordability | undefined;
    let requirements: Requirements | undefined;
    let costNotes: string[] = [];
    let assumptionNotes: string[] = [];
    let dsrLimitPercent: number | undefined;
    if (fin.enabled && built.ok) {
      const plan = buildFinancePlan(
        effectiveFin,
        {
          kind: built.input.contract.kind,
          amountWon: built.input.contract.amount,
          marketWon: built.input.market?.estimatedValue,
          housing: form.lookupHousing,
          areaM2: /^\d+(\.\d+)?$/.test(form.lookupAreaM2.trim()) ? Number(form.lookupAreaM2) : undefined,
        },
        rulesConfig,
      );
      if (!plan.ok) errs.push(...plan.errors);
      else {
        requirements = evaluateRequirements(plan.requirements);
        dsrLimitPercent = plan.requirements.loan.dsrLimitPercent;
        costNotes = plan.costNotes;
        assumptionNotes = [...policyNotes, ...plan.assumptionNotes];
        if (plan.affordability) finance = evaluateAffordability(plan.affordability);
      }
    }

    if (!built.ok || errs.length > 0) {
      setErrors(errs);
      setResult(null);
      setDialogOpen(false);
      return;
    }
    setErrors([]);
    // 순수 함수: 브라우저에서 실행되며 입력(재무 정보 포함)이 네트워크로 나가지 않는다
    const report = evaluateRisk(built.input, rulesConfig);
    setResult({
      report,
      verdict: evaluateVerdict(
        {
          kind: built.input.contract.kind,
          amountWon: built.input.contract.amount,
          marketWon: built.input.market?.estimatedValue,
          marketConfidence: built.input.market?.confidence,
          grade: report.grade,
          affordability: finance,
          dsrLimitPercent,
        },
        rulesConfig,
      ),
      input: built.input,
      loanRecs,
      finance,
      requirements,
      costNotes,
      assumptionNotes,
    });
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
          tabs={[
            {
              id: 'verdict',
              label: '종합 판정',
              content: <VerdictPanel result={result.verdict} kind={result.input.contract.kind} />,
            },
            {
              id: 'risk',
              label: '위험 신호',
              content: <ReportView report={result.report} input={result.input} />,
            },
            {
              id: 'loan-reco',
              label: '대출 추천',
              content: <LoanRecommendations recs={result.loanRecs} today={todayIso()} />,
            },
            ...(result.requirements
              ? [
                  {
                    id: 'requirements',
                    label: '필요 조건',
                    content: (
                      <RequirementsReport
                        requirements={result.requirements}
                        kind={result.input.contract.kind}
                        amountWon={result.input.contract.amount}
                        grade={result.report.grade}
                        costNotes={result.costNotes ?? []}
                        assumptionNotes={result.assumptionNotes ?? []}
                      />
                    ),
                  },
                ]
              : []),
            ...(result.finance
              ? [
                  {
                    id: 'finance',
                    label: '자금 여력',
                    content: <FinanceReport result={result.finance} grade={result.report.grade} />,
                  },
                ]
              : []),
            {
              id: 'market',
              label: '시세·대안 단지',
              content: <MarketNotes info={lookupInfo} />,
            },
            {
              id: 'loans',
              label: '대출 안내',
              content: <LoanCatalog kind={result.input.contract.kind} grade={result.report.grade} />,
            },
            {
              id: 'checklist',
              label: '체크리스트',
              content: <ChecklistPanel kind={result.input.contract.kind} />,
            },
          ]}
        />
      )}
    </div>
  );
}
