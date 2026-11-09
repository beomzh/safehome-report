'use client';

import { useState } from 'react';
import { evaluateAffordability, evaluateRequirements, evaluateRisk } from '../../core';
import type { Affordability, Requirements, RiskInput, RiskReport } from '../../core';
import { buildRiskInput, emptyForm, todayIso } from '../form';
import type { FormState } from '../form';
import { buildFinancePlan, emptyFinanceForm } from '../financeForm';
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
import { ReportDialog } from './ReportDialog';
import { ReportView } from './ReportView';
import { RequirementsReport } from './RequirementsReport';

interface Result {
  report: RiskReport;
  input: RiskInput;
  finance?: Affordability;
  requirements?: Requirements;
  costNotes?: string[];
}

export function Analyzer() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fin, setFin] = useState<FinanceFormState>(emptyFinanceForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const analyze = () => {
    const built = buildRiskInput(form, todayIso());
    const errs: string[] = built.ok ? [] : [...built.errors];

    let finance: Affordability | undefined;
    let requirements: Requirements | undefined;
    let costNotes: string[] = [];
    if (fin.enabled && built.ok) {
      const plan = buildFinancePlan(
        fin,
        {
          kind: built.input.contract.kind,
          amountWon: built.input.contract.amount,
          marketWon: built.input.market?.estimatedValue,
          areaM2: /^\d+(\.\d+)?$/.test(form.lookupAreaM2.trim()) ? Number(form.lookupAreaM2) : undefined,
        },
        rulesConfig,
      );
      if (!plan.ok) errs.push(...plan.errors);
      else {
        requirements = evaluateRequirements(plan.requirements);
        costNotes = plan.costNotes;
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
    setResult({
      report: evaluateRisk(built.input, rulesConfig),
      input: built.input,
      finance,
      requirements,
      costNotes,
    });
    setDialogOpen(true);
  };

  const reset = () => {
    setForm(emptyForm());
    setFin(emptyFinanceForm());
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
        topSlot={<ListingImport setForm={setForm} />}
        marketSlot={<MarketLookup form={form} setForm={setForm} />}
        extra={<FinanceFields fin={fin} setFin={setFin} kind={form.kind} />}
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
      </div>

      {result && (
        <ReportDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="분석 리포트">
          <ReportView report={result.report} input={result.input} />
          {result.requirements && (
            <RequirementsReport
              requirements={result.requirements}
              kind={result.input.contract.kind}
              amountWon={result.input.contract.amount}
              grade={result.report.grade}
              costNotes={result.costNotes ?? []}
            />
          )}
          {result.finance && <FinanceReport result={result.finance} grade={result.report.grade} />}
          <LoanCatalog kind={result.input.contract.kind} grade={result.report.grade} />
          <ChecklistPanel kind={result.input.contract.kind} />
        </ReportDialog>
      )}
    </div>
  );
}
