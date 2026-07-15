import { execa } from 'execa';
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { MEDIA_DIR, ensureDirs, ensureBrowserPlayableH264, mediaPath, probeDurationSec } from '@/lib/media';

export type IngestErrorType =
  | 'private' | 'unavailable' | 'geo_blocked' | 'rate_limited'
  | 'unsupported_url' | 'not_found' | 'network' | 'timeout' | 'unknown';

export const INGEST_MESSAGES_KO: Record<IngestErrorType, string> = {
  private: '비공개 영상이라 가져올 수 없습니다.',
  unavailable: '삭제되었거나 볼 수 없는 영상입니다.',
  geo_blocked: '지역 제한으로 가져올 수 없는 영상입니다.',
  rate_limited: '요청이 너무 많아 잠시 차단되었습니다. 잠시 후 다시 시도해 주세요.',
  unsupported_url: '지원하지 않는 URL입니다. TikTok/Instagram/YouTube 링크를 사용해 주세요.',
  not_found: '영상을 찾을 수 없습니다. URL을 확인해 주세요.',
  network: '네트워크 오류로 다운로드에 실패했습니다.',
  timeout: '다운로드 시간이 초과되었습니다.',
  unknown: '알 수 없는 오류로 다운로드에 실패했습니다.',
};

export function classifyYtDlpError(message: string): IngestErrorType {
  const m = message.toLowerCase();
  if (/private video|login required|log in/.test(m)) return 'private';
  if (/unavailable|has been removed|isn'?t available|deleted/.test(m)) return 'unavailable';
  if (/available in your country|geo.?(restrict|block)/.test(m)) return 'geo_blocked';
  if (/429|rate.?limit|too many requests/.test(m)) return 'rate_limited';
  if (/unsupported url/.test(m)) return 'unsupported_url';
  if (/404|not found(?!\S)/.test(m)) return 'not_found';
  if (/timed? ?out/.test(m)) return 'timeout';
  if (/network|getaddrinfo|enotfound|econnreset|etimedout|eai_again|unable to download/.test(m)) return 'network';
  return 'unknown';
}

export class IngestError extends Error {
  constructor(public type: IngestErrorType, message?: string) {
    super(message ?? INGEST_MESSAGES_KO[type]);
  }
}

const ALLOWED_DOMAINS = ['tiktok.com', 'instagram.com', 'youtube.com'];
export function isAllowedVideoUrl(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const h = u.hostname.toLowerCase();
  if (h === 'youtu.be') return true;
  return ALLOWED_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
}

const YTDLP = () => process.env.YT_DLP_PATH || 'yt-dlp';
const DOWNLOAD_TIMEOUT_MS = 180_000;
const RETRYABLE: IngestErrorType[] = ['network', 'timeout', 'rate_limited'];

/** 완료된 산출물 우선 선택: 정확한 <id>.mp4 > 부분파일 아닌 <id>.* > null */
export function pickDownloadedFile(files: string[], mediaId: string): string | null {
  const mine = files.filter((f) => f.startsWith(mediaId));
  const isPartial = (f: string) => /\.(part|ytdl|temp)$/i.test(f) || /\.f\d+\./.test(f);
  const exact = mine.find((f) => f === `${mediaId}.mp4`);
  if (exact) return exact;
  const complete = mine.filter((f) => !isPartial(f));
  return complete[0] ?? null;
}

async function findDownloaded(mediaId: string): Promise<string> {
  const picked = pickDownloadedFile(await readdir(MEDIA_DIR), mediaId);
  if (!picked) throw new IngestError('unknown', '다운로드된 파일을 찾을 수 없습니다.');
  return path.join(MEDIA_DIR, picked);
}

async function remuxToMp4(src: string, dest: string): Promise<void> {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  try {
    await execa(ffmpeg, ['-y', '-i', src, '-c', 'copy', dest], { timeout: 120_000 });
  } catch {
    // 스트림 복사가 안 되는 컨테이너면 재인코딩(느리지만 확실)
    await execa(ffmpeg, ['-y', '-i', src, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', dest], { timeout: 600_000 });
  }
  await unlink(src);
}

async function attemptDownload(url: string, mediaId: string): Promise<void> {
  const outTemplate = path.join(MEDIA_DIR, `${mediaId}.%(ext)s`);
  const extraArgs: string[] = [];
  // 배포 환경(winget 설치본)에서는 yt-dlp가 PATH의 ffmpeg를 못 찾아 스트림 병합이 실패하므로
  // FFMPEG_PATH가 설정돼 있으면 해당 디렉터리를 명시적으로 알려준다. (브리프 대비 편차)
  if (process.env.FFMPEG_PATH) {
    extraArgs.push('--ffmpeg-location', path.dirname(process.env.FFMPEG_PATH));
  }
  try {
    await execa(YTDLP(), [
      // 브라우저 미리보기(<video>)는 H.264만 확실히 디코딩하므로 avc/h264를 최우선 선택.
      // (틱톡은 종종 h264와 h265를 함께 제공하는데 기본 정렬이 h265를 고르기도 함)
      // avc/h264가 없으면 아무 거나 받고, 그건 뒤에서 ensureBrowserPlayableH264가 변환한다.
      '-f', "bv*[vcodec~='^(avc|h264)']+ba/b[vcodec~='^(avc|h264)']/bv*+ba/b",
      '--merge-output-format', 'mp4',
      '--no-playlist', '--no-progress',
      ...extraArgs,
      '-o', outTemplate,
      url,
    ], { timeout: DOWNLOAD_TIMEOUT_MS });
  } catch (e) {
    const raw = e instanceof Error ? `${e.message}\n${(e as { stderr?: string }).stderr ?? ''}` : String(e);
    throw new IngestError(classifyYtDlpError(raw), undefined);
  }
  const produced = await findDownloaded(mediaId);
  if (!produced.endsWith('.mp4')) {
    await remuxToMp4(produced, mediaPath(mediaId));
  }
}

export async function downloadFromUrl(url: string): Promise<{ mediaId: string; durationSec: number }> {
  if (!isAllowedVideoUrl(url)) throw new IngestError('unsupported_url');
  await ensureDirs();
  const mediaId = crypto.randomUUID();

  try {
    await attemptDownload(url, mediaId);
  } catch (e) {
    const type = e instanceof IngestError ? e.type : 'unknown';
    if (!RETRYABLE.includes(type)) throw e;
    await new Promise((r) => setTimeout(r, type === 'rate_limited' ? 5_000 : 1_500));
    await attemptDownload(url, mediaId); // 재시도 1회, 또 실패하면 그대로 throw
  }

  // 선택자가 H.264를 못 구해 HEVC를 받았다면 여기서 브라우저용 H.264로 변환한다.
  await ensureBrowserPlayableH264(mediaPath(mediaId));
  const durationSec = await probeDurationSec(mediaPath(mediaId));
  return { mediaId, durationSec };
}
