'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * 분석 리포트를 팝업(모달)으로 보여준다. 네이티브 <dialog> 라서 ESC 로 닫히고 포커스가 갇힌다.
 * 바깥(배경)을 누르거나 닫기 버튼으로 닫을 수 있고, 인쇄 버튼은 팝업 내용만 인쇄한다.
 */
export function ReportDialog({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="report-dialog"
      aria-labelledby="report-dialog-title"
      onClose={onClose}
      onClick={(e) => {
        // 배경(::backdrop)을 누르면 이벤트 대상이 dialog 자신이 된다
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-bar">
          <h2 id="report-dialog-title">{title}</h2>
          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              인쇄
            </button>
            <button type="button" className="btn-primary" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </dialog>
  );
}
