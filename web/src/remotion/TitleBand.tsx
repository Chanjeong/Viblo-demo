import React from 'react';
import type { TitleStyle } from '@/lib/project';
import { LAYOUT } from '@/lib/timeline';
import { FONT_FAMILIES } from '@/remotion/fonts';
import { StrokedText } from '@/remotion/StrokedText';

export const TitleBand: React.FC<{ title: TitleStyle; bandHeight: number }> = ({ title, bandHeight }) => {
  const justify = { left: 'flex-start', center: 'center', right: 'flex-end' }[title.align];
  return (
    <div
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: bandHeight,
        display: 'flex', alignItems: 'center', justifyContent: justify,
        padding: `0 ${LAYOUT.titlePadX}px`,
      }}
    >
      <StrokedText
        text={title.text}
        fontFamily={FONT_FAMILIES[title.fontFamily]}
        fontSizePx={title.fontSizePx}
        color={title.color}
        strokeWidthPx={title.strokeWidthPx}
        strokeColor={title.strokeColor}
        bold={title.bold}
        italic={title.italic}
        textAlign={title.align}
      />
    </div>
  );
};
