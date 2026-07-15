export type JobStatus = 'queued' | 'bundling' | 'rendering' | 'done' | 'error';

export interface RenderJob {
  id: string;
  status: JobStatus;
  progress: number; // 0..1
  outputPath: string | null;
  error: string | null;
  createdAt: number;
}

// dev 핫리로드/모듈 재평가에도 잡 유지
const g = globalThis as unknown as { __vibloJobs?: Map<string, RenderJob> };
const jobs = (g.__vibloJobs ??= new Map<string, RenderJob>());

export function createJob(): RenderJob {
  const job: RenderJob = {
    id: crypto.randomUUID(), status: 'queued', progress: 0,
    outputPath: null, error: null, createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<RenderJob>): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, patch);
}
