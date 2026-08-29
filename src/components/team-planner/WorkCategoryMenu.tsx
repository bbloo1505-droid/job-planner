"use client";

import { useEffect, useRef } from "react";
import {
  WORK_CATEGORIES,
  WORK_CATEGORY_META,
  workCategoryMeta,
} from "@/lib/team/work-category";
import type { WorkCategory } from "@/lib/types";

export function WorkCategoryMenu({
  x,
  y,
  current,
  onSelect,
  onClose,
}: {
  x: number;
  y: number;
  current?: WorkCategory;
  onSelect: (value: WorkCategory) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const active = workCategoryMeta(current);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const left = Math.min(x, typeof window === "undefined" ? x : window.innerWidth - 300);
  const top = Math.min(y, typeof window === "undefined" ? y : window.innerHeight - 360);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Work category"
      className="fixed z-[80] w-[280px] rounded-md border border-hairline bg-white p-1.5 shadow-lg"
      style={{ left, top }}
    >
      <p className="px-1.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
        Work category
      </p>
      {WORK_CATEGORIES.map((id) => {
        const item = WORK_CATEGORY_META[id];
        const selected = item.id === active.id;
        return (
          <button
            key={id}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            onClick={() => {
              onSelect(id);
              onClose();
            }}
            className="mb-0.5 flex w-full items-center rounded-[2px] px-2 py-1.5 text-left text-[12.5px] font-medium last:mb-0"
            style={{
              backgroundColor: item.fill,
              color: item.text,
              boxShadow: selected ? "inset 0 0 0 2px #1a2744" : undefined,
            }}
          >
            {item.keyLabel}
          </button>
        );
      })}
    </div>
  );
}
