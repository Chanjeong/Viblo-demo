'use client';

import { MIN_TRIM_SEC } from '@/lib/project';

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

export function TrimSlider({
  durationSec, value, onChange,
}: {
  durationSec: number;
  value: { startSec: number; endSec: number };
  /** edge = 방금 움직인 핸들. 미리보기 영상을 해당 지점으로 이동시키는 데 쓴다. */
  onChange: (v: { startSec: number; endSec: number }, edge: 'start' | 'end') => void;
}) {
  const pct = (s: number) => (s / durationSec) * 100;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span>Start at <b>{fmt(value.startSec)}</b></span>
        <span>End at <b>{fmt(value.endSec)}</b></span>
      </div>
      <div className="trim-slider relative h-8 rounded bg-gray-200">
        <div
          className="absolute inset-y-0 rounded bg-blue-200"
          style={{ left: `${pct(value.startSec)}%`, width: `${pct(value.endSec - value.startSec)}%` }}
        />
        <input
          type="range" min={0} max={durationSec} step={0.1} value={value.startSec}
          onChange={(e) => {
            const startSec = Math.min(Number(e.target.value), value.endSec - MIN_TRIM_SEC);
            onChange({ startSec: Math.max(0, startSec), endSec: value.endSec }, 'start');
          }}
        />
        <input
          type="range" min={0} max={durationSec} step={0.1} value={value.endSec}
          onChange={(e) => {
            const endSec = Math.max(Number(e.target.value), value.startSec + MIN_TRIM_SEC);
            onChange({ startSec: value.startSec, endSec: Math.min(durationSec, endSec) }, 'end');
          }}
        />
      </div>
    </div>
  );
}
