'use client';

import { useState } from 'react';
import { evaluateAffordability, evaluateRequirements, evaluateRisk, evaluateVerdict } from '../../core';
import type { Affordability, Requirements, RiskInput, RiskReport, VerdictResult } from '../../core';
import { buildRiskInput, emptyForm, todayIso } from '../form';
import type { FormState } from '../form';
import { buildFinancePlan, defaultFinanceForm } from '../financeForm';
import type { FinanceFormState } from '../financeForm';
import { gradeInfo } from '../present';
import { rulesConfig } from '../rulesConfig';
import { ChecklistPanel } from './ChecklistPanel';
import { FinanceFields } from './FinanceFields';
import { FinanceReport } from './FinanceReport';
import { InputForm } from './InputForm';
import { ListingImport } from './ListingImport';
import { LoanCatalog } from './LoanCatalog';
import { MarketLookup } from './MarketLookup';
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
}

export function Analyzer() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fin, setFin] = useState<FinanceFormState>(defaultFinanceForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lookupInfo, setLookupInfo] = useState<LookupInfo>({ similar: [], message: null });

  const analyze = () => {
    const built = buildRiskInput(form, todayIso());
    const errs: string[] = built.ok ? [] : [...built.errors];

    let finance: Affordability | undefined;
    let requirements: Requirements | undefined;
    let costNotes: string[] = [];
    let assumptionNotes: string[] = [];
    let dsrLimitPercent: number | undefined;
    if (fin.enabled && built.ok) {
      const plan = buildFinancePlan(
        fin,
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
        assumptionNotes = plan.assumptionNotes;
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
        topSlot={<ListingImport setForm={setForm} setFin={setFin} />}
        marketSlot={<MarketLookup form={form} setForm={setForm} onInfo={setLookupInfo} />}
        extra={
          <FinanceFields
            fin={fin}
            setFin={setFin}
            kind={form.kind}
            amountManwon={form.amountManwon}
            address={form.lookupAddress}
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
