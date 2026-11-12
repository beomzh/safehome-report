'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { FinanceFormState } from '../financeForm';
import type { ProfileState } from '../profile';

interface Props {
  profile: ProfileState;
  setProfile: Dispatch<SetStateAction<ProfileState>>;
  fin: FinanceFormState;
  setFin: Dispatch<SetStateAction<FinanceFormState>>;
}

/**
 * "내 상황" — 정책 대출 추천에 쓰는 소득·가구 정보. 이 브라우저 안에서만 쓰이고 서버로 보내지 않는다.
 * 비워 둔 항목은 충족 여부를 단정하지 않고 "확인 필요"로 표시한다.
 */
export function ProfileFields({ profile, setProfile, fin, setFin }: Props) {
  const set = <K extends keyof ProfileState>(key: K, value: ProfileState[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));
  const check = (
    key: keyof ProfileState &
      ('homeless' | 'householdHead' | 'newlywed' | 'newbornWithin2y' | 'firstHome' | 'dualIncome'),
    label: string,
  ) => (
    <label className="check">
      <input type="checkbox" checked={profile[key]} onChange={(e) => set(key, e.target.checked)} />
      {label}
    </label>
  );

  return (
    <div>
      <div className="row2">
        <label className="field">
          <span>부부합산 연소득 (만원)</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="예: 6,000"
            value={fin.annualIncomeManwon}
            onChange={(e) => setFin((f) => ({ ...f, annualIncomeManwon: e.target.value }))}
          />
        </label>
        <label className="field">
          <span>순자산 (만원, 자산−부채)</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="예: 20,000"
            value={profile.netAssetManwon}
            onChange={(e) => set('netAssetManwon', e.target.value)}
          />
        </label>
      </div>
      <div className="row2">
        <label className="field">
          <span>만 나이 (대표 신청인)</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="예: 32"
            value={profile.age}
            onChange={(e) => set('age', e.target.value)}
          />
        </label>
        <label className="field">
          <span>미성년 자녀 수</span>
          <select
            value={profile.minorChildren}
            onChange={(e) => set('minorChildren', e.target.value as ProfileState['minorChildren'])}
          >
            <option value="0">없음</option>
            <option value="1">1명</option>
            <option value="2">2명</option>
            <option value="3">3명 이상</option>
          </select>
        </label>
      </div>
      <div className="checks">
        {check('homeless', '무주택 (세대원 모두)')}
        {check('householdHead', '세대주 (예비 포함)')}
        {check('newlywed', '신혼부부 (혼인 7년 이내·3개월 내 결혼 예정)')}
        {check('newbornWithin2y', '2년 내 출산(입양) 자녀 있음')}
        {check('firstHome', '생애최초 주택 구입')}
        {check('dualIncome', '맞벌이 (부부 모두 소득)')}
      </div>
      <p className="hint">
        이 정보는 이 브라우저 안에서만 쓰이며 서버로 보내지 않습니다. 비워 두면 해당 요건은 "확인 필요"로
        표시되고, 무주택·세대주는 가장 흔한 경우로 미리 체크해 두었으니 해당하지 않으면 해제하세요.
      </p>
    </div>
  );
}
