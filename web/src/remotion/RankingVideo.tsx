import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import type { RenderProject } from '@/lib/project';
import { computeTimeline, videoBox } from '@/lib/timeline';
import { ClipLayer } from '@/remotion/ClipLayer';
import { NumberColumn } from '@/remotion/NumberColumn';
import { TitleBand } from '@/remotion/TitleBand';

export const RankingVideo: React.FC<{ project: RenderProject }> = ({ project }) => {
  const { fps } = useVideoConfig();
  const { timings } = computeTimeline(project.clips, fps);
  const { top, height } = videoBox(project.general.videoHeightPct);

  return (
    <AbsoluteFill style={{ backgroundColor: project.general.backgroundColor }}>
      {project.clips.map((clip, i) => (
        <Sequence
          key={clip.id}
          from={timings[i].from}
          durationInFrames={timings[i].durationInFrames}
          premountFor={60}
        >
          <ClipLayer clip={clip} top={top} height={height} />
        </Sequence>
      ))}
      <TitleBand title={project.title} bandHeight={top} />
      <NumberColumn project={project} />
    </AbsoluteFill>
  );
};
