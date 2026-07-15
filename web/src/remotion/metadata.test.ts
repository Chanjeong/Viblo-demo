import { describe, it, expect } from 'vitest';
import { calculateRankingMetadata } from '@/remotion/Root';
import { fixturePreviewProject } from '@/remotion/preview-fixture';

describe('calculateRankingMetadata', () => {
  it('duration = sum of trimmed clip durations', async () => {
    const project = fixturePreviewProject(); // 3 clips: 4s + 5s + 3s = 12s
    const meta = await calculateRankingMetadata({ props: { project } } as never);
    expect(meta).toMatchObject({ durationInFrames: 360, fps: 30 });
  });
  it('empty project still returns >=1 frame', async () => {
    const project = { ...fixturePreviewProject(), clips: [] };
    const meta = await calculateRankingMetadata({ props: { project } } as never);
    expect((meta as { durationInFrames: number }).durationInFrames).toBeGreaterThanOrEqual(1);
  });
});
