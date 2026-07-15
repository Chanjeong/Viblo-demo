import { execa } from 'execa';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
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
  } catch (e) {
    await unlink(dest).catch(() => {});
    console.error(e);
    throw new MediaError('올바른 MP4 영상이 아니거나 손상된 파일입니다.');
  }
  return { mediaId, durationSec };
}
