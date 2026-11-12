import { Analyzer } from '../web/components/Analyzer';
import { ThemeToggle } from '../web/components/ThemeToggle';
import { SiteViewer } from '../web/components/SiteViewer';
import { Disclaimer } from '../web/components/Disclaimer';

export default function Home() {
  return (
    <main className="page">
      <header className="page-header">
        <ThemeToggle />
        <h1>계약 전 위험 신호 점검</h1>
        <p className="muted">
          분석 계산은 이 브라우저에서만 이루어집니다. 실거래가 조회를 쓸 때만 법정동코드·면적·단지명이
          공공데이터포털로 전송되며, 성명·금액·재무 정보는 전송되지 않습니다.
        </p>
      </header>
      <Disclaimer />
      <Analyzer />
      <SiteViewer />
    </main>
  );
}
