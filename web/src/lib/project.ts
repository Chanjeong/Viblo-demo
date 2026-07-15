import { z } from 'zod';

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;
export const MAX_UPLOAD_BYTES = 524_288_000; // 500MB
export const MIN_TRIM_SEC = 0.5;

export type Align = 'left' | 'center' | 'right';
export type FontFamilyId = 'archivo-black' | 'rubik';

export interface TitleStyle {
  text: string; // \n 줄바꿈 허용
  fontFamily: FontFamilyId;
  fontSizePx: number;
  bold: boolean;
  italic: boolean;
  align: Align;
  color: string;
  strokeWidthPx: number;
  strokeColor: string;
}

export interface LabelStyle {
  text: string;
  fontSizePx: number;
  color: string;
  strokeWidthPx: number;
  strokeColor: string;
}

export type ClipSource =
  | { type: 'url'; url: string; mediaId: string | null }
  | { type: 'upload'; mediaId: string };

export interface Clip {
  id: string;
  source: ClipSource | null; // null = 아직 입력 안 됨
  durationSec: number | null; // 프로브 후 확정
  trim: { startSec: number; endSec: number } | null;
  volume: number; // 0..1
  label: LabelStyle;
}

export interface Project {
  title: TitleStyle;
  general: { videoHeightPct: number; backgroundColor: string };
  customOrder: string[] | null; // null = 기본(rank) 순서
  clips: Clip[]; // 배열 인덱스+1 = rank
}

export type ResolvedSrc = { kind: 'url'; url: string } | { kind: 'static'; path: string };
export type ResolveSrc = (mediaId: string) => ResolvedSrc;

export interface RenderClip {
  id: string;
  rank: number;
  src: ResolvedSrc;
  trimStartSec: number;
  trimEndSec: number;
  volume: number;
  label: LabelStyle;
}

export interface RenderProject {
  title: TitleStyle;
  general: { videoHeightPct: number; backgroundColor: string };
  clips: RenderClip[]; // 재생 순서대로
  ranksTotal: number;
}

export function defaultTitle(): TitleStyle {
  return {
    text: '', fontFamily: 'archivo-black', fontSizePx: 76,
    bold: false, italic: false, align: 'center',
    color: '#FFFFFF', strokeWidthPx: 4, strokeColor: '#000000',
  };
}

export function defaultLabel(): LabelStyle {
  return { text: '', fontSizePx: 52, color: '#FFFFFF', strokeWidthPx: 6, strokeColor: '#000000' };
}

export function newClip(): Clip {
  return { id: crypto.randomUUID(), source: null, durationSec: null, trim: null, volume: 1, label: defaultLabel() };
}

export function defaultProject(): Project {
  return {
    title: defaultTitle(),
    general: { videoHeightPct: 80, backgroundColor: '#2B2A2A' },
    customOrder: null,
    clips: [newClip()],
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TitleSchema = z.object({
  text: z.string().max(200),
  fontFamily: z.enum(['archivo-black', 'rubik']),
  fontSizePx: z.number().min(20).max(200),
  bold: z.boolean(), italic: z.boolean(),
  align: z.enum(['left', 'center', 'right']),
  color: z.string().regex(HEX),
  strokeWidthPx: z.number().min(0).max(20),
  strokeColor: z.string().regex(HEX),
});

const LabelSchema = z.object({
  text: z.string().max(80),
  fontSizePx: z.number().min(20).max(150),
  color: z.string().regex(HEX),
  strokeWidthPx: z.number().min(0).max(20),
  strokeColor: z.string().regex(HEX),
});

const SourceSchema = z.union([
  z.object({ type: z.literal('url'), url: z.string().url(), mediaId: z.string().regex(UUID).nullable() }),
  z.object({ type: z.literal('upload'), mediaId: z.string().regex(UUID) }),
]);

const ClipSchema = z.object({
  id: z.string().min(1),
  source: SourceSchema.nullable(),
  durationSec: z.number().positive().nullable(),
  trim: z.object({ startSec: z.number().min(0), endSec: z.number().positive() }).nullable(),
  volume: z.number().min(0).max(1),
  label: LabelSchema,
});

export const ProjectSchema = z.object({
  title: TitleSchema,
  general: z.object({
    videoHeightPct: z.number().min(50).max(100),
    backgroundColor: z.string().regex(HEX),
  }),
  customOrder: z.array(z.string()).nullable(),
  clips: z.array(ClipSchema).max(20),
});

function mediaIdOf(source: ClipSource | null): string | null {
  if (!source) return null;
  return source.mediaId;
}

export function buildRenderProject(
  project: Project,
  resolveSrc: ResolveSrc,
): { ok: true; value: RenderProject } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  if (project.clips.length < 1) problems.push('클립이 1개 이상 필요합니다.');

  project.clips.forEach((clip, i) => {
    const n = i + 1;
    const mediaId = mediaIdOf(clip.source);
    if (!mediaId) {
      problems.push(`${n}번 클립: 영상이 아직 준비되지 않았습니다(URL 가져오기 또는 업로드 필요).`);
      return;
    }
    if (clip.durationSec == null || clip.trim == null) {
      problems.push(`${n}번 클립: 영상 길이 정보가 없습니다. 다시 가져와 주세요.`);
      return;
    }
    const { startSec, endSec } = clip.trim;
    if (!(startSec >= 0 && endSec <= clip.durationSec + 0.05 && startSec < endSec)) {
      problems.push(`${n}번 클립: 트림 구간이 잘못되었습니다 (0 ≤ 시작 < 끝 ≤ ${clip.durationSec.toFixed(1)}s).`);
      return;
    }
    if (endSec - startSec < MIN_TRIM_SEC) {
      problems.push(`${n}번 클립: 트림 구간이 너무 짧습니다 (최소 ${MIN_TRIM_SEC}s).`);
    }
  });

  // 재생 순서 결정
  let ordered = project.clips;
  if (project.customOrder) {
    const byId = new Map(project.clips.map((c) => [c.id, c]));
    const sameSet =
      project.customOrder.length === project.clips.length &&
      new Set(project.customOrder).size === project.clips.length &&
      project.customOrder.every((id) => byId.has(id));
    if (!sameSet) {
      problems.push('재생 순서(customOrder)가 클립 목록과 일치하지 않습니다.');
    } else {
      ordered = project.customOrder.map((id) => byId.get(id)!);
    }
  }

  if (problems.length > 0) return { ok: false, problems };

  const rankByClipId = new Map(project.clips.map((c, i) => [c.id, i + 1]));
  return {
    ok: true,
    value: {
      title: project.title,
      general: project.general,
      ranksTotal: project.clips.length,
      clips: ordered.map((c) => ({
        id: c.id,
        rank: rankByClipId.get(c.id)!,
        src: resolveSrc(mediaIdOf(c.source)!),
        trimStartSec: c.trim!.startSec,
        trimEndSec: c.trim!.endSec,
        volume: c.volume,
        label: c.label,
      })),
    },
  };
}
