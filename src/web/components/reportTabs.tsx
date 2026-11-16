import type { AnalysisResult } from '../analysis';
import { todayIso } from '../form';
import { ChecklistPanel } from './ChecklistPanel';
import { FinanceReport } from './FinanceReport';
import { LoanCatalog } from './LoanCatalog';
import { LoanRecommendations } from './LoanRecommendations';
import type { LookupInfo } from './MarketLookup';
import { MarketNotes } from './MarketNotes';
import type { ReportTab } from './ReportDialog';
import { ReportView } from './ReportView';
import { RequirementsReport } from './RequirementsReport';
import { VerdictPanel } from './VerdictPanel';

/** 상세 리포트(시트) 구성. 방문 전 점검과 정밀 분석이 같이 쓴다 */
export function buildReportTabs(result: AnalysisResult, lookupInfo: LookupInfo): ReportTab[] {
  return [
    {
      id: 'verdict',
      label: '종합 판정',
      content: <VerdictPanel result={result.verdict} kind={result.input.contract.kind} />,
    },
    {
      id: 'risk',
      label: '위험 신호',
      content: <ReportView report={result.report} input={result.input} />,
    },
    {
      id: 'loan-reco',
      label: '대출 추천',
      content: <LoanRecommendations recs={result.loanRecs} today={todayIso()} />,
    },
    ...(result.requirements
      ? [
          {
            id: 'requirements',
            label: '필요 조건',
            content: (
              <RequirementsReport
                requirements={result.requirements}
                kind={result.input.contract.kind}
                amountWon={result.input.contract.amount}
                grade={result.report.grade}
                costNotes={result.costNotes ?? []}
                assumptionNotes={result.assumptionNotes ?? []}
              />
            ),
          },
        ]
      : []),
    ...(result.finance
      ? [
          {
            id: 'finance',
            label: '자금 여력',
            content: <FinanceReport result={result.finance} grade={result.report.grade} />,
          },
        ]
      : []),
    {
      id: 'market',
      label: '시세·대안 단지',
      content: <MarketNotes info={lookupInfo} />,
    },
    {
      id: 'loans',
      label: '대출 안내',
      content: <LoanCatalog kind={result.input.contract.kind} grade={result.report.grade} />,
    },
    {
      id: 'checklist',
      label: '체크리스트',
      content: <ChecklistPanel kind={result.input.contract.kind} />,
    },
  ];
}
