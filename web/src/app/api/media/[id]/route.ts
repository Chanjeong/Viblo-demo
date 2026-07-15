import { createReadStream, statSync, existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { NextRequest } from 'next/server';
import { isUuid, mediaPath } from '@/lib/media';
import { parseRangeHeader } from '@/lib/range';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: 'invalid id' }, { status: 400 });

  const filePath = mediaPath(id);
  if (!existsSync(filePath)) return Response.json({ error: 'not found' }, { status: 404 });
  const { size } = statSync(filePath);

  const range = parseRangeHeader(req.headers.get('range'), size);
  if (range === 'invalid') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }

  const common = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' };
  if (range === null) {
    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    return new Response(stream, { status: 200, headers: { ...common, 'Content-Length': String(size) } });
  }
  const { start, end } = range;
  const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
  return new Response(stream, {
    status: 206,
    headers: {
      ...common,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
    },
  });
}
