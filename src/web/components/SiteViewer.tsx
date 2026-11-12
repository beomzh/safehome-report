'use client';

import { useEffect, useState } from 'react';
import { canFrame, normalizeViewUrl, VIEWER_EVENT } from '../siteViewer';

/** 매물 링크를 입력하면 오른쪽 사이드바로 사이트를 보여준다. 페이지에 한 번만 둔다 */
export function SiteViewer() {
  const [url, setUrl] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [bad, setBad] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      setUrl(next);
      setInput(next);
      setBad(false);
    };
    window.addEventListener(VIEWER_EVENT, onOpen);
    return () => window.removeEventListener(VIEWER_EVENT, onOpen);
  }, []);

  // 사이드바가 열려 있는 동안 본문이 가려지지 않도록 오른쪽 여백을 둔다
  useEffect(() => {
    document.body.classList.toggle('viewer-open', url !== null);
    return () => document.body.classList.remove('viewer-open');
  }, [url]);

  if (!url) return null;

  const go = () => {
    const n = normalizeViewUrl(input);
    if (!n) {
      setBad(true);
      return;
    }
    setBad(false);
    setUrl(n);
  };

  return (
    <aside className="viewer-side" aria-label="사이트 보기">
      <div className="viewer-bar">
        <input
          className="viewer-url"
          aria-label="주소"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder="https://… 매물 주소"
        />
        <button type="button" className="btn-secondary" onClick={go}>
          이동
        </button>
        <a className="btn-secondary" href={url} target="_blank" rel="noopener noreferrer">
          새 창
        </a>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setUrl(null)}
          aria-label="사이드바 닫기"
        >
          닫기
        </button>
      </div>
      {bad && (
        <p className="errors" role="alert">
          http(s) 주소를 입력하세요.
        </p>
      )}
      {canFrame(url) ? (
        <iframe
          key={url}
          className="viewer-frame"
          title="매물 사이트"
          src={url}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
      ) : (
        <p className="notice">
          이 사이트(네이버 부동산·호갱노노 등)는 다른 페이지 안에 표시하는 것을 막습니다. “새 창”으로 열어
          보세요.
        </p>
      )}
      <p className="hint viewer-hint">
        화면이 비어 있으면 그 사이트가 표시를 막은 것입니다. 보이는 매물 화면은 캡처해 설명 붙여넣기 칸에
        붙여넣으면 항목을 채웁니다. 이 앱은 프레임 안의 내용을 읽지 않습니다.
      </p>
    </aside>
  );
}
