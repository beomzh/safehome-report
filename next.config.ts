import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Docker 패키징(M6)에서 최소 런타임 번들을 쓰기 위한 설정
  output: 'standalone',
  reactStrictMode: true,
  // 로컬 도구: 외부로 정보를 보내는 헤더/텔레메트리 성격의 기능을 쓰지 않는다
  poweredByHeader: false,
};

export default nextConfig;
