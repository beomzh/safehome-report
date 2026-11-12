'use client';

import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { classifyPurpose } from '../../core';
import type { BuildingEntry } from '../../core';
import type { FormState } from '../form';

interface Props {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
}

interface Building extends BuildingEntry {
  hhldCnt: number;
  grndFlrCnt: number;
  ugrndFlrCnt: number;
  useAprDay: string;
}

const day = (d: string) => (/^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : '미기재');

/**
 * 건축물대장(건축HUB) 표제부로 건물의 주용도를 확인한다 (선택). 위반건축물 표시는 이 API 에 없어 확인하지 못한다.
 * 서버로 가는 값은 시군구 코드·주소(법정동 찾기용)·지번뿐이며 성명·금액·재무 정보는 보내지 않는다.
 */
export function BuildingLookup({ form, setForm }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<Building[]>([]);
  const [dongName, setDongName] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const sync = (next: Set<number>, from: Building[]) =>
    setForm((f) => ({
      ...f,
      buildingEntries: from
        .filter((_, i) => next.has(i))
        .map((b) => ({ label: b.label, mainPurpose: b.mainPurpose, etcPurpose: b.etcPurpose })),
    }));

  const lookup = async () => {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        lawdCd: form.lookupLawdCd,
        address: `${form.lookupAddress} ${form.lookupDongName}`.trim(),
        jibun: form.buildingJibun,
      });
      const res = await fetch(`/api/building?${qs.toString()}`);
      const data = (await res.json()) as { buildings?: Building[]; dong?: string; error?: string };
      if (!res.ok || !data.buildings) {
        setError(data.error ?? '건축물대장 조회에 실패했습니다.');
        return;
      }
      setList(data.buildings);
      setDongName(data.dong ?? '');
      // 단지에는 상가·경비실 등이 섞여 있으므로 주택 건물이 있으면 그것만 먼저 체크한다 (바꿀 수 있음)
      const idx = data.buildings.map((_, i) => i);
      const housing = idx.filter((i) => classifyPurpose(data.buildings?.[i] as Building) === 'residential');
      const first = new Set(housing.length > 0 ? housing : idx);
      setPicked(first);
      sync(first, data.buildings);
      if (data.buildings.length === 0)
        setError(
          '이 지번의 표제부를 찾지 못했습니다. 지번이 맞는지, 집합건물이면 본번만 입력했는지 확인하세요.',
        );
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (i: number) => {
    const next = new Set(picked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setPicked(next);
    sync(next, list);
  };

  return (
    <details className="fold">
      <summary>건축물대장으로 용도 확인 (선택)</summary>
      <label className="field">
        <span>지번 (본번-부번)</span>
        <input
          inputMode="text"
          autoComplete="off"
          placeholder="예: 12 또는 12-3 (도로명 건물번호 아님)"
          value={form.buildingJibun}
          onChange={(e) => setForm((f) => ({ ...f, buildingJibun: e.target.value }))}
        />
        <small className="hint">
          위의 주소·지역(동 이름까지)과 법정동코드를 쓰고, 지번은 매물 설명이나 등기부에서 확인합니다.
        </small>
      </label>
      <button type="button" className="btn-secondary" onClick={lookup} disabled={busy}>
        {busy ? '조회 중…' : '건축물대장 조회'}
      </button>
      <p className="hint">
        이 조회에서만 시군구 코드·주소·지번이 로컬 서버를 거쳐 공공데이터포털로 전송됩니다. 위반건축물 표시는
        이 조회로 확인할 수 없으니 건축물대장 열람 화면에서 직접 확인하세요.
      </p>
      {error && (
        <p className="errors" role="alert">
          {error}
        </p>
      )}
      {list.length > 0 && (
        <div className="notice" role="status">
          <strong>
            {dongName} 표제부 {list.length}건 — 계약할 건물만 체크하세요
          </strong>
          <ul className="evidence">
            {list.map((b, i) => (
              <li key={`${b.label}-${i}`}>
                <label className="check">
                  <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} />
                  {b.label}: 주용도 {b.mainPurpose || '미기재'}
                  {b.etcPurpose ? ` (${b.etcPurpose})` : ''} · 지상 {b.grndFlrCnt}층/지하 {b.ugrndFlrCnt}층 ·{' '}
                  {b.hhldCnt}
                  세대 · 사용승인 {day(b.useAprDay)}
                </label>
              </li>
            ))}
          </ul>
          <p className="hint">
            주택 건물이 있으면 그것만 먼저 체크해 두었습니다. 체크한 건물의 주용도가 위험 신호
            점검(R-BLD-02)에 반영됩니다.
          </p>
        </div>
      )}
    </details>
  );
}
