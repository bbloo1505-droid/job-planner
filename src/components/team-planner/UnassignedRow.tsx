"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Clock } from "lucide-react";
import { durationLabel, PriorityPill } from "@/components/ui/priority-pill";
import { dueStateLabel } from "@/lib/team/due-label";
import { useTeamPlannerStore } from "@/lib/store/team-planner-store";
import { workCategoryMeta } from "@/lib/team/work-category";
import type { Job, Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

export function UnassignedRow({
  job,
  selected,
  onSelect,
  onCategoryMenu,
}: {
  job: Job;
  selected: boolean;
  onSelect: () => void;
  onCategoryMenu: (jobId: string, position: { x: number; y: number }) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `job:${job.id}`,
    data: { type: "job", jobId: job.id },
  });
  const weekStart = useTeamPlannerStore((state) => state.weekStart);
  const due = dueStateLabel(job.dueDate, new Date(), weekStart);
  const priority = (job.priority ?? "normal") as Priority;
  const category = workCategoryMeta(job.workCategory);
  const duration = durationLabel(job.estimatedMinutes ?? job.samplingDurationMinutes);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      title={job.jobNumber}
      data-job-id={job.id}
      data-work-category={category.id}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onCategoryMenu(job.id, { x: event.clientX, y: event.clientY });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "soft-card flex w-full cursor-grab overflow-hidden text-left transition-shadow active:cursor-grabbing",
        selected && "ring-2 ring-brand/40 ring-offset-1",
        isDragging && "opacity-50",
        "focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
      )}
    >
      <span
        className="w-1 shrink-0 self-stretch"
        style={{ backgroundColor: category.fill }}
        aria-hidden
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2.5">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-[13.5px] font-semibold text-slate-900">
            {job.suburb || job.address}
          </span>
          <PriorityPill priority={priority} />
        </span>
        <span className="truncate text-[12px] text-slate-500">
          {job.title ?? "Job"}
        </span>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-400">
          {duration ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" strokeWidth={1.75} />
              {duration}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3" strokeWidth={1.75} />
            {due ?? "Flexible"}
          </span>
        </span>
      </span>
    </div>
  );
}
