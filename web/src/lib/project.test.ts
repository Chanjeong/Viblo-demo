import { describe, it, expect } from 'vitest';
import {
  defaultProject, newClip, buildRenderProject, ProjectSchema, MIN_TRIM_SEC,
} from '@/lib/project';

const resolveSrc = (mediaId: string) => ({ kind: 'url' as const, url: `/api/media/${mediaId}` });

function readyClip(rankLabel: string) {
  const c = newClip();
  c.source = { type: 'upload', mediaId: crypto.randomUUID() };
  c.durationSec = 10;
  c.trim = { startSec: 1, endSec: 6 };
  c.label.text = rankLabel;
  return c;
}

describe('defaults', () => {
  it('has spec defaults', () => {
    const p = defaultProject();
    expect(p.general).toEqual({ videoHeightPct: 80, backgroundColor: '#2B2A2A' });
    expect(p.title.fontFamily).toBe('archivo-black');
    expect(p.customOrder).toBeNull();
    expect(p.clips.length).toBe(1); // 빈 카드 1개로 시작
  });
});

describe('ProjectSchema', () => {
  it('accepts a default project', () => {
    expect(ProjectSchema.safeParse(defaultProject()).success).toBe(true);
  });
  it('rejects volume out of range', () => {
    const p = defaultProject();
    p.clips[0].volume = 1.5;
    expect(ProjectSchema.safeParse(p).success).toBe(false);
  });
});

describe('buildRenderProject', () => {
  it('builds in default (rank) order with ranks assigned by card index', () => {
    const p = defaultProject();
    p.clips = [readyClip('A'), readyClip('B')];
    const r = buildRenderProject(p, resolveSrc);
    if (!r.ok) throw new Error(r.problems.join());
    expect(r.value.clips.map((c) => c.rank)).toEqual([1, 2]);
    expect(r.value.clips[0].src).toEqual({ kind: 'url', url: expect.stringContaining('/api/media/') });
  });
  it('applies customOrder as playback order but keeps ranks', () => {
    const p = defaultProject();
    p.clips = [readyClip('A'), readyClip('B')];
    p.customOrder = [p.clips[1].id, p.clips[0].id];
    const r = buildRenderProject(p, resolveSrc);
    if (!r.ok) throw new Error(r.problems.join());
    expect(r.value.clips.map((c) => c.rank)).toEqual([2, 1]);
  });
  it('reports problems per clip: missing media, bad trim, too-short trim', () => {
    const p = defaultProject();
    const bad = readyClip('X');
    bad.trim = { startSec: 5, endSec: 5 + MIN_TRIM_SEC / 2 };
    const noMedia = newClip();
    p.clips = [bad, noMedia];
    const r = buildRenderProject(p, resolveSrc);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problems.length).toBeGreaterThanOrEqual(2);
    expect(r.problems.join()).toMatch(/1번/);
    expect(r.problems.join()).toMatch(/2번/);
  });
  it('rejects customOrder that is not a permutation of clip ids', () => {
    const p = defaultProject();
    p.clips = [readyClip('A')];
    p.customOrder = ['nonexistent'];
    const r = buildRenderProject(p, resolveSrc);
    expect(r.ok).toBe(false);
  });
  it('rejects empty project (no clips)', () => {
    const p = defaultProject();
    p.clips = [];
    expect(buildRenderProject(p, resolveSrc).ok).toBe(false);
  });
  it('rejects customOrder with duplicate ids', () => {
    const p = defaultProject();
    p.clips = [readyClip('A'), readyClip('B')];
    p.customOrder = [p.clips[0].id, p.clips[0].id];
    const r = buildRenderProject(p, resolveSrc);
    expect(r.ok).toBe(false);
  });
});
