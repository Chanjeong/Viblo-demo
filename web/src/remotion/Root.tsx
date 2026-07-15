import React from 'react';
import { Composition, type CalculateMetadataFunction } from 'remotion';
import { FPS, HEIGHT, WIDTH, type RenderProject } from '@/lib/project';
import { computeTimeline } from '@/lib/timeline';
import { fixturePreviewProject } from '@/remotion/preview-fixture';
import { RankingVideo } from '@/remotion/RankingVideo';

export const calculateRankingMetadata: CalculateMetadataFunction<{ project: RenderProject }> =
  ({ props }) => {
    const { totalFrames } = computeTimeline(props.project.clips, FPS);
    return { durationInFrames: Math.max(1, totalFrames), fps: FPS };
  };

export const RemotionRoot: React.FC = () => (
  <Composition
    id="RankingVideo"
    component={RankingVideo}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={1}
    defaultProps={{ project: fixturePreviewProject() }}
    calculateMetadata={calculateRankingMetadata}
  />
);
