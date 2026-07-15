import { describe, it, expect } from 'vitest';
import { createJob, getJob, updateJob } from '@/lib/jobs';

describe('job registry', () => {
  it('creates queued job with uuid and finds it', () => {
    const job = createJob();
    expect(job.status).toBe('queued');
    expect(job.progress).toBe(0);
    expect(getJob(job.id)?.id).toBe(job.id);
  });
  it('updates status and progress', () => {
    const job = createJob();
    updateJob(job.id, { status: 'rendering', progress: 0.5 });
    expect(getJob(job.id)).toMatchObject({ status: 'rendering', progress: 0.5 });
  });
  it('returns undefined for unknown id', () => {
    expect(getJob('nope')).toBeUndefined();
  });
});
