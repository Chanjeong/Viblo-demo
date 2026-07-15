import { describe, it, expect } from 'vitest';
import {
  computeTimeline, revealFramesByRank, rankColor, videoBox, numberRowCenterY,
} from '@/lib/timeline';
import type { RenderProject } from '@/lib/project';

describe('computeTimeline', () => {
  it('stacks clips back-to-back (hard cut)', () => {
    const r = computeTimeline(
      [{ trimStartSec: 0, trimEndSec: 2 }, { trimStartSec: 1, trimEndSec: 2.5 }],
      30,
    );
    expect(r.timings).toEqual([
      { from: 0, durationInFrames: 60 },
      { from: 60, durationInFrames: 45 },
    ]);
    expect(r.totalFrames).toBe(105);
  });
  it('never returns 0-frame clips', () => {
    const r = computeTimeline([{ trimStartSec: 0, trimEndSec: 0.001 }], 30);
    expect(r.timings[0].durationInFrames).toBe(1);
  });
});

describe('revealFramesByRank', () => {
  it('maps each rank to its playback start frame', () => {
    const p = {
      clips: [
        { rank: 2, trimStartSec: 0, trimEndSec: 1 },
        { rank: 1, trimStartSec: 0, trimEndSec: 1 },
      ],
    } as unknown as RenderProject;
    const m = revealFramesByRank(p, 30);
    expect(m.get(2)).toBe(0);
    expect(m.get(1)).toBe(30);
  });
});

describe('palette & layout', () => {
  it('rank colors per spec', () => {
    expect(rankColor(1)).toBe('#E8252A');
    expect(rankColor(2)).toBe('#F7941D');
    expect(rankColor(3)).toBe('#FFD200');
    expect(rankColor(4)).toBe('#FFFFFF');
    expect(rankColor(9)).toBe('#FFFFFF');
  });
  it('videoBox centers vertically', () => {
    expect(videoBox(80)).toEqual({ top: 192, height: 1536 });
    expect(videoBox(100)).toEqual({ top: 0, height: 1920 });
  });
  it('number rows spread down and stay inside the video box', () => {
    const { top, height } = videoBox(80);
    const y0 = numberRowCenterY(0, 5, top, height);
    const y4 = numberRowCenterY(4, 5, top, height);
    expect(y0).toBeGreaterThan(top);
    expect(y4).toBeLessThan(top + height);
    expect(y4).toBeGreaterThan(y0);
    // 10개여도 박스 안
    expect(numberRowCenterY(9, 10, top, height)).toBeLessThan(top + height);
  });
});
