'use client';

import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/store/editor';
import { TitleEditor } from '@/components/TitleEditor';
import { GeneralSettings } from '@/components/GeneralSettings';
import { ClipCard } from '@/components/ClipCard';
import { OrderPanel } from '@/components/OrderPanel';
import { PreviewPane } from '@/components/PreviewPane';

export default function Home() {
  const clipIds = useEditorStore(useShallow((s) => s.project.clips.map((c) => c.id)));
  const addClip = useEditorStore((s) => s.addClip);

  return (
    <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 bg-gray-50 p-6 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-4">
        <TitleEditor />
        <GeneralSettings />
        <OrderPanel />
        {clipIds.map((id, i) => (
          <ClipCard key={id} clipId={id} index={i} count={clipIds.length} />
        ))}
        <button
          type="button"
          onClick={addClip}
          className="rounded-xl border-2 border-dashed border-blue-300 p-4 text-blue-500 hover:bg-blue-50"
        >
          + Add More Video
        </button>
      </div>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <PreviewPane />
      </aside>
    </main>
  );
}
