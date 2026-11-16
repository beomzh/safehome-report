import { Disclaimer } from '../web/components/Disclaimer';
import { PageHeader } from '../web/components/PageHeader';
import { PreVisit } from '../web/components/PreVisit';
import { SiteViewer } from '../web/components/SiteViewer';

export default function Home() {
  return (
    <main className="page">
      <PageHeader
        title="방문 전 점검"
        lead="매물 링크와 캡처만 넣으면 보러 갈지, 대출이 대략 얼마 나오는지 바로 알려 드립니다. 계산은 이 브라우저에서만 이루어지고, AI 추출·시세 조회 버튼을 누를 때만 필요한 정보가 전송됩니다."
      />
      <Disclaimer />
      <PreVisit />
      <SiteViewer />
    </main>
  );
}
