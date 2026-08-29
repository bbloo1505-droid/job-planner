"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
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

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        backgroundColor: `color-mix(in srgb, ${category.fill} 16%, white)`,
      }}
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
        "flex h-[66px] w-full cursor-grab overflow-hidden rounded-[3px] text-left active:cursor-grabbing",
        selected && "ring-2 ring-navy ring-offset-1",
        isDragging && "opacity-50",
        "focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
      )}
    >
      <span
        className="w-[5px] shrink-0 self-stretch"
        style={{ backgroundColor: category.fill }}
        aria-hidden
      />
      <span className="flex min-w-0 flex-1 flex-col justify-center px-2 py-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-slate-900">
            {job.suburb || job.address}
          </span>
          {priority !== "normal" ? (
            <span
              className={cn(
                "shrink-0 text-[10px] font-semibold tracking-wide uppercase",
                priority === "urgent" ? "text-[#b4453c]" : "text-[#b57a2a]"
              )}
            >
              {priority}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 truncate text-[12px] text-slate-600">
          {job.title ?? "Job"}
        </span>
        <span className="mt-0.5 truncate text-[11px] text-slate-500">
          {due ?? "Flexible"}
        </span>
      </span>
    </div>
  );
}
