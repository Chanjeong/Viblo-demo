import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { getJob } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);
  if (!job || job.status !== 'done' || !job.outputPath || !existsSync(job.outputPath)) {
    return Response.json({ error: '완료된 렌더가 없습니다.' }, { status: 404 });
  }
  const { size } = statSync(job.outputPath);
  const stream = Readable.toWeb(createReadStream(job.outputPath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(size),
      'Content-Disposition': 'attachment; filename="video-ranking.mp4"',
    },
  });
}
