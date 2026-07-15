import { defaultLabel, defaultTitle, type RenderProject } from '@/lib/project';

export function fixturePreviewProject(): RenderProject {
  const label = (text: string) => ({ ...defaultLabel(), text });
  return {
    title: { ...defaultTitle(), text: 'Ranking The Funniest\nBaby Reactions' },
    general: { videoHeightPct: 80, backgroundColor: '#2B2A2A' },
    ranksTotal: 3,
    clips: [
      { id: 'fx-2', rank: 2, src: { kind: 'static', path: 'fixtures/clip-b.mp4' }, trimStartSec: 0, trimEndSec: 4, volume: 1, label: label('Laugh') },
      { id: 'fx-3', rank: 3, src: { kind: 'static', path: 'fixtures/clip-c.mp4' }, trimStartSec: 0, trimEndSec: 5, volume: 1, label: label('Flower') },
      { id: 'fx-1', rank: 1, src: { kind: 'static', path: 'fixtures/clip-a.mp4' }, trimStartSec: 1, trimEndSec: 4, volume: 1, label: label('Medicine') },
    ],
  };
}
