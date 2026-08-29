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
}: {
  consultant: Consultant;
  date: string;
  allocations: Allocation[];
  jobs: Record<string, Job>;
  onCategoryMenu: (jobId: string, position: { x: number; y: number }) => void;
}) {
  const selectedJobId = useTeamPlannerStore((state) => state.selectedJobId);
  const editingCell = useTeamPlannerStore((state) => state.editingCell);
  const selectJob = useTeamPlannerStore((state) => state.selectJob);
  const setEditingCell = useTeamPlannerStore((state) => state.setEditingCell);
  const quickAdd = useTeamPlannerStore((state) => state.quickAdd);
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${consultant.id}:${date}`,
    data: { type: "cell", consultantId: consultant.id, date },
  });

  const editing =
    editingCell?.consultantId === consultant.id && editingCell.date === date;
  const conflict = cellHasConflict(allocations, jobs);
  const minutes = allocations.reduce(
    (sum, item) => sum + (jobs[item.jobId]?.estimatedMinutes ?? 0),
    0
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/cell flex min-h-[88px] flex-col gap-1 border-r border-b border-hairline p-1.5 last:border-r-0",
        isOver && "bg-brand/[0.06]"
      )}
      onClick={() => {
        if (!editing) setEditingCell({ consultantId: consultant.id, date });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !editing) {
          setEditingCell({ consultantId: consultant.id, date });
        }
      }}
      data-cell={`${consultant.id}:${date}`}
      role="gridcell"
      tabIndex={0}
    >
      {allocations.length > 0 ? (
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
        <div className="flex flex-col gap-1">
          {allocations.map((allocation) => {
            const job = jobs[allocation.jobId];
            if (!job) return null;
            return (
              <JobCard
                key={allocation.id}
                job={job}
                allocation={allocation}
                selected={selectedJobId === job.id}
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
        <span className="mt-auto px-0.5 text-[11px] text-slate-400 opacity-0 transition-opacity group-hover/cell:opacity-100 group-focus-within/cell:opacity-100">
          + Add job
        </span>
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
        if (!event.currentTarget.value.trim()) onCancel();
      }}
    />
  );
}
