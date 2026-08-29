"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useRef } from "react";
import { JobCard } from "@/components/team-planner/JobCard";
import { allocationsOverlap, cellHasConflict, formatHours } from "@/lib/team/schedule";
import { useTeamPlannerStore } from "@/lib/store/team-planner-store";
import type { Allocation, Consultant, Job } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PlannerCell({
  consultant,
  date,
  allocations,
  jobs,
  onCategoryMenu,
  compact = false,
  weekBreak = false,
}: {
  consultant: Consultant;
  date: string;
  allocations: Allocation[];
  jobs: Record<string, Job>;
  onCategoryMenu: (jobId: string, position: { x: number; y: number }) => void;
  compact?: boolean;
  weekBreak?: boolean;
}) {
  const editing = useTeamPlannerStore(
    (state) => state.editingCell?.consultantId === consultant.id && state.editingCell.date === date
  );
  const selectJob = useTeamPlannerStore((state) => state.selectJob);
  const selectDate = useTeamPlannerStore((state) => state.selectDate);
  const setEditingCell = useTeamPlannerStore((state) => state.setEditingCell);
  const quickAdd = useTeamPlannerStore((state) => state.quickAdd);
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${consultant.id}:${date}`,
    data: { type: "cell", consultantId: consultant.id, date },
  });

  const conflict = cellHasConflict(allocations, jobs);
  const minutes = allocations.reduce(
    (sum, item) => sum + (jobs[item.jobId]?.estimatedMinutes ?? 0),
    0
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/cell flex flex-col border-r border-b border-slate-200/80 last:border-r-0",
        compact ? "min-h-[52px] gap-1 p-1" : "min-h-[92px] gap-1.5 p-2",
        weekBreak && "prensa-planner-week-break",
        isOver && "bg-brand/[0.06]"
      )}
      onClick={() => {
        selectDate(date);
        if (!editing) setEditingCell({ consultantId: consultant.id, date });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !editing) {
          setEditingCell({ consultantId: consultant.id, date });
        }
      }}
      data-cell={`${consultant.id}:${date}`}
      data-editing={editing ? "true" : undefined}
      role="gridcell"
      tabIndex={0}
    >
      {!compact && allocations.length > 0 ? (
        <p className="px-0.5 text-[10px] text-slate-400 tabular-nums">
          {allocations.length} {allocations.length === 1 ? "job" : "jobs"}
          {minutes > 0 ? ` · ${formatHours(minutes)}` : ""}
          {conflict ? " · overlap" : ""}
        </p>
      ) : null}

      <SortableContext
        items={allocations.map((item) => `alloc:${item.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className={cn("flex flex-col", compact ? "gap-1" : "gap-1.5")}>
          {allocations.map((allocation) => {
            const job = jobs[allocation.jobId];
            if (!job) return null;
            return (
              <JobCard
                key={allocation.id}
                job={job}
                allocation={allocation}
                compact={compact}
                conflict={allocations.some((other) =>
                  allocationsOverlap(allocation, other, jobs)
                )}
                sortableId={`alloc:${allocation.id}`}
                onSelect={() => selectJob(job.id)}
                onCategoryMenu={onCategoryMenu}
              />
            );
          })}
        </div>
      </SortableContext>

      {editing ? (
        <QuickEntry
          onSubmit={(text) => {
            quickAdd(consultant.id, date, text);
          }}
          onCancel={() => setEditingCell(null)}
        />
      ) : (
        <button
          type="button"
          data-testid="quick-add-trigger"
          className={cn(
            "mt-auto w-full rounded-sm px-0.5 text-left text-slate-400 transition-opacity",
            "opacity-45 hover:opacity-100 group-hover/cell:opacity-100 group-focus-within/cell:opacity-100",
            compact ? "min-h-[16px] rounded-md text-[10px]" : "rounded-md text-[11px]"
          )}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            selectDate(date);
            setEditingCell({ consultantId: consultant.id, date });
          }}
        >
          + Add
        </button>
      )}
    </div>
  );
}

function QuickEntry({
  onSubmit,
  onCancel,
}: {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <input
      ref={ref}
      aria-label="Add job"
      placeholder="Nambour 10am ACM Survey"
      className="h-8 w-full rounded-md border border-brand bg-white px-2 text-[12px] text-slate-900 outline-none ring-3 ring-brand/15"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          const value = event.currentTarget.value.trim();
          if (value) onSubmit(value);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      onBlur={(event) => {
        // relatedTarget is null on unmount / React Strict Mode remount — do not cancel.
        if (!event.relatedTarget) return;
        if (!event.currentTarget.value.trim()) onCancel();
      }}
    />
  );
}
