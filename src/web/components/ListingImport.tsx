'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ListingFields, UrlHint } from '../../adapters/llm/listing';
import { findDongName, findSigungu } from '../../core';
import type { FinanceFormState } from '../financeForm';
import type { FormState } from '../form';
import { fileToDataUrl, MAX_ATTACH_IMAGES, pickImageFiles } from '../imageAttach';
import { canFrame, normalizeViewUrl, openSiteViewer } from '../siteViewer';

interface Props {
  setForm: Dispatch<SetStateAction<FormState>>;
  /** 월세 금액을 대출·자금 계획 입력칸에 넣기 위해 사용 */
  setFin: Dispatch<SetStateAction<FinanceFormState>>;
}

interface ListingResponse {
  fields?: ListingFields;
  urlHint?: UrlHint | null;
  truncated?: boolean;
  error?: string;
}

/** 주소에서 지번(예: 휘경동 123-4 → 123-4)을 읽는다. 도로명 건물번호(…로 12)는 읽지 않는다 */
function jibunFromAddress(address: string | null): string | null {
  const m = address
    ? /[가-힣0-9]+(?:동|리|가)\s+(산?\s*\d{1,4}(?:-\d{1,4})?)(?![\d가-힣])/.exec(address)
    : null;
  return m ? (m[1] as string).replace(/\s+/g, '') : null;
}

const KIND_LABEL = { jeonse: '전세', monthly: '월세', sale: '매매' } as const;
const HOUSING_LABEL = {
  apt: '아파트',
  rowhouse: '연립·다세대(빌라)',
  officetel: '오피스텔',
  house: '단독·다가구',
} as const;

const PLATFORM_LABEL: Record<UrlHint['platform'], string> = {
  naver: '네이버 부동산',
  zigbang: '직방',
  dabang: '다방',
  other: '기타 사이트',
};

/**
 * 매물 링크·설명을 붙여넣어 입력 항목을 채운다 (LLM, 선택 기능).
 * 링크 내용은 앱이 읽지 않는다(플랫폼 약관·차단). 링크에서는 플랫폼과 매물 번호만 해석하고,
 * 항목은 사용자가 붙여넣은 설명 텍스트에서 추출한다. 추출 결과는 사용자가 확인한 뒤에만 적용한다.
 */
export function ListingImport({ setForm, setFin }: Props) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    fields: ListingFields;
    hint: UrlHint | null;
    truncated: boolean;
  } | null>(null);
  const [regionNote, setRegionNote] = useState('');
  const [applied, setApplied] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const addRef = useRef<(files: Iterable<File>) => Promise<void>>(async () => {});

  const addFiles = async (files: Iterable<File>) => {
    const picked = pickImageFiles(files);
    if (picked.length === 0) return;
    const room = MAX_ATTACH_IMAGES - images.length;
    if (room <= 0) {
      setError(`이미지는 최대 ${MAX_ATTACH_IMAGES}장까지 넣을 수 있습니다.`);
      return;
    }
    const urls = (await Promise.all(picked.slice(0, room).map(fileToDataUrl))).filter(
      (u): u is string => u !== null,
    );
    if (urls.length < Math.min(picked.length, room))
      setError('일부 이미지를 읽지 못했습니다. PNG·JPEG·WebP 인지 확인하세요.');
    else setError(null);
    setImages((prev) => [...prev, ...urls].slice(0, MAX_ATTACH_IMAGES));
  };

  addRef.current = addFiles;

  // 올바른 링크가 입력되면 잠시 뒤 사이드바로 보여준다
  useEffect(() => {
    if (!url.trim()) return;
    // 프레임을 막는 사이트(네이버·호갱노노)는 빈 사이드바만 생기므로 열지 않고 새 창 링크만 보여준다
    const t = setTimeout(() => {
      const n = normalizeViewUrl(url);
      if (n && canFrame(n)) openSiteViewer(n);
    }, 600);
    return () => clearTimeout(t);
  }, [url]);

  // 캡처를 클립보드에 복사한 뒤 이 화면 어디서든 붙여넣기(Ctrl/Cmd+V) 하면 이미지가 들어간다
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (pickImageFiles(files).length > 0) {
        e.preventDefault();
        void addRef.current(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const extract = async () => {
    setError(null);
    setResult(null);
    setApplied(false);
    if (text.trim().length < 10 && images.length === 0) {
      setError(
        '링크만으로는 매물 내용을 읽을 수 없습니다. 매물 화면의 설명을 복사해 붙여넣거나, 화면을 캡처해 이미지로 넣어 주세요.',
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/listing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, url, images }),
      });
      const data = (await res.json()) as ListingResponse;
      if (!res.ok || !data.fields) {
        setError(data.error ?? '항목 추출에 실패했습니다. 항목을 직접 입력해 주세요.');
        return;
      }
      setResult({ fields: data.fields, hint: data.urlHint ?? null, truncated: data.truncated ?? false });
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result) return;
    const f = result.fields;
    // 주소 → 시군구 법정동코드(검증된 표) · 법정동명. 모르면 비워 두고 직접 입력하게 한다
    const region = f.address ? findSigungu(f.address) : null;
    const dong = f.address ? findDongName(f.address) : undefined;
    const canLookup = region?.ok === true && f.areaM2 !== null;
    if (region?.ok) setRegionNote(`${region.match.name} (${region.match.code})로 시세 조회를 준비했습니다.`);
    else if (f.address)
      setRegionNote(
        region?.reason === 'ambiguous'
          ? '주소만으로 지역을 하나로 정할 수 없어 법정동코드를 직접 입력해야 합니다.'
          : '이 주소의 법정동코드를 자동으로 찾지 못했습니다(표에 없는 지역이거나 폐지된 옛 구 이름일 수 있습니다). 시세 조회의 법정동코드를 직접 입력하세요.',
      );
    else setRegionNote('주소가 없어 법정동코드를 직접 입력해야 합니다.');
    setForm((prev) => ({
      ...prev,
      kind: f.kind ?? prev.kind,
      amountManwon: f.amountManwon !== null ? String(f.amountManwon) : prev.amountManwon,
      lookupHousing: f.housingType ?? prev.lookupHousing,
      statedLoanManwon:
        f.priorLoanManwon !== null && (f.kind ?? prev.kind) !== 'sale'
          ? String(f.priorLoanManwon)
          : prev.statedLoanManwon,
      lookupAddress: f.address ?? prev.lookupAddress,
      buildingJibun: jibunFromAddress(f.address) ?? prev.buildingJibun,
      lookupLawdCd: region?.ok ? region.match.code : prev.lookupLawdCd,
      // 단독·다가구는 건물명이 없어 법정동명을 건물명 칸에 쓴다
      lookupComplexName:
        (f.housingType ?? prev.lookupHousing) === 'house'
          ? (dong ?? prev.lookupComplexName)
          : (f.complexName ?? prev.lookupComplexName),
      lookupDongName: dong ?? prev.lookupDongName,
      lookupAreaM2: f.areaM2 !== null ? String(f.areaM2) : prev.lookupAreaM2,
      // 조회에 필요한 값이 모이면 시세 조회를 자동으로 실행한다
      lookupNonce: canLookup ? prev.lookupNonce + 1 : prev.lookupNonce,
    }));
    // 월세 금액은 중개보수 환산에 쓰이므로 대출·자금 계획 칸에도 넣는다 (없으면 기존 값 유지)
    const rent = f.monthlyRentManwon;
    if (rent !== null && rent > 0) setFin((prev) => ({ ...prev, monthlyRentManwon: String(rent) }));
    setApplied(true);
  };

  const f = result?.fields;
  const linkUrl = normalizeViewUrl(url);
  const blockedLink = linkUrl !== null && !canFrame(linkUrl);
  return (
    <div>
      <label className="field">
        <span>매물 링크 (선택)</span>
        <input
          autoComplete="off"
          inputMode="url"
          placeholder="https://… 매물 페이지 주소"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {blockedLink ? (
          <small className="hint">
            이 사이트는 화면 안에 표시할 수 없습니다.{' '}
            <a href={linkUrl} target="_blank" rel="noopener noreferrer">
              새 창에서 열기
            </a>
          </small>
        ) : (
          <small className="hint">링크를 넣으면 오른쪽 사이드바에서 사이트를 볼 수 있습니다.</small>
        )}
      </label>
      <label className="field">
        <span>매물 설명 붙여넣기 (캡처 이미지도 붙여넣을 수 있음)</span>
        <textarea
          rows={5}
          placeholder="매물 화면의 가격·면적·층 등을 복사해 붙여넣거나, 화면 캡처(Ctrl/⌘+V)를 그대로 붙여넣으세요 (최대 4장)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {images.length > 0 && (
        <div className="attach-row">
          {images.map((src, i) => (
            <span key={src.slice(-40) + i} className="attach-thumb">
              <img src={src} alt={`붙여넣은 캡처 ${i + 1}`} />
              <button
                type="button"
                className="btn-secondary"
                aria-label={`캡처 ${i + 1} 삭제`}
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <button type="button" className="btn-secondary" onClick={extract} disabled={busy}>
        {busy ? '추출 중…' : 'AI로 항목 추출'}
      </button>
      <details className="fold">
        <summary>전송·개인정보 안내</summary>
        <p className="hint">
          앱은 링크 내용을 직접 읽지 않습니다(플랫폼 약관·차단). 링크에서는 사이트와 매물 번호만 인식하고,
          항목은 붙여넣은 설명에서 추출합니다. 이 버튼을 누르면 붙여넣은 설명과 첨부한 캡처가 LLM 서버로
          전송됩니다(텍스트의 전화번호·이메일은 제거하지만 이미지 속 글자는 제거할 수 없으니, 연락처·이름이
          보이면 가리고 캡처하세요). 추출 결과는 확인 후에만 입력칸에 적용되며, 판정은 AI가 아니라 계산 규칙이
          합니다.
        </p>
      </details>

      {error && (
        <p className="errors" role="alert">
          {error}
        </p>
      )}

      {f && (
        <div className="notice" role="status">
          <strong>추출 결과 — 맞는지 확인하세요</strong>
          {result?.hint && (
            <p className="hint">
              링크: {PLATFORM_LABEL[result.hint.platform]}
              {result.hint.articleId ? ` · 매물 번호 ${result.hint.articleId}` : ''}
            </p>
          )}
          <ul className="evidence">
            <li>유형: {f.kind ? KIND_LABEL[f.kind] : '확인 안 됨'}</li>
            <li>
              {f.kind === 'sale' ? '매매가' : '보증금'}:{' '}
              {f.amountManwon !== null ? `${f.amountManwon.toLocaleString('ko-KR')}만원` : '확인 안 됨'}
              {f.monthlyRentManwon ? ` / 월세 ${f.monthlyRentManwon.toLocaleString('ko-KR')}만원` : ''}
            </li>
            {f.priorLoanManwon !== null && (
              <li>융자금(설명에 적힌 값, 미확인): {f.priorLoanManwon.toLocaleString('ko-KR')}만원</li>
            )}
            <li>단지명: {f.complexName ?? '확인 안 됨'}</li>
            <li>
              주택 유형:{' '}
              {f.housingType ? HOUSING_LABEL[f.housingType] : '확인 안 됨 (시세 조회에서 직접 선택)'}
            </li>
            <li>주소: {f.address ?? '확인 안 됨'}</li>
            <li>전용면적: {f.areaM2 !== null ? `${f.areaM2}㎡` : '확인 안 됨'}</li>
            <li>층: {f.floor ?? '확인 안 됨'}</li>
            <li>준공연도: {f.builtYear ?? '확인 안 됨'}</li>
          </ul>
          {f.warnings.length > 0 && (
            <>
              <p>
                <strong>매물 설명에 적힌 주의 문구 (등기부로 반드시 확인)</strong>
              </p>
              <ul className="evidence">
                {f.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
          {result?.truncated && <p className="hint">설명이 길어 앞부분만 사용했습니다.</p>}
          <button type="button" className="btn-primary" onClick={apply} disabled={applied}>
            {applied ? '입력칸에 적용됨' : '입력칸에 적용'}
          </button>
          {regionNote && <p className="hint">{regionNote}</p>}
        </div>
      )}
    </div>
  );
}
