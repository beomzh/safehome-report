import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'SafeHomeReport — 계약 전 위험 신호 점검',
  description: '전세·매매 계약 전에 등기부와 시세 정보로 위험 신호를 로컬에서 점검합니다.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
