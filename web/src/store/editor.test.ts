import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '@/store/editor';

const S = () => useEditorStore.getState();

beforeEach(() => S().resetEditor());

describe('clip management', () => {
  it('addClip appends, removeClip deletes and prunes customOrder', () => {
    S().addClip();
    expect(S().project.clips.length).toBe(2);
    const [a, b] = S().project.clips;
    S().setCustomOrderEnabled(true);
    expect(S().project.customOrder).toEqual([a.id, b.id]);
    S().removeClip(a.id);
    expect(S().project.clips.map((c) => c.id)).toEqual([b.id]);
    expect(S().project.customOrder).toEqual([b.id]);
  });
  it('moveClip swaps rank order and clamps at edges', () => {
    S().addClip();
    const [a, b] = S().project.clips;
    S().moveClip(b.id, -1);
    expect(S().project.clips.map((c) => c.id)).toEqual([b.id, a.id]);
    S().moveClip(b.id, -1); // 맨 위에서 위로 → 변화 없음
    expect(S().project.clips[0].id).toBe(b.id);
  });
});

describe('media attach & trim', () => {
  it('attachMedia sets source/duration and full-range trim', () => {
    const clip = S().project.clips[0];
    S().attachMedia(clip.id, { mediaId: crypto.randomUUID(), durationSec: 30, via: 'url' });
    const c = S().project.clips[0];
    expect(c.durationSec).toBe(30);
    expect(c.trim).toEqual({ startSec: 0, endSec: 30 });
  });
  it('setTrim clamps into [0, duration] and start<end', () => {
    const clip = S().project.clips[0];
    S().attachMedia(clip.id, { mediaId: crypto.randomUUID(), durationSec: 10, via: 'upload' });
    S().setTrim(clip.id, { startSec: -5, endSec: 99 });
    expect(S().project.clips[0].trim).toEqual({ startSec: 0, endSec: 10 });
  });
});

describe('custom order', () => {
  it('disable resets to null', () => {
    S().setCustomOrderEnabled(true);
    S().setCustomOrderEnabled(false);
    expect(S().project.customOrder).toBeNull();
  });
});

describe('title & label', () => {
  it('patches title and label partially', () => {
    S().setTitle({ text: 'Hello\nWorld', color: '#FF0000' });
    expect(S().project.title.text).toBe('Hello\nWorld');
    const id = S().project.clips[0].id;
    S().setLabel(id, { text: 'Laugh' });
    expect(S().project.clips[0].label.text).toBe('Laugh');
  });
});
