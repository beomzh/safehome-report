'use client';

import { useState } from 'react';
import { evaluateRisk } from '../../core';
import type { RiskInput, RiskReport } from '../../core';
import { buildRiskInput, emptyForm, todayIso } from '../form';
import type { FormState } from '../form';
import { rulesConfig } from '../rulesConfig';
import { ChecklistPanel } from './ChecklistPanel';
import { InputForm } from './InputForm';
import { ReportView } from './ReportView';

interface Result {
  report: RiskReport;
  input: RiskInput;
}

export function Analyzer() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  const analyze = () => {
    const built = buildRiskInput(form, todayIso());
    if (!built.ok) {
      setErrors(built.errors);
      setResult(null);
      return;
    }
    setErrors([]);
    // 순수 함수: 브라우저에서 실행되며 입력이 네트워크로 나가지 않는다
    setResult({ report: evaluateRisk(built.input, rulesConfig), input: built.input });
  };

  const reset = () => {
    setForm(emptyForm());
    setErrors([]);
    setResult(null);
  };

  return (
    <div className="layout">
      <InputForm form={form} setForm={setForm} errors={errors} onSubmit={analyze} onReset={reset} />
      <div className="results">
        {result ? (
          <>
            <ReportView report={result.report} input={result.input} />
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
