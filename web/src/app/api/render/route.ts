import { NextRequest } from 'next/server';
import { ProjectSchema, buildRenderProject, type ResolvedSrc } from '@/lib/project';
import { createJob, updateJob } from '@/lib/jobs';
import { ensureDirs, missingMediaProblems, rendersPath } from '@/lib/media';
import { getServeUrl, renderProjectToFile } from '@/lib/renderer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function origin(): string {
  return process.env.APP_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3000}`;
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try { raw = await req.json(); } catch { raw = null; }
  const parsed = ProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ problems: ['프로젝트 데이터가 올바르지 않습니다.'] }, { status: 400 });
  }

  const resolveSrc = (mediaId: string): ResolvedSrc =>
    ({ kind: 'url', url: `${origin()}/api/media/${mediaId}` });
  const built = buildRenderProject(parsed.data, resolveSrc);
  if (!built.ok) return Response.json({ problems: built.problems }, { status: 400 });

  const fileProblems = missingMediaProblems(
    parsed.data.clips.map((c, i) => ({ rank: i + 1, mediaId: c.source?.mediaId ?? '' })),
  );
  if (fileProblems.length > 0) return Response.json({ problems: fileProblems }, { status: 400 });

  await ensureDirs();
  const job = createJob();
  const outputPath = rendersPath(`${job.id}.mp4`);

  // 백그라운드 실행 — 응답을 붙잡지 않는다
  void (async () => {
    try {
      updateJob(job.id, { status: 'bundling' });
      await getServeUrl();
      updateJob(job.id, { status: 'rendering' });
      await renderProjectToFile(built.value, outputPath, (p) => updateJob(job.id, { progress: p }));
      updateJob(job.id, { status: 'done', progress: 1, outputPath });
    } catch (e) {
      updateJob(job.id, { status: 'error', error: e instanceof Error ? e.message : '렌더링 실패' });
    }
  })();

  return Response.json({ jobId: job.id });
}
