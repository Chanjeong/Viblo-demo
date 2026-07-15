import { getJob } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);
  if (!job) return Response.json({ error: 'job not found' }, { status: 404 });
  return Response.json({ status: job.status, progress: job.progress, error: job.error });
}
