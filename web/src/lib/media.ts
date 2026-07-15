import { execa } from 'execa';
import { mkdir, writeFile, unlink, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { MAX_UPLOAD_BYTES } from '@/lib/project';

/** Client-safe error: message may be shown to the caller as-is. */
export class MediaError extends Error {}

export const MEDIA_DIR = path.join(process.cwd(), 'storage', 'media');
export const RENDERS_DIR = path.join(process.cwd(), 'storage', 'renders');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string): boolean => UUID.test(s);

export const mediaPath = (id: string): string => path.join(MEDIA_DIR, `${id}.mp4`);
export const rendersPath = (name: string): string => path.join(RENDERS_DIR, name);

export async function ensureDirs(): Promise<void> {
  await mkdir(MEDIA_DIR, { recursive: true });
  await mkdir(RENDERS_DIR, { recursive: true });
}

const BUNDLED_FFPROBE = path.join(
  process.cwd(), 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffprobe.exe',
);
const FFPROBE = () =>
  process.env.FFPROBE_PATH || (existsSync(BUNDLED_FFPROBE) ? BUNDLED_FFPROBE : 'ffprobe');

const BUNDLED_FFMPEG = path.join(
  process.cwd(), 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe',
);
const FFMPEG = () =>
  process.env.FFMPEG_PATH || (existsSync(BUNDLED_FFMPEG) ? BUNDLED_FFMPEG : 'ffmpeg');

/** v:0 스트림의 코덱명 반환(없으면 null). */
export async function probeVideoCodec(filePath: string): Promise<string | null> {
  const { stdout } = await execa(
    FFPROBE(),
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'json', filePath],
    { timeout: 30_000 },
  );
  return JSON.parse(stdout)?.streams?.[0]?.codec_name ?? null;
}

/**
 * 브라우저(<video>)가 못 여는 코덱(HEVC/H.265 등)이면 H.264로 재인코딩(제자리 교체).
 * 미리보기는 @remotion/player의 브라우저 디코딩에 의존하므로 h264가 아니면 화면이 까맣게 나온다.
 * 이미 h264면 아무 것도 하지 않는다(재인코딩 비용 회피).
 */
export async function ensureBrowserPlayableH264(filePath: string): Promise<void> {
  const codec = await probeVideoCodec(filePath);
  if (codec === 'h264') return;

  const tmp = `${filePath}.h264.mp4`;
  await execa(
    FFMPEG(),
    [
      '-y', '-i', filePath,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-c:a', 'aac', '-movflags', '+faststart',
      tmp,
    ],
    { timeout: 600_000 },
  );
  await unlink(filePath);
  await rename(tmp, filePath);
}

export async function probeDurationSec(filePath: string): Promise<number> {
  const { stdout } = await execa(
    FFPROBE(),
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', filePath],
    { timeout: 30_000 },
  );
  const duration = Number(JSON.parse(stdout)?.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    console.error(`영상 길이를 읽을 수 없습니다: ${filePath}`);
    throw new Error('영상 길이를 읽을 수 없습니다.');
  }
  return duration;
}

/** 렌더 시작 전 각 클립의 미디어 파일 존재 확인. 문제 목록(비면 통과) 반환 */
export function missingMediaProblems(clips: { rank: number; mediaId: string }[]): string[] {
  return clips
    .filter((c) => !existsSync(mediaPath(c.mediaId)))
    .map((c) => `${c.rank}번 클립: 미디어 파일이 없습니다. 다시 가져오거나 업로드해 주세요.`);
}

export async function saveUploadedFile(file: File): Promise<{ mediaId: string; durationSec: number }> {
  if (file.size > MAX_UPLOAD_BYTES) throw new MediaError('파일이 500MB를 초과합니다.');
  const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
  if (!isMp4) throw new MediaError('MP4 파일만 업로드할 수 있습니다.');

  await ensureDirs();
  const mediaId = crypto.randomUUID();
  const dest = mediaPath(mediaId);
  await writeFile(dest, Buffer.from(await file.arrayBuffer()));
  let durationSec: number;
  try {
    durationSec = await probeDurationSec(dest); // 손상 파일이면 여기서 throw
    await ensureBrowserPlayableH264(dest); // 업로드본이 HEVC여도 미리보기가 되도록 보정
  } catch (e) {
    await unlink(dest).catch(() => {});
    console.error(e);
    throw new MediaError('올바른 MP4 영상이 아니거나 손상된 파일입니다.');
  }
  return { mediaId, durationSec };
}
