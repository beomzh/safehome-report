'use client';

import { useEffect, useRef, useState } from 'react';
import { normalizeViewUrl, openSiteViewer, VIEWER_EVENT } from '../siteViewer';

/** 매물 사이트를 화면 안 팝업(프레임)으로 보여준다. 페이지에 한 번만 둔다 */
export function SiteViewer() {
  const ref = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [bad, setBad] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      setUrl(next);
      setInput(next);
      setBad(false);
      if (!ref.current?.open) ref.current?.showModal();
    };
    window.addEventListener(VIEWER_EVENT, onOpen);
    return () => window.removeEventListener(VIEWER_EVENT, onOpen);
  }, []);

  const close = () => {
    ref.current?.close();
    setUrl(null);
  };

  const go = () => {
    const n = normalizeViewUrl(input);
    if (!n) {
      setBad(true);
      return;
    }
    setBad(false);
    // 프레임에 넣을 수 없는 사이트면 팝업 창으로 열고 이 패널은 그대로 둔다
    openSiteViewer(n);
  };

  return (
    <dialog
      ref={ref}
      className="report-dialog viewer-dialog"
      onClose={() => setUrl(null)}
      aria-label="사이트 보기"
    >
      <div className="dialog-inner">
        <div className="dialog-bar">
          <input
            className="viewer-url"
            aria-label="주소"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && go()}
            placeholder="https://… 매물 주소"
          />
          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={go}>
              이동
            </button>
            {url && (
              <a className="btn-secondary" href={url} target="_blank" rel="noopener noreferrer">
                새 창
              </a>
            )}
            <button type="button" className="btn-secondary" onClick={close}>
              닫기
            </button>
          </div>
        </div>
        {bad && (
          <p className="errors" role="alert">
            http(s) 주소를 입력하세요.
          </p>
        )}
        <p className="hint viewer-hint">
          화면이 비어 있거나 거부되면 그 사이트가 프레임 표시를 막은 것입니다 — “새 창”으로 여세요. 보이는
          매물 화면은 캡처해 “매물 링크·설명으로 시작하기”에 붙여넣으면 항목을 채웁니다. 이 앱은 프레임 안의
          내용을 읽지 않습니다.
        </p>
        {url && (
          <iframe
            key={url}
            className="viewer-frame"
            title="매물 사이트"
            src={url}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </dialog>
  );
}
