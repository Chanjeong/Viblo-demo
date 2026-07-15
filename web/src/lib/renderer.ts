import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { RenderProject } from '@/lib/project';

// dev 핫리로드에도 번들 캐시 유지
const g = globalThis as unknown as { __vibloBundle?: Promise<string> };

export function getServeUrl(): Promise<string> {
  g.__vibloBundle ??= bundle({
    entryPoint: path.join(process.cwd(), 'src', 'remotion', 'index.ts'),
    publicDir: path.join(process.cwd(), 'public'),
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: { ...(config.resolve?.alias ?? {}), '@': path.join(process.cwd(), 'src') },
      },
    }),
  });
  return g.__vibloBundle;
}

export async function renderProjectToFile(
  project: RenderProject,
  outputPath: string,
  onProgress: (p: number) => void,
): Promise<void> {
  const serveUrl = await getServeUrl();
  const inputProps = { project };
  const composition = await selectComposition({ serveUrl, id: 'RankingVideo', inputProps });
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    timeoutInMilliseconds: 120_000, // 느린 소스 대비 delayRender 여유
    onProgress: ({ progress }) => onProgress(progress),
  });
}
