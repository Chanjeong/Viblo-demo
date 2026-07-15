import React from 'react';

export const StrokedText: React.FC<{
  text: string;
  fontFamily: string;
  fontSizePx: number;
  color: string;
  strokeWidthPx: number;
  strokeColor: string;
  bold?: boolean;
  italic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  shadow?: boolean;
}> = ({ text, fontFamily, fontSizePx, color, strokeWidthPx, strokeColor, bold, italic, textAlign = 'left', shadow }) => {
  const base: React.CSSProperties = {
    fontFamily,
    fontSize: fontSizePx,
    fontWeight: bold ? 800 : 700,
    fontStyle: italic ? 'italic' : 'normal',
    lineHeight: 1.25,
    whiteSpace: 'pre-wrap',
    textAlign,
    display: 'block',
  };
  return (
    <span style={{ position: 'relative', display: 'block' }}>
      <span
        aria-hidden
        style={{
          ...base,
          position: 'absolute',
          inset: 0,
          color: strokeColor,
          WebkitTextStroke: `${strokeWidthPx * 2}px ${strokeColor}`,
          textShadow: shadow ? '5px 7px 2px rgba(0,0,0,0.75)' : undefined,
        }}
      >
        {text}
      </span>
      <span style={{ ...base, position: 'relative', color }}>{text}</span>
    </span>
  );
};
