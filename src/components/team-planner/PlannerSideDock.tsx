"use client";

import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronUp, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PlannerSideDock({
  open,
  onOpenChange,
  label,
  count,
  acceptUnassign,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  count?: number;
  acceptUnassign?: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "unassigned-dock",
    data: { type: "unassigned" },
    disabled: open || !acceptUnassign,
  });

  return (
    <aside
      ref={setNodeRef}
      data-open={open ? "true" : "false"}
      data-testid="planner-side-dock"
      className={cn(
        "flex shrink-0 flex-col bg-white transition-[height,width] duration-200",
        "w-full border-t border-slate-200/80",
        open ? "h-[min(52vh,400px)]" : "h-12",
        "md:h-auto md:border-t-0 md:border-l",
        open
          ? "md:w-[min(34vw,320px)] md:min-w-[260px] md:max-w-[340px]"
          : "md:w-12 md:min-w-12 md:max-w-12",
        isOver && "bg-brand/[0.06]"
      )}
    >
      <button
        type="button"
        data-testid="planner-side-toggle"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex h-12 shrink-0 items-center gap-2 px-3 text-left text-slate-800 hover:bg-slate-50",
          !open &&
            "md:h-full md:flex-col md:items-center md:justify-start md:gap-3 md:px-1.5 md:pt-3"
        )}
      >
        <span className="hidden md:inline-flex">
          <PanelRight className="size-4 text-slate-500" strokeWidth={1.75} />
        </span>
        <span className="inline-flex md:hidden">
          {open ? (
            <ChevronDown className="size-4 text-slate-500" strokeWidth={1.75} />
          ) : (
            <ChevronUp className="size-4 text-slate-500" strokeWidth={1.75} />
          )}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 text-[13px] font-semibold tracking-tight",
            !open &&
              "md:flex-none md:[writing-mode:vertical-rl] md:rotate-180 md:text-[12px]"
          )}
        >
          {label}
        </span>
        {count != null ? (
          <span
            className={cn(
              "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 tabular-nums",
              !open && "md:px-1.5 md:py-1"
            )}
          >
            {count}
          </span>
        ) : null}
      </button>
      {open ? <div className="min-h-0 flex-1 overflow-hidden">{children}</div> : null}
    </aside>
  );
}
