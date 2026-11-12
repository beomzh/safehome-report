import { jeonseRatioPercent } from '../../core';
import type { JeonseEstimate, MonthlyEstimate } from '../../core';
import { formatWon } from '../present';

export interface RentInfo {
  jeonse: JeonseEstimate | null;
  monthly: MonthlyEstimate | null;
  windowMonths: number;
}

export type RentState =
  { status: 'loading' } | { status: 'error'; message: string } | ({ status: 'ok' } & RentInfo);

interface Props {
  rent: RentState;
  /** 같은 조건 매매 시세 중앙값 (원) — 전세가율 계산용 */
  saleWon?: number;
  /** 입력한 보증금 (원, 전세·월세 계약일 때) */
  depositWon?: number;
  kind: 'jeonse' | 'monthly' | 'sale';
}

/** 전월세 실거래로 본 전세 시세·전세가율·입력 보증금 비교 (참고용, 판정에는 쓰지 않는다) */
export function RentSummary({ rent, saleWon, depositWon, kind }: Props) {
  if (rent.status === 'loading') return <p className="hint">전월세 거래를 조회하는 중…</p>;
  if (rent.status === 'error') return <p className="errors">{rent.message}</p>;
  const { jeonse, monthly, windowMonths } = rent;
  if (!jeonse && !monthly)
    return (
      <p className="notice">
        최근 {windowMonths}개월 안에 같은 조건의 전월세 거래가 없습니다. 단지명을 비우거나 면적을 확인하세요.
      </p>
    );
  const ratio = jeonseRatioPercent(jeonse?.medianWon, saleWon);
  const diff =
    jeonse && depositWon !== undefined && depositWon > 0 && kind === 'jeonse'
      ? Math.round(((depositWon - jeonse.medianWon) * 1000) / jeonse.medianWon) / 10
      : undefined;
  return (
    <div className="notice" role="status">
      <strong>전월세 실거래 참고 (최근 {windowMonths}개월)</strong>
      <ul className="evidence">
        {jeonse && (
          <li>
            전세 중앙값 {formatWon(jeonse.medianWon)} ({jeonse.sampleCount}건, 최저 {formatWon(jeonse.minWon)}{' '}
            ~ 최고 {formatWon(jeonse.maxWon)})
            {jeonse.confidence === 'low' &&
              (jeonse.includesRenewal
                ? ' — 신규 계약이 적어 갱신 계약을 포함했습니다(신뢰도 낮음, 갱신은 낮게 형성되는 경향)'
                : ' — 표본이 적어 신뢰도가 낮습니다')}
          </li>
        )}
        {ratio !== undefined && (
          <li>
            전세가율(전세 중앙값 ÷ 매매 중앙값): {ratio}% — 높을수록 보증금이 매매가에 가깝습니다. 입력
            보증금이 아니라 주변 거래 기준입니다.
          </li>
        )}
        {diff !== undefined && (
          <li>
            입력한 보증금 {formatWon(depositWon ?? 0)}은 주변 전세 중앙값보다 {Math.abs(diff)}%{' '}
            {diff > 0 ? '높습니다' : diff < 0 ? '낮습니다' : '같습니다'}.
          </li>
        )}
        {monthly && (
          <li>
            월세 거래 {monthly.sampleCount}건: 보증금 중앙값 {formatWon(monthly.medianDepositWon)}, 월세
            중앙값 {formatWon(monthly.medianRentWon)} (보증금과 월세는 각각 따로 계산한 값)
          </li>
        )}
      </ul>
      <p className="hint">
        참고용이며 위험 판정에는 쓰지 않습니다. 전월세 신고에는 취소 표시가 없어 취소된 거래는 거를 수
        없습니다.
      </p>
    </div>
  );
}
