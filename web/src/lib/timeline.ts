import { HEIGHT, type RenderProject } from '@/lib/project';

export const LABEL_FADE_FRAMES = 10;

export interface ClipTiming { from: number; durationInFrames: number }

export function computeTimeline(
  clips: { trimStartSec: number; trimEndSec: number }[],
  fps: number,
): { timings: ClipTiming[]; totalFrames: number } {
  const timings: ClipTiming[] = [];
  let cursor = 0;
  for (const c of clips) {
    const durationInFrames = Math.max(1, Math.round((c.trimEndSec - c.trimStartSec) * fps));
    timings.push({ from: cursor, durationInFrames });
    cursor += durationInFrames;
  }
  return { timings, totalFrames: cursor };
}

export function revealFramesByRank(project: RenderProject, fps: number): Map<number, number> {
  const { timings } = computeTimeline(project.clips, fps);
  const m = new Map<number, number>();
  project.clips.forEach((c, i) => m.set(c.rank, timings[i].from));
  return m;
}

const PALETTE: Record<number, string> = { 1: '#E8252A', 2: '#F7941D', 3: '#FFD200' };
export function rankColor(rank: number): string {
  return PALETTE[rank] ?? '#FFFFFF';
}

// ── 레이아웃 (참고 영상 실측 기반, 1080×1920 기준) ─────────────────
export const LAYOUT = {
  numberX: 55,          // 숫자 왼쪽 x
  labelX: 205,          // 라벨 왼쪽 x
  numberFontPx: 110,
  numberStrokePx: 8,
  titlePadX: 40,
  rowFirstRatio: 0.115, // 첫 줄: videoTop + videoH * 0.115
  rowStepRatio: 0.12,   // 기본 줄 간격 비율
  rowMaxSpanRatio: 0.77, // 줄들이 차지할 수 있는 최대 세로 비율
};

export function videoBox(videoHeightPct: number): { top: number; height: number } {
  const height = Math.round((HEIGHT * videoHeightPct) / 100);
  return { top: Math.round((HEIGHT - height) / 2), height };
}

export function numberRowCenterY(
  index: number, count: number, videoTop: number, videoHeight: number,
): number {
  const step = count <= 1
    ? 0
    : Math.min(LAYOUT.rowStepRatio, LAYOUT.rowMaxSpanRatio / (count - 1));
  return Math.round(videoTop + videoHeight * (LAYOUT.rowFirstRatio + step * index));
}
