'use client';

import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react';
import { GAP_FLAGS } from '../form';
import type { FormState, Kind, MarketSource } from '../form';
import { RegistryImport } from './RegistryImport';

interface Props {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  errors: string[];
  onSubmit: () => void;
  onReset: () => void;
  /** 폼 하단(오류 표시 위)에 추가로 렌더링할 섹션 (대출·자금 계획 등) */
  extra?: ReactNode;
  /** 시세 입력 아래에 렌더링할 섹션 (실거래가 조회 등) */
  marketSlot?: ReactNode;
  /** 폼 맨 위에 렌더링할 섹션 (매물 설명 붙여넣기 등) */
  topSlot?: ReactNode;
}

const KIND_LABEL: Record<Kind, string> = { jeonse: '전세', monthly: '월세', sale: '매매' };

export function InputForm({ form, setForm, errors, onSubmit, onReset, extra, marketSlot, topSlot }: Props) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const isSale = form.kind === 'sale';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form className="card form" onSubmit={submit} noValidate>
      {topSlot}

      <h2>1. 계약 정보</h2>

      <fieldset>
        <legend>계약 유형</legend>
        <div className="seg" role="radiogroup" aria-label="계약 유형">
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <label key={k} className={form.kind === k ? 'seg-item on' : 'seg-item'}>
              <input
                type="radio"
                name="kind"
                value={k}
                checked={form.kind === k}
                onChange={() => set('kind', k)}
              />
              {KIND_LABEL[k]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>{isSale ? '매매가' : '보증금'} (만원)</span>
        <input
          inputMode="numeric"
          placeholder="예: 30,000 (= 3억원)"
          value={form.amountManwon}
          onChange={(e) => set('amountManwon', e.target.value)}
        />
      </label>

      <label className="field">
        <span>{isSale ? '매도인' : '임대인'} 성명 (계약서 기준)</span>
        <input
          autoComplete="off"
          placeholder="등기부 소유자와 대조합니다"
          value={form.counterpartyName}
          onChange={(e) => set('counterpartyName', e.target.value)}
        />
      </label>

      {!isSale && (
        <div className="row2">
          <label className="field">
            <span>전입(예정)일</span>
            <input type="date" value={form.moveInDate} onChange={(e) => set('moveInDate', e.target.value)} />
          </label>
          <label className="field">
            <span>확정일자(예정)</span>
            <input type="date" value={form.fixedDate} onChange={(e) => set('fixedDate', e.target.value)} />
          </label>
        </div>
      )}

      <h2>2. 시세 (선택)</h2>
      <p className="hint">
        아래 "실거래가로 시세 조회"로 채우거나 직접 입력합니다. 시세가 없으면 시세 기반 룰은 판단 보류가
        됩니다.
      </p>
      <div className="row2">
        <label className="field">
          <span>추정 시세 (만원)</span>
          <input
            inputMode="numeric"
            placeholder="예: 50,000"
            value={form.marketManwon}
            onChange={(e) => set('marketManwon', e.target.value)}
          />
        </label>
        <label className="field">
          <span>시세 출처</span>
          <select
            value={form.marketSource}
            onChange={(e) => set('marketSource', e.target.value as MarketSource)}
          >
            <option value="user">직접 입력</option>
            <option value="trade_median">실거래가 기반</option>
            <option value="official_price">공시가격 기반</option>
          </select>
        </label>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={form.marketConfidence === 'low'}
          onChange={(e) => set('marketConfidence', e.target.checked ? 'low' : 'high')}
        />
        시세가 불확실합니다 (다가구·신축·거래 적음 등)
      </label>

      {marketSlot}

      <h2>3. 등기부 정보</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={form.includeRegistry}
          onChange={(e) => set('includeRegistry', e.target.checked)}
        />
        등기사항전부증명서 내용을 직접 입력 (전체 분석)
      </label>
      <p className="hint">
        PDF에서 복사한 텍스트를 붙여넣어 자동으로 채우거나 직접 입력할 수 있습니다. 입력하지 않으면 권리분석은
        하지 않고 “판단 보류”로 표시됩니다.
      </p>

      {form.includeRegistry && (
        <div className="registry">
          <RegistryImport setForm={setForm} />
          <label className="field">
            <span>갑구 현재 소유자 성명 (공동소유는 쉼표로 구분)</span>
            <input
              autoComplete="off"
              value={form.owners}
              onChange={(e) => set('owners', e.target.value)}
              placeholder="예: 홍길동"
            />
          </label>

          <fieldset>
            <legend>갑구에 말소되지 않고 남아 있는 항목</legend>
            <div className="checks">
              {GAP_FLAGS.map((f) => (
                <label key={f.key} className="check">
                  <input
                    type="checkbox"
                    checked={form.gapFlags[f.key]}
                    onChange={(e) => set('gapFlags', { ...form.gapFlags, [f.key]: e.target.checked })}
                  />
                  {f.label}
                </label>
              ))}
            </div>
            <p className="hint">말소된(지워진) 항목은 체크하지 않습니다.</p>
          </fieldset>

          <fieldset>
            <legend>소유권이전 등기 일자 (갑구)</legend>
            {form.transfers.map((t, i) => (
              <div className="row-inline" key={i}>
                <input
                  type="date"
                  aria-label={`소유권이전 ${i + 1}번 일자`}
                  value={t.registeredAt}
                  onChange={(e) =>
                    set(
                      'transfers',
                      form.transfers.map((x, j) => (j === i ? { registeredAt: e.target.value } : x)),
                    )
                  }
                />
                <button
                  type="button"
                  className="btn-link"
                  onClick={() =>
                    set(
                      'transfers',
                      form.transfers.filter((_, j) => j !== i),
                    )
                  }
                >
                  삭제
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-link"
              onClick={() => set('transfers', [...form.transfers, { registeredAt: '' }])}
            >
              + 이전 일자 추가
            </button>
          </fieldset>

          <fieldset>
            <legend>근저당권 (을구)</legend>
            {form.mortgages.map((m, i) => (
              <div className="mortgage" key={i}>
                <input
                  inputMode="numeric"
                  aria-label={`근저당 ${i + 1}번 채권최고액(만원)`}
                  placeholder="채권최고액(만원)"
                  value={m.amountManwon}
                  onChange={(e) =>
                    set(
                      'mortgages',
                      form.mortgages.map((x, j) => (j === i ? { ...x, amountManwon: e.target.value } : x)),
                    )
                  }
                />
                <input
                  type="date"
                  aria-label={`근저당 ${i + 1}번 설정일`}
                  value={m.registeredAt}
                  onChange={(e) =>
                    set(
                      'mortgages',
                      form.mortgages.map((x, j) => (j === i ? { ...x, registeredAt: e.target.value } : x)),
                    )
                  }
                />
                <label className="check">
                  <input
                    type="checkbox"
                    checked={m.cancelled}
                    onChange={(e) =>
                      set(
                        'mortgages',
                        form.mortgages.map((x, j) => (j === i ? { ...x, cancelled: e.target.checked } : x)),
                      )
                    }
                  />
                  말소됨
                </label>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() =>
                    set(
                      'mortgages',
                      form.mortgages.filter((_, j) => j !== i),
                    )
                  }
                >
                  삭제
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-link"
              onClick={() =>
                set('mortgages', [
                  ...form.mortgages,
                  { amountManwon: '', registeredAt: '', cancelled: false },
                ])
              }
            >
              + 근저당 추가
            </button>
          </fieldset>
        </div>
      )}

      {extra}

      {errors.length > 0 && (
        <ul className="errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button type="submit" className="btn-primary">
          분석하기
        </button>
        <button type="button" className="btn-secondary" onClick={onReset}>
          초기화
        </button>
      </div>
    </form>
  );
}
