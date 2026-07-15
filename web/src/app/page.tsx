'use client';

import { useEditorStore } from '@/store/editor';
import { TitleEditor } from '@/components/TitleEditor';
import { GeneralSettings } from '@/components/GeneralSettings';
import { ClipCard } from '@/components/ClipCard';

export default function Home() {
  const clipIds = useEditorStore((s) => s.project.clips.map((c) => c.id));
  const addClip = useEditorStore((s) => s.addClip);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 bg-gray-50 p-6">
      <TitleEditor />
      <GeneralSettings />
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
    </main>
  );
}
