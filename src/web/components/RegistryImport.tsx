'use client';

import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { parseRegistryText } from '../../core';
import type { FormState } from '../form';
import { registryToForm } from '../registryImport';

interface Props {
  setForm: Dispatch<SetStateAction<FormState>>;
}

/** 등기사항전부증명서 PDF 에서 복사한 텍스트를 브라우저 안에서만 분석해 아래 입력칸을 채운다 */
export function RegistryImport({ setForm }: Props) {
  const [text, setText] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const run = () => {
    setError('');
    setDone('');
    const r = parseRegistryText(text);
    if (!r.ok || !r.facts) {
      setNotes([]);
      setError(r.error ?? '분석하지 못했습니다.');
      return;
    }
    const mapped = registryToForm(r.facts);
    setForm((f) => ({ ...f, ...mapped.patch }));
    setNotes([...r.warnings, ...mapped.warnings]);
    setText('');
    setDone(
      `입력칸을 채웠습니다 (소유자 ${r.facts.owners.length}명, 근저당 ${mapped.patch.mortgages.length}건, 이전 ${mapped.patch.transfers.length}건, 인식 신뢰도 ${Math.round(r.facts.parseConfidence * 100)}%). 반드시 원문과 대조해 고친 뒤 분석하세요.`,
    );
  };

  return (
    <div className="registry-import">
      <label className="field">
        <span>등기사항전부증명서 텍스트 붙여넣기 (PDF를 열어 전체 선택 → 복사)</span>
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="【 갑 구 】 … 【 을 구 】 … 부분을 포함해 붙여넣으세요. 이 분석은 브라우저 안에서만 실행되며 서버로 보내지 않습니다."
        />
      </label>
      <div className="actions">
        <button type="button" className="btn-secondary" onClick={run} disabled={!text.trim()}>
          붙여넣은 내용으로 입력칸 채우기
        </button>
      </div>
      {error && (
        <p className="errors" role="alert">
          {error}
        </p>
      )}
      {done && <p className="notice">{done}</p>}
      {notes.length > 0 && (
        <ul className="evidence">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <p className="hint">
        실제 문서로 검증이 끝나지 않은 기능입니다. 취소선으로만 표시된 말소 항목은 텍스트로 구분할 수 없어
        미말소로 읽힐 수 있으니, “말소사항 포함” 열람본이거나 원문과 직접 대조하세요.
      </p>
    </div>
  );
}
