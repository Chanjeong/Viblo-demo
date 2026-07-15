'use client';

import { useEditorStore } from '@/store/editor';
import { ColorPopover } from '@/components/ColorPopover';
import { clampNum } from '@/lib/num';

export function GeneralSettings() {
  const general = useEditorStore((s) => s.project.general);
  const setGeneral = useEditorStore((s) => s.setGeneral);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">General Setting</h2>
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          Video height
          <input
            type="number" min={50} max={100}
            className="w-20 rounded border px-2 py-1"
            value={general.videoHeightPct}
            onChange={(e) => setGeneral({ videoHeightPct: clampNum(e.target.value, 50, 100, general.videoHeightPct) })}
          />
          %
        </label>
        <label className="flex items-center gap-2 text-sm">
          Background
          <ColorPopover value={general.backgroundColor} onChange={(backgroundColor) => setGeneral({ backgroundColor })} />
          <span className="font-mono text-xs">{general.backgroundColor}</span>
        </label>
      </div>
    </section>
  );
}
