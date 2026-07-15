'use client';

import { create } from 'zustand';
import {
  defaultProject, newClip,
  type LabelStyle, type Project, type TitleStyle,
} from '@/lib/project';

export interface IngestUiState { state: 'idle' | 'loading' | 'error'; message?: string }

interface EditorState {
  project: Project;
  ingest: Record<string, IngestUiState>;
  setTitle: (patch: Partial<TitleStyle>) => void;
  setGeneral: (patch: Partial<Project['general']>) => void;
  addClip: () => void;
  removeClip: (id: string) => void;
  moveClip: (id: string, dir: -1 | 1) => void;
  setClipUrl: (id: string, url: string) => void;
  attachMedia: (id: string, info: { mediaId: string; durationSec: number; via: 'url' | 'upload' }) => void;
  setTrim: (id: string, trim: { startSec: number; endSec: number }) => void;
  setVolume: (id: string, v: number) => void;
  setLabel: (id: string, patch: Partial<LabelStyle>) => void;
  setCustomOrderEnabled: (on: boolean) => void;
  setCustomOrder: (ids: string[]) => void;
  setIngestState: (id: string, s: IngestUiState) => void;
  resetEditor: () => void;
}

function updateClip(project: Project, id: string, fn: (c: Project['clips'][number]) => void): Project {
  return {
    ...project,
    clips: project.clips.map((c) => {
      if (c.id !== id) return c;
      const copy = structuredClone(c);
      fn(copy);
      return copy;
    }),
  };
}

export const useEditorStore = create<EditorState>((set) => ({
  project: defaultProject(),
  ingest: {},

  setTitle: (patch) => set((s) => ({ project: { ...s.project, title: { ...s.project.title, ...patch } } })),
  setGeneral: (patch) => set((s) => ({ project: { ...s.project, general: { ...s.project.general, ...patch } } })),

  addClip: () => set((s) => {
    const clip = newClip();
    const customOrder = s.project.customOrder ? [...s.project.customOrder, clip.id] : null;
    return { project: { ...s.project, clips: [...s.project.clips, clip], customOrder } };
  }),

  removeClip: (id) => set((s) => ({
    project: {
      ...s.project,
      clips: s.project.clips.filter((c) => c.id !== id),
      customOrder: s.project.customOrder?.filter((x) => x !== id) ?? null,
    },
  })),

  moveClip: (id, dir) => set((s) => {
    const i = s.project.clips.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= s.project.clips.length) return s;
    const clips = [...s.project.clips];
    [clips[i], clips[j]] = [clips[j], clips[i]];
    return { project: { ...s.project, clips } };
  }),

  setClipUrl: (id, url) => set((s) => ({
    project: updateClip(s.project, id, (c) => { c.source = { type: 'url', url, mediaId: null }; }),
  })),

  attachMedia: (id, { mediaId, durationSec, via }) => set((s) => ({
    project: updateClip(s.project, id, (c) => {
      c.source = via === 'upload'
        ? { type: 'upload', mediaId }
        : { type: 'url', url: c.source?.type === 'url' ? c.source.url : '', mediaId };
      c.durationSec = durationSec;
      c.trim = { startSec: 0, endSec: durationSec };
    }),
  })),

  setTrim: (id, trim) => set((s) => ({
    project: updateClip(s.project, id, (c) => {
      const dur = c.durationSec ?? trim.endSec;
      const startSec = Math.max(0, Math.min(trim.startSec, dur));
      const endSec = Math.max(startSec, Math.min(trim.endSec, dur));
      c.trim = { startSec, endSec };
    }),
  })),

  setVolume: (id, v) => set((s) => ({
    project: updateClip(s.project, id, (c) => { c.volume = Math.max(0, Math.min(1, v)); }),
  })),

  setLabel: (id, patch) => set((s) => ({
    project: updateClip(s.project, id, (c) => { c.label = { ...c.label, ...patch }; }),
  })),

  setCustomOrderEnabled: (on) => set((s) => ({
    project: { ...s.project, customOrder: on ? s.project.clips.map((c) => c.id) : null },
  })),

  setCustomOrder: (ids) => set((s) => ({ project: { ...s.project, customOrder: ids } })),

  setIngestState: (id, st) => set((s) => ({ ingest: { ...s.ingest, [id]: st } })),

  resetEditor: () => set({ project: defaultProject(), ingest: {} }),
}));
