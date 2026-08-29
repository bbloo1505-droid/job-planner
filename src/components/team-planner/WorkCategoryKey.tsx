"use client";

import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WORK_CATEGORIES, WORK_CATEGORY_META } from "@/lib/team/work-category";

export function WorkCategoryKey() {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex h-7 items-center rounded-md border border-hairline bg-white px-2.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
        Key
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(320px,calc(100vw-1.5rem))] gap-1 p-2.5">
        <PopoverHeader className="px-0.5 pb-1">
          <PopoverTitle className="text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
            Key
          </PopoverTitle>
          <p className="text-[11px] leading-4 text-slate-400">
            Same colour language as the QLD Planning Board.
          </p>
        </PopoverHeader>
        <ul className="space-y-0.5">
          {WORK_CATEGORIES.map((id) => {
            const item = WORK_CATEGORY_META[id];
            return (
              <li
                key={id}
                className="rounded-[2px] px-2 py-1.5 text-[12.5px] leading-4 font-medium"
                style={{ backgroundColor: item.fill, color: item.text }}
              >
                {item.keyLabel}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
