'use client';

import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { findDongName, findSigungu } from '../../core';
import type { FormState } from '../form';
import { formatWon } from '../present';

export interface LookupInfo {
  similar: NonNullable<LookupResponse['similar']>;
  message: { tone: 'ok' | 'warn' | 'error'; text: string } | null;
}

interface Props {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  /** 조회 결과(다른 단지·안내 문구)를 리포트에서 다시 보여주기 위해 올려 보낸다 */
  onInfo?: (info: LookupInfo) => void;
}

interface LookupResponse {
  market: { estimatedValue: number; confidence: 'high' | 'low' } | null;
  sampleCount: number;
  minWon: number | null;
  maxWon: number | null;
  windowMonths: number;
  similar?: {
    complexName: string;
    medianWon: number;
    count: number;
    diffPercent?: number;
  }[];
  error?: string;
}

/**
 * 아파트 실거래가(공공데이터포털)로 시세를 조회해 시세 입력칸을 채운다.
 * 서버로 보내는 값은 법정동코드·전용면적·단지명뿐이며 성명·금액·재무 정보는 보내지 않는다.
 */
export function MarketLookup({ form, setForm, onInfo }: Props) {
  const housing = form.lookupHousing;
  const lawdCd = form.lookupLawdCd;
  const areaM2 = form.lookupAreaM2;
  const complexName = form.lookupComplexName;
  const dongName = form.lookupDongName;
  const address = form.lookupAddress;
  const [busy, setBusy] = useState(false);
  const [similar, setSimilar] = useState<NonNullable<LookupResponse['similar']>>([]);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const lookup = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const qs = new URLSearchParams({ housing, lawdCd, areaM2, complexName, dongName });
      const res = await fetch(`/api/market?${qs.toString()}`);
      const data = (await res.json()) as LookupResponse;
      setSimilar(res.ok ? (data.similar ?? []) : []);
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
        marketConfidence: regionWide || housing !== 'apt' ? 'low' : (data.market?.confidence ?? 'low'),
      }));
      const range =
        data.minWon !== null && data.maxWon !== null
          ? ` (최저 ${formatWon(data.minWon)} ~ 최고 ${formatWon(data.maxWon)})`
          : '';
      setMessage({
        tone: regionWide || housing !== 'apt' || data.market.confidence === 'low' ? 'warn' : 'ok',
        text: `최근 ${data.windowMonths}개월 거래 ${data.sampleCount}건의 중앙값 ${formatWon(data.market.estimatedValue)}을 시세로 입력했습니다${range}.${
          housing === 'house'
            ? ' 단독·다가구는 건물마다 대지·구조가 달라 연면적 ±20% 거래의 중앙값은 참고용일 뿐입니다. 신뢰도를 낮게 표시합니다.'
            : housing !== 'apt'
              ? ' 빌라·오피스텔은 같은 건물의 거래가 적고 호실마다 가격 차이가 커서 신뢰도를 낮게 표시합니다. 참고용으로만 쓰세요.'
              : regionWide
                ? ' 단지명 없이 같은 지역(법정동명이 있으면 같은 동) 거래로 계산해 부정확합니다. 단지명을 입력하면 정확해집니다.'
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

  useEffect(() => {
    onInfo?.({ similar, message });
  }, [similar, message]);

  // 매물 설명을 적용하면 필요한 값이 채워진 상태에서 시세 조회를 자동 실행한다
  useEffect(() => {
    if (form.lookupNonce > 0) void lookup();
  }, [form.lookupNonce]);

  // 주소·지역을 적으면 법정동코드와 법정동명을 자동으로 채운다 (못 찾으면 직접 입력)
  const region = address.trim() ? findSigungu(address) : null;
  useEffect(() => {
    if (!region?.ok) return;
    const dong = findDongName(address);
    setForm((f) =>
      f.lookupLawdCd === region.match.code && (!dong || f.lookupDongName === dong)
        ? f
        : { ...f, lookupLawdCd: region.match.code, lookupDongName: dong ?? f.lookupDongName },
    );
  }, [address, region?.ok ? region.match.code : '']);

  return (
    <fieldset>
      <legend>실거래가로 시세 조회</legend>
      <label className="field">
        <span>주택 유형</span>
        <select
          value={housing}
          onChange={(e) =>
            setForm((f) => ({ ...f, lookupHousing: e.target.value as FormState['lookupHousing'] }))
          }
        >
          <option value="apt">아파트</option>
          <option value="rowhouse">연립·다세대(빌라)</option>
          <option value="officetel">오피스텔</option>
          <option value="house">단독·다가구 (연면적 기준)</option>
        </select>
      </label>
      <label className="field">
        <span>주소·지역 (적으면 법정동코드를 자동으로 찾음)</span>
        <input
          autoComplete="off"
          placeholder="예: 서울 동대문구 휘경동 또는 매물 주소"
          value={address}
          onChange={(e) => setForm((f) => ({ ...f, lookupAddress: e.target.value }))}
        />
        {region?.ok && (
          <small className="hint">
            {region.match.name} ({region.match.code})로 인식했습니다.
          </small>
        )}
        {region && !region.ok && (
          <small className="hint">
            {region.reason === 'ambiguous'
              ? '시·도를 함께 적어 주세요 (같은 이름의 구가 여러 곳에 있습니다).'
              : '법정동코드를 찾지 못했습니다. 시·도와 시·군·구를 적거나 아래 코드를 직접 입력하세요.'}
          </small>
        )}
      </label>
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
          <span>{housing === 'house' ? '연면적 (㎡, 건물 전체)' : '전용면적 (㎡)'}</span>
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
        <span>{housing === 'house' ? '법정동명 (선택, 예: 역삼동)' : '단지명 (선택, 비우면 지역 전체)'}</span>
        <input
          autoComplete="off"
          placeholder={housing === 'house' ? '예: 역삼동' : '실거래 목록의 단지명과 같게'}
          value={complexName}
          onChange={(e) => setForm((f) => ({ ...f, lookupComplexName: e.target.value }))}
        />
      </label>
      {housing !== 'house' && (
        <label className="field">
          <span>법정동명 (선택, 단지명이 없을 때 같은 동 거래만 사용)</span>
          <input
            autoComplete="off"
            placeholder="예: 신길동"
            value={dongName}
            onChange={(e) => setForm((f) => ({ ...f, lookupDongName: e.target.value }))}
          />
        </label>
      )}
      <button type="button" className="btn-secondary" onClick={lookup} disabled={busy}>
        {busy ? '조회 중…' : '실거래가로 시세 조회'}
      </button>
      <p className="hint">
        이 조회에서만 법정동코드·면적·단지명이 내 PC의 로컬 서버를 거쳐 공공데이터포털로 전송됩니다.
        성명·금액·재무 정보는 전송되지 않습니다. 아파트는 실제 응답으로 확인했고, 빌라·오피스텔은 추정한
        필드로 읽으며 별도 API 활용신청이 필요합니다. 다가구·단독은 면적 기준 조회가 맞지 않아 직접
        입력하세요.
      </p>
      {similar.length > 0 && (
        <div className="similar">
          <h4>같은 지역에서 비슷한 면적으로 거래된 다른 단지 (참고)</h4>
          <ul className="evidence">
            {similar.map((c) => (
              <li key={c.complexName}>
                {c.complexName}: 중앙값 {formatWon(c.medianWon)} ({c.count}건
                {c.diffPercent !== undefined &&
                  `, 조회 시세 대비 ${c.diffPercent > 0 ? '+' : ''}${c.diffPercent}%`}
                )
              </li>
            ))}
          </ul>
          <p className="hint">
            판매 중인 매물이 아니라 최근 실제 거래 사례입니다. 대안 단지를 찾는 출발점으로만 쓰고, 지금 나온
            매물은 위의 매물 사이트에서 확인하세요.
          </p>
        </div>
      )}
      {message && (
        <p className={message.tone === 'error' ? 'errors' : 'notice'} role="status">
          {message.text}
        </p>
      )}
    </fieldset>
  );
}
