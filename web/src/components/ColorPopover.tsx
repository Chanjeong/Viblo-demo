'use client';

import { useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';

export function ColorPopover({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="색상 선택"
        className="h-8 w-8 rounded-full border border-gray-300"
        style={{ backgroundColor: value }}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="absolute z-20 mt-2 rounded-lg bg-white p-3 shadow-xl">
          <HexColorPicker color={value} onChange={(c) => onChange(c.toUpperCase())} />
          <div className="mt-2 text-center font-mono text-xs">{value}</div>
        </div>
      )}
    </div>
  );
}
