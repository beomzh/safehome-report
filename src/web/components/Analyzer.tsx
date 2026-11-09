'use client';

import { useState } from 'react';
import { evaluateAffordability, evaluateRequirements, evaluateRisk } from '../../core';
import type { Affordability, Requirements, RiskInput, RiskReport } from '../../core';
import { buildRiskInput, emptyForm, todayIso } from '../form';
import type { FormState } from '../form';
import { buildFinancePlan, emptyFinanceForm } from '../financeForm';
import type { FinanceFormState } from '../financeForm';
import { rulesConfig } from '../rulesConfig';
import { ChecklistPanel } from './ChecklistPanel';
import { FinanceFields } from './FinanceFields';
import { FinanceReport } from './FinanceReport';
import { InputForm } from './InputForm';
import { RequirementsReport } from './RequirementsReport';
import { LoanCatalog } from './LoanCatalog';
import { ListingImport } from './ListingImport';
import { MarketLookup } from './MarketLookup';
import { ReportView } from './ReportView';

interface Result {
  report: RiskReport;
  input: RiskInput;
  finance?: Affordability;
  requirements?: Requirements;
}

export function Analyzer() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fin, setFin] = useState<FinanceFormState>(emptyFinanceForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  const analyze = () => {
    const built = buildRiskInput(form, todayIso());
    const errs: string[] = built.ok ? [] : [...built.errors];

    let finance: Affordability | undefined;
    let requirements: Requirements | undefined;
    if (fin.enabled && built.ok) {
      const plan = buildFinancePlan(fin, {
        kind: built.input.contract.kind,
        amountWon: built.input.contract.amount,
        marketWon: built.input.market?.estimatedValue,
      });
      if (!plan.ok) errs.push(...plan.errors);
      else {
        requirements = evaluateRequirements(plan.requirements);
        if (plan.affordability) finance = evaluateAffordability(plan.affordability);
      }
    }

    if (!built.ok || errs.length > 0) {
      setErrors(errs);
      setResult(null);
      return;
    }
    setErrors([]);
    // 순수 함수: 브라우저에서 실행되며 입력(재무 정보 포함)이 네트워크로 나가지 않는다
    setResult({ report: evaluateRisk(built.input, rulesConfig), input: built.input, finance, requirements });
  };

  const reset = () => {
    setForm(emptyForm());
    setFin(emptyFinanceForm());
    setErrors([]);
    setResult(null);
  };

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
        {result ? (
          <>
            <ReportView report={result.report} input={result.input} />
            {result.requirements && (
              <RequirementsReport
                requirements={result.requirements}
                kind={result.input.contract.kind}
                amountWon={result.input.contract.amount}
                grade={result.report.grade}
              />
            )}
            {result.finance && <FinanceReport result={result.finance} grade={result.report.grade} />}
            <LoanCatalog kind={result.input.contract.kind} grade={result.report.grade} />
            <ChecklistPanel kind={result.input.contract.kind} />
          </>
        ) : (
          <section className="card empty">
            <h2>분석 결과</h2>
            <p className="muted">왼쪽에 정보를 입력하고 “분석하기”를 누르면 결과가 여기에 표시됩니다.</p>
          </section>
        )}
      </div>
    </div>
  );
}
