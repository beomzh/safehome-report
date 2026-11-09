'use client';

import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { FormState } from '../form';
import { formatWon } from '../present';

interface Props {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
}

interface LookupResponse {
  market: { estimatedValue: number; confidence: 'high' | 'low' } | null;
  sampleCount: number;
  minWon: number | null;
  maxWon: number | null;
  windowMonths: number;
  error?: string;
}

/**
 * 아파트 실거래가(공공데이터포털)로 시세를 조회해 시세 입력칸을 채운다.
 * 서버로 보내는 값은 법정동코드·전용면적·단지명뿐이며 성명·금액·재무 정보는 보내지 않는다.
 */
export function MarketLookup({ form, setForm }: Props) {
  const lawdCd = form.lookupLawdCd;
  const areaM2 = form.lookupAreaM2;
  const complexName = form.lookupComplexName;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const lookup = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const qs = new URLSearchParams({ lawdCd, areaM2, complexName });
      const res = await fetch(`/api/market?${qs.toString()}`);
      const data = (await res.json()) as LookupResponse;
      if (!res.ok) {
        setMessage({ tone: 'error', text: data.error ?? '조회에 실패했습니다.' });
        return;
      }
      if (!data.market) {
        setMessage({
          tone: 'warn',
          text: `최근 ${data.windowMonths}개월 안에 조건에 맞는 거래가 없습니다. 단지명을 비우거나 면적을 확인하거나 시세를 직접 입력하세요.`,
        });
        return;
      }
      const regionWide = !complexName.trim();
      const man = Math.floor(data.market.estimatedValue / 10_000);
      setForm((f) => ({
        ...f,
        marketManwon: String(man),
        marketSource: 'trade_median',
        // 단지명 없이 지역 전체 거래로 계산한 값은 개별 매물 시세로 부정확하므로 신뢰도를 낮게 둔다
        marketConfidence: regionWide ? 'low' : (data.market?.confidence ?? 'low'),
      }));
      const range =
        data.minWon !== null && data.maxWon !== null
          ? ` (최저 ${formatWon(data.minWon)} ~ 최고 ${formatWon(data.maxWon)})`
          : '';
      setMessage({
        tone: regionWide || data.market.confidence === 'low' ? 'warn' : 'ok',
        text: `최근 ${data.windowMonths}개월 거래 ${data.sampleCount}건의 중앙값 ${formatWon(data.market.estimatedValue)}을 시세로 입력했습니다${range}.${
          regionWide
            ? ' 단지명 없이 지역 전체 거래로 계산해 부정확합니다. 단지명을 입력하면 정확해집니다.'
            : data.market.confidence === 'low'
              ? ' 표본이 적어 신뢰도가 낮습니다.'
              : ''
        }`,
      });
    } catch {
      setMessage({ tone: 'error', text: '서버에 연결하지 못했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset>
      <legend>실거래가로 시세 조회 (아파트)</legend>
      <div className="row2">
        <label className="field">
          <span>법정동코드 (시군구 5자리)</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="예: 11680"
            value={lawdCd}
            onChange={(e) => setForm((f) => ({ ...f, lookupLawdCd: e.target.value }))}
          />
        </label>
        <label className="field">
          <span>전용면적 (㎡)</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder="예: 84.99"
            value={areaM2}
            onChange={(e) => setForm((f) => ({ ...f, lookupAreaM2: e.target.value }))}
          />
        </label>
      </div>
      <label className="field">
        <span>단지명 (선택, 비우면 지역 전체)</span>
        <input
          autoComplete="off"
          placeholder="실거래 목록의 단지명과 같게"
          value={complexName}
          onChange={(e) => setForm((f) => ({ ...f, lookupComplexName: e.target.value }))}
        />
      </label>
      <button type="button" className="btn-secondary" onClick={lookup} disabled={busy}>
        {busy ? '조회 중…' : '실거래가로 시세 조회'}
      </button>
      <p className="hint">
        이 조회에서만 법정동코드·면적·단지명이 내 PC의 로컬 서버를 거쳐 공공데이터포털로 전송됩니다.
        성명·금액·재무 정보는 전송되지 않습니다. 현재 아파트 매매 실거래만 지원합니다(빌라·다가구·오피스텔은
        직접 입력).
      </p>
      {message && (
        <p className={message.tone === 'error' ? 'errors' : 'notice'} role="status">
          {message.text}
        </p>
      )}
    </fieldset>
  );
}
