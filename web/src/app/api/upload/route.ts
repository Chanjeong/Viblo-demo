import { NextRequest } from 'next/server';
import { saveUploadedFile } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'file 필드가 필요합니다.' }, { status: 400 });
    }
    const result = await saveUploadedFile(file);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : '업로드 실패' }, { status: 400 });
  }
}
