'use client';

import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AssumptionSuggestion, HouseCount } from '../../adapters/llm/assumptions';
import { findDongName, findSigungu, SIGUNGU_NAMES } from '../../core';
import { applySuggestion } from '../assumptions';
import type { FinanceFormState } from '../financeForm';
import type { Kind } from '../form';
import { parseManwon } from '../form';

interface Props {
  setFin: Dispatch<SetStateAction<FinanceFormState>>;
  kind: Kind;
  /** 메인 폼의 보증금(매매가) 입력값 (만원) */
  amountManwon: string;
  /** 시세 조회의 주소·지역 입력값 — 있으면 지역을 자동으로 채운다 */
  address: string;
  /** "내 상황"에서 체크한 생애최초 여부 (직접 고치기 전까지 따라간다) */
  firstHomeDefault: boolean;
}

const FIELD_LABEL: [keyof AssumptionSuggestion, string, string][] = [
  ['ltvLimitPercent', 'LTV 한도', '%'],
  ['dsrLimitPercent', 'DSR 한도', '%'],
  ['annualRatePercent', '예상 금리', '% (연)'],
  ['stressAddPercent', '스트레스 가산 금리', '%p'],
  ['termYears', '대출 기간', '년'],
];

/**
 * 지역·보유 주택 수에 따라 달라지는 대출 기준값을 AI 에게 제안받는다 (LLM, 선택 기능).
 * 제안은 공식 값이 아니며 사용자가 확인하고 "적용"을 눌렀을 때만 입력 칸이 채워진다.
 * LLM 으로 전송되는 것은 계약 유형·보증금(매매가)·지역·보유 주택 수·생애최초 여부뿐이다.
 */
export function AssumptionAdvisor({ setFin, kind, amountManwon, address, firstHomeDefault }: Props) {
  const [typed, setTyped] = useState<string | null>(null);
  // 직접 고치기 전에는 주소·지역에서 시군구(+법정동)를 자동으로 가져온다
  const auto = (() => {
    if (!address.trim()) return '';
    const r = findSigungu(address);
    if (!r.ok) return address.trim().slice(0, 50);
    const dong = findDongName(address);
    return `${r.match.name}${dong ? ` ${dong}` : ''}`;
  })();
  const region = typed ?? auto;
  const setRegion = (v: string) => setTyped(v);
  const [houseCount, setHouseCount] = useState<HouseCount>('none');
  const [firstHomeTyped, setFirstHome] = useState<boolean | null>(null);
  const firstHome = firstHomeTyped ?? firstHomeDefault;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<AssumptionSuggestion | null>(null);
  const [applied, setApplied] = useState(false);

  const ask = async () => {
    setError(null);
    setSuggestion(null);
    setApplied(false);
    const amount = parseManwon(amountManwon);
    if (!amount.ok || amount.won <= 0) {
      setError('위의 "1. 계약 정보"에 보증금(매매가)을 먼저 입력하세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/assumptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, amountManwon: amount.won / 10_000, region, houseCount, firstHome }),
      });
      const data = (await res.json()) as { suggestion?: AssumptionSuggestion; error?: string };
      if (!res.ok || !data.suggestion) {
        setError(data.error ?? '기준값 제안에 실패했습니다. 직접 입력해 주세요.');
        return;
      }
      setSuggestion(data.suggestion);
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!suggestion) return;
    setFin((f) => applySuggestion(f, suggestion));
    setApplied(true);
  };

  return (
    <fieldset>
      <legend>AI로 기준값 제안받기 (선택)</legend>
      <p className="hint">
        지역·보유 주택 수에 따라 달라지는 LTV·DSR·금리·기간을 AI가 일반적인 수준으로 제안합니다.
        <strong> AI 제안은 공식 값이 아니며 최신 규제와 다를 수 있습니다.</strong> 확인한 뒤에만 적용되고,
        리포트에 "AI 제안"으로 표시됩니다. 세금·중개보수는 AI가 아니라 법정 요율로 계산합니다.
      </p>
      <label className="field">
        <span>지역 (선택, 예: 서울 강남구)</span>
        <input
          autoComplete="off"
          maxLength={50}
          placeholder="주소·지역을 입력했으면 자동으로 들어옵니다 (목록에서 선택도 가능)"
          list="sigungu-options"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        />
      </label>
      <datalist id="sigungu-options">
        {SIGUNGU_NAMES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <div className="row2">
        <label className="field">
          <span>보유 주택</span>
          <select value={houseCount} onChange={(e) => setHouseCount(e.target.value as HouseCount)}>
            <option value="none">무주택</option>
            <option value="one">1주택 보유</option>
            <option value="multi">2주택 이상 보유</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={firstHome} onChange={(e) => setFirstHome(e.target.checked)} />
          생애최초 주택 구입
        </label>
      </div>
      <button type="button" className="btn-secondary" onClick={ask} disabled={busy}>
        {busy ? '제안 받는 중…' : 'AI로 기준값 제안받기'}
      </button>
      <p className="hint">
        이 버튼을 누르면 계약 유형·보증금(매매가)·지역·보유 주택 수·생애최초 여부가 LLM 서버로 전송됩니다.
        소득·자산·성명은 보내지 않습니다.
      </p>

      {error && (
        <p className="errors" role="alert">
          {error}
        </p>
      )}

      {suggestion && (
        <div className="notice" role="status">
          <strong>
            AI 제안 — 공식 값이 아닙니다 (신뢰도: {suggestion.confidence === 'medium' ? '보통' : '낮음'})
          </strong>
          <ul className="evidence">
            {FIELD_LABEL.map(([key, label, unit]) => {
              const v = suggestion[key];
              return (
                <li key={key}>
                  {label}: {v === null ? 'AI가 판단하지 못함' : `${v}${unit}`}
                </li>
              );
            })}
          </ul>
          {suggestion.rationale.length > 0 && (
            <>
              <p>
                <strong>근거</strong>
              </p>
              <ul className="evidence">
                {suggestion.rationale.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          )}
          {suggestion.caveats.length > 0 && (
            <>
              <p>
                <strong>반드시 확인할 점</strong>
              </p>
              <ul className="evidence">
                {suggestion.caveats.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          )}
          <button type="button" className="btn-primary" onClick={apply} disabled={applied}>
            {applied ? '입력칸에 적용됨' : '제안 값을 입력칸에 적용'}
          </button>
        </div>
      )}
    </fieldset>
  );
}
