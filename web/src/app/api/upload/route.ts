import { NextRequest } from 'next/server';
import { saveUploadedFile, MediaError } from '@/lib/media';

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
    if (e instanceof MediaError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    console.error(e);
    return Response.json({ error: '업로드 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
