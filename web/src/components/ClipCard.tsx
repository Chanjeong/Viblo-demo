'use client';

import { useRef, useState } from 'react';
import type { IngestUiState } from '@/store/editor';
import { useEditorStore } from '@/store/editor';
import { ColorPopover } from '@/components/ColorPopover';
import { TrimSlider } from '@/components/TrimSlider';
import { clampNum } from '@/lib/num';

const IDLE_INGEST: IngestUiState = { state: 'idle' };

export function ClipCard({ clipId, index, count }: { clipId: string; index: number; count: number }) {
  const clip = useEditorStore((s) => s.project.clips.find((c) => c.id === clipId));
  const ingest = useEditorStore((s) => s.ingest[clipId] ?? IDLE_INGEST);
  const removeClip = useEditorStore((s) => s.removeClip);
  const moveClip = useEditorStore((s) => s.moveClip);
  const attachMedia = useEditorStore((s) => s.attachMedia);
  const setTrim = useEditorStore((s) => s.setTrim);
  const setVolume = useEditorStore((s) => s.setVolume);
  const setLabel = useEditorStore((s) => s.setLabel);
  const setIngestState = useEditorStore((s) => s.setIngestState);
  const setClipUrl = useEditorStore((s) => s.setClipUrl);
  const [url, setUrl] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  if (!clip) return null;
  const mediaId = clip.source?.mediaId ?? null;
  const ready = mediaId != null && clip.trim != null;

  /** 트림 핸들을 움직이면 그 지점 프레임을 미리보기 영상에 보여준다. */
  function seekPreview(v: { startSec: number; endSec: number }, edge: 'start' | 'end') {
    setTrim(clipId, v);
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.currentTime = edge === 'end' ? v.endSec : v.startSec;
    }
  }

  async function ingestUrl() {
    if (!url.trim()) return;
    setClipUrl(clipId, url.trim());
    setIngestState(clipId, { state: 'loading' });
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data == null) {
        throw new Error(data?.message ?? '요청 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
      attachMedia(clipId, { mediaId: data.mediaId, durationSec: data.durationSec, via: 'url' });
      setIngestState(clipId, { state: 'idle' });
    } catch (e) {
      setIngestState(clipId, {
        state: 'error',
        message: `${e instanceof Error ? e.message : '가져오기 실패'} — 아래에서 MP4를 직접 업로드할 수도 있어요.`,
      });
    }
  }

  async function uploadFile(file: File) {
    setIngestState(clipId, { state: 'loading' });
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || data == null) {
        throw new Error(data?.error ?? '요청 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
      attachMedia(clipId, { mediaId: data.mediaId, durationSec: data.durationSec, via: 'upload' });
      setIngestState(clipId, { state: 'idle' });
    } catch (e) {
      setIngestState(clipId, { state: 'error', message: e instanceof Error ? e.message : '업로드 실패' });
    }
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Video Rank {index + 1}</h3>
        <div className="flex gap-1">
          <button type="button" aria-label="위로" disabled={index === 0}
            className="rounded border px-2 disabled:opacity-30" onClick={() => moveClip(clipId, -1)}>↑</button>
          <button type="button" aria-label="아래로" disabled={index === count - 1}
            className="rounded border px-2 disabled:opacity-30" onClick={() => moveClip(clipId, 1)}>↓</button>
          <button type="button" aria-label="삭제" disabled={count === 1}
            className="rounded border px-2 text-red-500 disabled:opacity-30" onClick={() => removeClip(clipId)}>🗑</button>
        </div>
      </div>

      {!ready && (
        <>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="TikTok, Instagram, or YouTube video link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ingestUrl()}
              disabled={ingest.state === 'loading'}
            />
            <button type="button" onClick={ingestUrl} disabled={ingest.state === 'loading'}
              className="rounded bg-blue-500 px-4 py-2 text-white disabled:opacity-50">
              {ingest.state === 'loading' ? '가져오는 중…' : '→'}
            </button>
          </div>
          <div className="my-2 text-center text-xs text-gray-400">OR</div>
          <label className="block cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-sm text-gray-500 hover:bg-gray-50">
            MP4 업로드 (최대 500MB)
            <input type="file" accept="video/mp4" className="hidden" disabled={ingest.state === 'loading'}
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
          </label>
          {ingest.state === 'error' && (
            <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-600">{ingest.message}</p>
          )}
        </>
      )}

      {ready && clip.durationSec != null && clip.trim != null && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-center rounded-lg bg-black">
            <video
              ref={videoRef}
              key={mediaId ?? undefined}
              src={mediaId ? `/api/media/${mediaId}` : undefined}
              controls
              playsInline
              preload="metadata"
              className="max-h-72 rounded-lg"
            />
          </div>
          <TrimSlider durationSec={clip.durationSec} value={clip.trim} onChange={seekPreview} />
          <label className="flex items-center gap-2 text-sm">
            🔊 Volume
            <input type="range" min={0} max={1} step={0.05} value={clip.volume}
              onChange={(e) => setVolume(clipId, Number(e.target.value))} />
            <span className="w-10 text-xs">{Math.round(clip.volume * 100)}%</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Video Title (예: Laugh)"
              value={clip.label.text}
              onChange={(e) => setLabel(clipId, { text: e.target.value })}
            />
            <input type="number" min={20} max={150} className="w-20 rounded border px-2 py-2 text-sm"
              value={clip.label.fontSizePx}
              onChange={(e) => setLabel(clipId, { fontSizePx: clampNum(e.target.value, 20, 150, clip.label.fontSizePx) })} />
            <ColorPopover value={clip.label.color} onChange={(color) => setLabel(clipId, { color })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Stroke
            <ColorPopover value={clip.label.strokeColor} onChange={(strokeColor) => setLabel(clipId, { strokeColor })} />
            <input type="range" min={0} max={20} step={1} value={clip.label.strokeWidthPx}
              onChange={(e) => setLabel(clipId, { strokeWidthPx: Number(e.target.value) })} />
            <span className="w-8 text-xs">{clip.label.strokeWidthPx}px</span>
          </label>
        </div>
      )}
    </section>
  );
}
