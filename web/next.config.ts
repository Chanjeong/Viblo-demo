import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Remotion 렌더러/번들러는 네이티브 바이너리를 포함하므로 Next 번들링에서 제외
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', 'esbuild'],
};

export default nextConfig;
