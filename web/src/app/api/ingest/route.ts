import { NextRequest } from 'next/server';
import { z } from 'zod';
import { IngestError, downloadFromUrl, INGEST_MESSAGES_KO } from '@/lib/ytdlp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

const Body = z.object({ url: z.string().min(1).max(2000) });

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { body = null; }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return Response.json({ errorType: 'unsupported_url', message: 'URL을 입력해 주세요.' }, { status: 400 });
  }
  try {
    const result = await downloadFromUrl(parsed.data.url.trim());
    return Response.json(result);
  } catch (e) {
    if (e instanceof IngestError) {
      const status = e.type === 'unsupported_url' || e.type === 'not_found' ? 400 : 502;
      return Response.json({ errorType: e.type, message: e.message }, { status });
    }
    return Response.json({ errorType: 'unknown', message: INGEST_MESSAGES_KO.unknown }, { status: 500 });
  }
}
