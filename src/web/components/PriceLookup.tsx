'use client';

import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { FinanceFormState } from '../financeForm';
import type { FormState } from '../form';
import { formatWon } from '../present';

interface Props {
  form: FormState;
  setFin: Dispatch<SetStateAction<FinanceFormState>>;
}

interface Price {
  stdrYear: string;
  stdrMt: string;
  dongNm: string;
  hoNm: string;
  floorNm: string;
  areaM2: number;
  priceWon: number;
  complexName: string;
}

/**
 * 공동주택 동·호별 공시가격 조회(브이월드, 선택). 법정동코드·지번·동·호만 로컬 서버를 거쳐 브이월드로 전송된다.
 * 조회한 값은 확인한 뒤 "재산세 계산에 쓰기"를 눌러야 "대출·자금 계획"의 공시가격 칸에 들어간다.
 */
export function PriceLookup({ form, setFin }: Props) {
  const [dong, setDong] = useState('');
  const [ho, setHo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Price[] | null>(null);
  const [used, setUsed] = useState<number | null>(null);

  const lookup = async () => {
    setBusy(true);
    setError(null);
    setPrices(null);
    setUsed(null);
    try {
      const qs = new URLSearchParams({
        lawdCd: form.lookupLawdCd,
        address: `${form.lookupAddress} ${form.lookupDongName}`.trim(),
        jibun: form.buildingJibun,
        dong,
        ho,
      });
      const res = await fetch(`/api/price?${qs.toString()}`);
      const data = (await res.json()) as { prices?: Price[]; error?: string };
      if (!res.ok || !data.prices) {
        setError(data.error ?? '공시가격 조회에 실패했습니다.');
        return;
      }
      setPrices(data.prices);
      if (data.prices.length === 0)
        setError(
          '조건에 맞는 공시가격이 없습니다. 지번, 동, 호가 정확히 일치하는지 확인하세요 (동·호는 부분 일치가 안 됩니다).',
        );
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="fold">
      <summary>공동주택 공시가격 조회 (선택)</summary>
      <p className="hint">
        지번은 위 건축물대장 칸의 값을 쓰고, 법정동코드와 주소는 시세 조회 칸을 씁니다. 동·호는 정확히
        일치해야 조회됩니다.
      </p>
      <div className="row2">
        <label className="field">
          <span>동 (선택)</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="예: 107"
            value={dong}
            onChange={(e) => setDong(e.target.value)}
          />
        </label>
        <label className="field">
          <span>호</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="예: 704"
            value={ho}
            onChange={(e) => setHo(e.target.value)}
          />
        </label>
      </div>
      <button type="button" className="btn-secondary" onClick={lookup} disabled={busy || !ho.trim()}>
        {busy ? '조회 중…' : '공시가격 조회'}
      </button>
      <p className="hint">
        이 조회에서만 법정동코드·지번·동·호가 로컬 서버를 거쳐 브이월드(국가공간정보)로 전송됩니다.
        성명·금액·재무 정보는 보내지 않습니다. 공시가격은 재산세 계산에 쓰는 참고 값이며 시세가 아닙니다.
      </p>
      {error && (
        <p className="errors" role="alert">
          {error}
        </p>
      )}
      {prices && prices.length > 0 && (
        <div className="notice" role="status">
          <strong>공시가격 {prices.length}건</strong>
          <ul className="evidence">
            {prices.map((p, i) => (
              <li key={`${p.stdrYear}-${p.dongNm}-${p.hoNm}-${i}`}>
                {p.complexName} {p.dongNm ? `${p.dongNm}동 ` : ''}
                {p.hoNm}호 ({p.floorNm}층, 전용 {p.areaM2}㎡) — <strong>{formatWon(p.priceWon)}</strong> (
                {p.stdrYear}년 {Number(p.stdrMt)}월 1일 기준)
                {p.priceWon === used ? (
                  <span className="muted"> · 재산세 계산에 사용 중</span>
                ) : (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => {
                        setFin((f) => ({ ...f, publicPriceManwon: String(Math.floor(p.priceWon / 10_000)) }));
                        setUsed(p.priceWon);
                      }}
                    >
                      재산세 계산에 쓰기
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}
