'use client';

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditorStore } from '@/store/editor';

function SortableRow({ id, text }: { id: string; text: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex cursor-grab items-center gap-2 rounded border bg-white px-3 py-2 text-sm"
      {...attributes}
      {...listeners}
    >
      <span className="text-gray-400">⠿</span> {text}
    </li>
  );
}

export function OrderPanel() {
  const clips = useEditorStore((s) => s.project.clips);
  const customOrder = useEditorStore((s) => s.project.customOrder);
  const setCustomOrderEnabled = useEditorStore((s) => s.setCustomOrderEnabled);
  const setCustomOrder = useEditorStore((s) => s.setCustomOrder);

  const enabled = customOrder !== null;
  const order = customOrder ?? clips.map((c) => c.id);
  const nameOf = (id: string) => {
    const i = clips.findIndex((c) => c.id === id);
    const label = clips[i]?.label.text;
    return `Rank ${i + 1}${label ? ` — ${label}` : ''}`;
  };

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setCustomOrder(arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))));
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Playback Order</h2>
        <label className="flex items-center gap-2 text-sm">
          Custom Playback Order
          <input type="checkbox" checked={enabled} onChange={(e) => setCustomOrderEnabled(e.target.checked)} />
        </label>
      </div>
      {enabled && (
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="mt-3 flex flex-col gap-2">
              {order.map((id) => <SortableRow key={id} id={id} text={nameOf(id)} />)}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {!enabled && <p className="mt-2 text-xs text-gray-400">기본: Rank 1 → N 순서로 재생됩니다.</p>}
    </section>
  );
}
