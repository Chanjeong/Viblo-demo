import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Remotion 렌더러/번들러는 네이티브 바이너리를 포함하므로 Next 번들링에서 제외
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', 'esbuild'],
  // localhost 대신 127.0.0.1로 접속해도 dev 리소스(HMR 등)가 차단되지 않도록 허용
  // ([::1]:3000을 점유한 다른 프로세스 때문에 이 프로젝트는 127.0.0.1을 사용)
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
