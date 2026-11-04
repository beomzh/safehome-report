'use client';

import { useEffect, useState } from 'react';
import { CHECKLIST } from '../checklist';
import type { Kind } from '../form';

const STORAGE_KEY = 'safehome.checklist.v1';

/** 체크 상태만 브라우저에 저장한다 (개인정보 없음). 저장소 접근이 막혀도 동작해야 한다 */
function load(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function save(state: Record<string, boolean>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 저장 실패는 무시 (시크릿 창 등) */
  }
}

export function ChecklistPanel({ kind }: { kind: Kind }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => setDone(load()), []);

  const items = CHECKLIST.filter((i) => i.kinds.includes(kind));
  const toggle = (id: string, value: boolean) => {
    const next = { ...done, [id]: value };
    setDone(next);
    save(next);
  };

  return (
    <section className="card" aria-labelledby="checklist-title">
      <h2 id="checklist-title">확인할 일 체크리스트</h2>
      <ul className="checklist">
        {items.map((i) => (
          <li key={i.id}>
            <label className="check">
              <input
                type="checkbox"
                checked={!!done[i.id]}
                onChange={(e) => toggle(i.id, e.target.checked)}
              />
              <span className={done[i.id] ? 'done' : ''}>{i.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="hint">체크 상태는 이 브라우저에만 저장됩니다.</p>
    </section>
  );
}
