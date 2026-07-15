import React from 'react';
import { OffthreadVideo, staticFile, useVideoConfig } from 'remotion';
import type { RenderClip } from '@/lib/project';

export const ClipLayer: React.FC<{ clip: RenderClip; top: number; height: number }> = ({ clip, top, height }) => {
  const { fps } = useVideoConfig();
  const src = clip.src.kind === 'static' ? staticFile(clip.src.path) : clip.src.url;
  return (
    <div style={{ position: 'absolute', top, left: 0, width: '100%', height, overflow: 'hidden' }}>
      <OffthreadVideo
        src={src}
        trimBefore={Math.round(clip.trimStartSec * fps)}
        trimAfter={Math.round(clip.trimEndSec * fps)}
        volume={Math.max(0, Math.min(1, clip.volume))}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
};
