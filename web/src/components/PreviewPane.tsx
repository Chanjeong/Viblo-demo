'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { Player as PlayerComponent } from '@remotion/player';
import { useEditorStore } from '@/store/editor';
import { FPS, HEIGHT, WIDTH, buildRenderProject } from '@/lib/project';
import { computeTimeline } from '@/lib/timeline';
import { RankingVideo } from '@/remotion/RankingVideo';

// next/dynamic's return type is React.ComponentType<P>, which can't preserve
// @remotion/player's generic <Schema, Props> signature. Cast back to the
// original generic type so `component`/`inputProps` stay typed together.
const Player = dynamic(() => import('@remotion/player').then((m) => m.Player), {
  ssr: false,
}) as typeof PlayerComponent;

export function PreviewPane() {
  const project = useEditorStore((s) => s.project);

  const built = useMemo(
    () => buildRenderProject(project, (mediaId) => ({ kind: 'url', url: `/api/media/${mediaId}` })),
    [project],
  );

  if (!built.ok) {
    return (
      <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-1 rounded-xl bg-gray-900 p-6 text-center text-xs text-gray-400">
        <p className="mb-2 text-sm text-gray-300">미리보기를 보려면 클립을 준비해 주세요</p>
        {built.problems.map((p) => <p key={p}>{p}</p>)}
      </div>
    );
  }

  const { totalFrames } = computeTimeline(built.value.clips, FPS);
  return (
    <Player
      component={RankingVideo}
      inputProps={{ project: built.value }}
      durationInFrames={Math.max(1, totalFrames)}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      fps={FPS}
      controls
      style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden' }}
    />
  );
}
