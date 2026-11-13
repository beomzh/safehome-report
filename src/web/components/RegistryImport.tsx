'use client';

import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { parseRegistryText } from '../../core';
import type { FormState } from '../form';
import { extractPdfText, PDF_ERROR_TEXT, renderPdfPages } from '../pdfText';
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

  const [busy, setBusy] = useState(false);
  // 텍스트가 없는 스캔본 PDF: AI 로 읽을지 사용자가 정할 때까지 파일을 들고 있는다
  const [scan, setScan] = useState<ArrayBuffer | null>(null);
  const [agree, setAgree] = useState(false);

  const run = (source: string = text, fromAi = false) => {
    setError('');
    setDone('');
    const r = parseRegistryText(source);
    if (!r.ok || !r.facts) {
      setNotes([]);
      setError(r.error ?? '분석하지 못했습니다.');
      return;
    }
    const mapped = registryToForm(r.facts);
    setForm((f) => ({ ...f, ...mapped.patch }));
    setNotes([
      ...(fromAi
        ? [
            'AI 가 이미지에서 읽은 글자입니다. 소유자 이름·날짜·채권최고액에 오타가 있을 수 있으니 반드시 원문과 하나씩 대조하세요.',
          ]
        : []),
      ...r.warnings,
      ...mapped.warnings,
    ]);
    setText('');
    setDone(
      `입력칸을 채웠습니다 (소유자 ${r.facts.owners.length}명, 근저당 ${mapped.patch.mortgages.length}건, 이전 ${mapped.patch.transfers.length}건, 인식 신뢰도 ${Math.round(r.facts.parseConfidence * 100)}%). 반드시 원문과 대조해 고친 뒤 분석하세요.`,
    );
  };

  const onPdf = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setDone('');
    setNotes([]);
    setBusy(true);
    try {
      setScan(null);
      setAgree(false);
      const data = await file.arrayBuffer();
      const res = await extractPdfText(data);
      if (!res.ok) {
        setError(PDF_ERROR_TEXT[res.reason]);
        // 글자가 없는 스캔본이면 AI 로 읽는 방법을 안내한다
        if (res.reason === 'no_text') setScan(data);
        return;
      }
      run(res.text);
    } finally {
      setBusy(false);
    }
  };

  const readScan = async () => {
    if (!scan) return;
    setError('');
    setBusy(true);
    try {
      const pages = await renderPdfPages(scan);
      if (!pages.ok) {
        setError(PDF_ERROR_TEXT[pages.reason]);
        return;
      }
      const res = await fetch('/api/registry-ocr', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ images: pages.images }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text) {
        setError(data.error ?? '글자 읽기에 실패했습니다.');
        return;
      }
      setScan(null);
      setAgree(false);
      run(data.text, true);
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="registry-import">
      <label className="field">
        <span>등기사항전부증명서 PDF 파일 (말소사항 포함 열람·발급본)</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(e) => {
            void onPdf(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <small className="hint">
          PDF 는 이 브라우저 안에서만 읽고 서버로 보내지 않습니다. 텍스트가 들어 있는 PDF 만 읽을 수 있습니다.
        </small>
      </label>
      {busy && <p className="hint">PDF 를 읽는 중…</p>}
      {scan && (
        <div className="notice" role="group" aria-label="스캔본 AI 읽기">
          <strong>스캔본은 AI 로 읽을 수 있습니다 (선택, 정확하지 않을 수 있음)</strong>
          <p className="hint">
            쪽 이미지를 LLM 서버로 보내 글자로 옮깁니다.{' '}
            <strong>등기부의 소유자 성명·주소 같은 개인정보가 이미지째 LLM 서버로 전송됩니다.</strong> 오타가
            있을 수 있어 결과는 반드시 원문과 대조해야 합니다.
          </p>
          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            이미지가 LLM 서버로 전송되는 것을 이해하고 동의합니다
          </label>
          <button type="button" className="btn-secondary" disabled={!agree || busy} onClick={readScan}>
            AI 로 스캔본 읽기
          </button>
        </div>
      )}
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
        <button type="button" className="btn-secondary" onClick={() => run()} disabled={!text.trim()}>
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
        공개된 실제 열람본 2건으로만 확인한 기능입니다. 취소선으로만 표시된 말소 항목은 텍스트로 구분할 수
        없어 미말소로 읽힐 수 있으니, “말소사항 포함” 열람본이거나 원문과 직접 대조하세요.
      </p>
    </div>
  );
}
