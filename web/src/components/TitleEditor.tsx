'use client';

import { useEditorStore } from '@/store/editor';
import { ColorPopover } from '@/components/ColorPopover';
import type { Align, FontFamilyId } from '@/lib/project';

export function TitleEditor() {
  const title = useEditorStore((s) => s.project.title);
  const setTitle = useEditorStore((s) => s.setTitle);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">Video Ranking Title</h2>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          className="rounded border px-2 py-1"
          value={title.fontFamily}
          onChange={(e) => setTitle({ fontFamily: e.target.value as FontFamilyId })}
        >
          <option value="archivo-black">Archivo Black</option>
          <option value="rubik">Rubik</option>
        </select>
        <input
          type="number" min={20} max={200}
          className="w-20 rounded border px-2 py-1"
          value={title.fontSizePx}
          onChange={(e) => setTitle({ fontSizePx: Number(e.target.value) })}
        />
        <button type="button" onClick={() => setTitle({ bold: !title.bold })}
          className={`rounded border px-3 py-1 font-bold ${title.bold ? 'bg-black text-white' : ''}`}>B</button>
        <button type="button" onClick={() => setTitle({ italic: !title.italic })}
          className={`rounded border px-3 py-1 italic ${title.italic ? 'bg-black text-white' : ''}`}>I</button>
        {(['left', 'center', 'right'] as Align[]).map((a) => (
          <button key={a} type="button" onClick={() => setTitle({ align: a })}
            className={`rounded border px-2 py-1 text-xs ${title.align === a ? 'bg-black text-white' : ''}`}>
            {a === 'left' ? '⟸' : a === 'center' ? '≡' : '⟹'}
          </button>
        ))}
        <ColorPopover value={title.color} onChange={(color) => setTitle({ color })} />
      </div>
      <textarea
        rows={2}
        placeholder={'Enter ranking title...\n(줄바꿈 가능, 이모지는 Win+. 로 입력)'}
        className="w-full rounded-lg bg-gray-100 p-3 text-xl font-bold"
        value={title.text}
        onChange={(e) => setTitle({ text: e.target.value })}
      />
      <div className="mt-3 flex items-center gap-3">
        <span className="text-sm text-gray-500">Title Stroke</span>
        <ColorPopover value={title.strokeColor} onChange={(strokeColor) => setTitle({ strokeColor })} />
        <input
          type="range" min={0} max={20} step={1}
          value={title.strokeWidthPx}
          onChange={(e) => setTitle({ strokeWidthPx: Number(e.target.value) })}
        />
        <span className="w-8 text-sm">{title.strokeWidthPx}px</span>
      </div>
    </section>
  );
}
