import { Analyzer } from '../../web/components/Analyzer';
import { Disclaimer } from '../../web/components/Disclaimer';
import { PageHeader } from '../../web/components/PageHeader';
import { SiteViewer } from '../../web/components/SiteViewer';

export default function AfterVisit() {
  return (
    <main className="page">
      <PageHeader
        title="보고 온 뒤 정밀 분석"
        lead="방문해서 등기부등본·건축물대장 등을 확인한 뒤, 계약 전 위험 신호를 정밀하게 점검합니다. 방문 전 점검에서 입력한 값은 그대로 이어집니다."
      />
      <Disclaimer />
      <Analyzer />
      <SiteViewer />
    </main>
  );
}
