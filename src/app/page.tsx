import { Analyzer } from '../web/components/Analyzer';
import { Disclaimer } from '../web/components/Disclaimer';

export default function Home() {
  return (
    <main className="page">
      <header className="page-header">
        <h1>계약 전 위험 신호 점검</h1>
        <p className="muted">입력한 정보는 이 브라우저에서만 계산되며 서버나 외부로 전송되지 않습니다.</p>
      </header>
      <Disclaimer />
      <Analyzer />
    </main>
  );
}
