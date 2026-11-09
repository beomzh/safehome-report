'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { Kind } from '../form';
import { editField } from '../assumptions';
import type { FinanceFormState } from '../financeForm';
import { AssumptionAdvisor } from './AssumptionAdvisor';

interface Props {
  fin: FinanceFormState;
  setFin: Dispatch<SetStateAction<FinanceFormState>>;
  kind: Kind;
  /** 메인 폼의 보증금(매매가) 입력값 (만원) — AI 기준값 제안에 사용 */
  amountManwon: string;
}

type TextKey = Exclude<keyof FinanceFormState, 'enabled' | 'autoCosts' | 'aiFields'>;

export function FinanceFields({ fin, setFin, kind, amountManwon }: Props) {
  const isSale = kind === 'sale';
  const isJeonse = kind === 'jeonse';

  const text = (key: TextKey, label: string, placeholder: string, hint?: string) => (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={fin[key]}
        onChange={(e) =>
          // AI 제안으로 채운 칸을 직접 고치면 그 칸만 "AI 제안" 표시에서 뺀다 (사용자가 값을 책임진다)
          setFin((f) => editField(f, key, e.target.value))
        }
      />
      {hint && <small className="hint">{hint}</small>}
    </label>
  );

  return (
    <>
      <h2>4. 대출·자금 계획 (선택)</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={fin.enabled}
          onChange={(e) => setFin((f) => ({ ...f, enabled: e.target.checked }))}
        />
        이 매물에 필요한 연소득·자산과 대출 한도 계산하기
      </label>
      <p className="hint">
        입력한 재무 정보는 이 브라우저 안에서만 계산되며 저장·전송되지 않습니다. 대출·세금 기준값은 규제와
        금융기관마다 달라 앱이 기본값을 제공하지 않으니, 금융기관·공식 안내의 값을 직접 입력하세요.
      </p>

      {fin.enabled && (
        <div className="registry">
          <AssumptionAdvisor setFin={setFin} kind={kind} amountManwon={amountManwon} />

          <fieldset>
            <legend>내 재무 정보 (선택 — 비우면 "필요 조건"만 계산)</legend>
            {text('assetsManwon', '보유 자산·자기자금 (만원, 선택)', '예: 20,000')}
            {text('annualIncomeManwon', '연소득 (만원, 선택)', '예: 6,000')}
            {text('existingAnnualDebtManwon', '기존 대출 연 원리금 상환액 (만원, 없으면 비움)', '예: 600')}
          </fieldset>

          <fieldset>
            <legend>대출 기준값 (필수)</legend>
            <button
              type="button"
              className="btn-link"
              onClick={() =>
                setFin((f) => ({
                  ...f,
                  ltvLimitPercent: f.ltvLimitPercent || '70',
                  dsrLimitPercent: f.dsrLimitPercent || '40',
                  annualRatePercent: f.annualRatePercent || '4',
                  stressAddPercent: f.stressAddPercent || '1.5',
                  termYears: f.termYears || '30',
                }))
              }
            >
              예시 값으로 빈 칸 채우기 (공식 값 아님 — 은행 안내값으로 바꾸세요)
            </button>
            <div className="row2">
              {text('ltvLimitPercent', 'LTV 한도 (%)', '예: 70')}
              {text('dsrLimitPercent', 'DSR 한도 (%)', '예: 40')}
            </div>
            <div className="row2">
              {text('annualRatePercent', '예상 금리 (연 %)', '예: 4.5')}
              {text('stressAddPercent', '스트레스 가산 금리 (%p, 없으면 비움)', '예: 1.5')}
            </div>
            <div className="row2">
              {text('termYears', '대출 기간 (년)', '예: 30')}
              {text('productCapManwon', '상품·기관 한도 (만원, 선택)', '예: 20,000')}
            </div>
            <p className="hint">
              담보가치는 {isSale ? '매매가와 입력한 시세 중 낮은 값' : '보증금'}으로 계산합니다.
              {isSale && ' 매도인의 기존 근저당은 잔금 때 말소된다고 보고 한도에서 차감하지 않습니다.'}
            </p>
          </fieldset>

          <fieldset>
            <legend>세금·수수료 (취득세·중개보수)</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={fin.autoCosts}
                onChange={(e) => setFin((f) => ({ ...f, autoCosts: e.target.checked }))}
              />
              법정 요율로 자동 계산 (아래에 직접 입력한 값이 있으면 그 값을 사용)
            </label>
            <p className="hint">
              취득세는 일반 세율 기준이고 다주택·조정대상지역 중과와 감면은 반영하지 않습니다. 중과를 받는다면
              세율을 직접 입력하세요. 보유세는 계산하지 않습니다. 요율표는 잠정값입니다.
            </p>
            {kind === 'monthly' && text('monthlyRentManwon', '월세 (만원, 중개보수 환산용)', '예: 80')}
            {isSale &&
              text('acquisitionTaxPercent', '취득세 등 비율 (%, 직접 입력 시 자동 계산 대신 사용)', '예: 8')}
            <div className="row2">
              {text('brokerFeePercent', '중개보수 요율 (%, 직접 입력 시 자동 계산 대신 사용)', '예: 0.4')}
              {text('brokerFeeOverrideManwon', '또는 중개보수 금액 (만원)', '입력 시 요율보다 우선')}
            </div>
            {isJeonse && text('guaranteeFeePercent', '전세보증보험료 요율 (%)', '예: 0.126')}
            <div className="row2">
              {text('registrationCostsManwon', '등기·법무사 등 비용 (만원)', '예: 200')}
              {text('otherCostsManwon', '이사·수리 등 기타 (만원)', '예: 300')}
            </div>
            {text('downPaymentPercent', '계약금 비율 (%, 시점별 현금 계산용)', '예: 10')}
          </fieldset>
        </div>
      )}
    </>
  );
}
