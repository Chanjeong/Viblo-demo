import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { RenderProject } from '@/lib/project';
import {
  LABEL_FADE_FRAMES, LAYOUT, numberRowCenterY, rankColor, revealFramesByRank, videoBox,
} from '@/lib/timeline';
import { FONT_FAMILIES } from '@/remotion/fonts';
import { StrokedText } from '@/remotion/StrokedText';

export const NumberColumn: React.FC<{ project: RenderProject }> = ({ project }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { top, height } = videoBox(project.general.videoHeightPct);
  const reveals = revealFramesByRank(project, fps);
  const byRank = [...project.clips].sort((a, b) => a.rank - b.rank);

  return (
    <>
      {byRank.map((clip, i) => {
        const y = numberRowCenterY(i, project.ranksTotal, top, height);
        const revealAt = reveals.get(clip.rank) ?? 0;
        const labelOpacity = interpolate(
          frame, [revealAt, revealAt + LABEL_FADE_FRAMES], [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
        return (
          <React.Fragment key={clip.id}>
            <div style={{ position: 'absolute', left: LAYOUT.numberX, top: y, transform: 'translateY(-50%)' }}>
              <StrokedText
                text={`${clip.rank}.`}
                fontFamily={FONT_FAMILIES['archivo-black']}
                fontSizePx={LAYOUT.numberFontPx}
                color={rankColor(clip.rank)}
                strokeWidthPx={LAYOUT.numberStrokePx}
                strokeColor="#000000"
                shadow
              />
            </div>
            <div
              style={{
                position: 'absolute', left: LAYOUT.labelX, top: y,
                transform: 'translateY(-50%)', opacity: labelOpacity, maxWidth: 700,
              }}
            >
              <StrokedText
                text={clip.label.text}
                fontFamily={FONT_FAMILIES.rubik}
                fontSizePx={clip.label.fontSizePx}
                color={clip.label.color}
                strokeWidthPx={clip.label.strokeWidthPx}
                strokeColor={clip.label.strokeColor}
                bold
              />
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
};
