import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

/** 두 화면(방문 전 점검 / 보고 온 뒤 정밀 분석) 공통 머리말과 이동 링크 */
export function PageHeader({ title, lead }: { title: string; lead: string }) {
  return (
    <header className="page-header">
      <ThemeToggle />
      <nav className="page-nav" aria-label="화면 이동">
        <Link href="/">방문 전 점검</Link>
        <Link href="/after">보고 온 뒤 정밀 분석</Link>
      </nav>
      <h1>{title}</h1>
      <p className="muted">{lead}</p>
    </header>
  );
}
