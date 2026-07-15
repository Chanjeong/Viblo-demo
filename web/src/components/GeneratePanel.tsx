'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor';
import { buildRenderProject } from '@/lib/project';

type Phase =
  | { name: 'idle' }
  | { name: 'submitting' }
  | { name: 'rendering'; jobId: string; status: string; progress: number }
  | { name: 'done'; jobId: string }
  | { name: 'error'; message: string };

export function GeneratePanel() {
  const project = useEditorStore((s) => s.project);
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = buildRenderProject(project, () => ({ kind: 'url', url: 'placeholder' }));
  const canGenerate = check.ok && (phase.name === 'idle' || phase.name === 'done' || phase.name === 'error');

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function poll(jobId: string) {
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/render/${jobId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok || data == null) throw new Error('상태 조회에 실패했습니다.');
        if (data.status === 'done') {
          if (timer.current) clearInterval(timer.current);
          setPhase({ name: 'done', jobId });
        } else if (data.status === 'error') {
          if (timer.current) clearInterval(timer.current);
          setPhase({ name: 'error', message: data.error ?? '렌더링 실패' });
        } else {
          setPhase({ name: 'rendering', jobId, status: data.status, progress: data.progress ?? 0 });
        }
      } catch (e) {
        if (timer.current) clearInterval(timer.current);
        setPhase({ name: 'error', message: e instanceof Error ? e.message : '상태 조회 실패' });
      }
    }, 1000);
  }

  async function generate() {
    setPhase({ name: 'submitting' });
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data == null) throw new Error((data?.problems as string[])?.join('\n') ?? '렌더 요청에 실패했습니다.');
      setPhase({ name: 'rendering', jobId: data.jobId, status: 'queued', progress: 0 });
      poll(data.jobId);
    } catch (e) {
      setPhase({ name: 'error', message: e instanceof Error ? e.message : '렌더 요청에 실패했습니다.' });
    }
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      {!check.ok && (
        <ul className="mb-3 list-disc pl-5 text-sm text-amber-600">
          {check.problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      {phase.name === 'rendering' && (
        <div className="mb-3">
          <div className="mb-1 text-sm text-gray-600">
            {phase.status === 'bundling' ? '준비 중…' : `렌더링 중 ${(phase.progress * 100).toFixed(0)}%`}
          </div>
          <div className="h-2 rounded bg-gray-200">
            <div className="h-2 rounded bg-blue-500 transition-all" style={{ width: `${phase.progress * 100}%` }} />
          </div>
        </div>
      )}
      {phase.name === 'error' && (
        <p className="mb-3 whitespace-pre-wrap rounded bg-red-50 p-2 text-sm text-red-600">{phase.message}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={!canGenerate}
          className="rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white disabled:opacity-40"
        >
          ✦ Generate Video Ranking
        </button>
        {phase.name === 'done' && (
          <a
            href={`/api/render/${phase.jobId}/download`}
            className="rounded-lg bg-green-500 px-6 py-3 font-semibold text-white"
          >
            ⬇ 완성본 다운로드
          </a>
        )}
      </div>
    </section>
  );
}
