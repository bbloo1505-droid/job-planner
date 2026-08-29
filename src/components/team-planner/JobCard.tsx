"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Lock } from "lucide-react";
import { dueStateLabel } from "@/lib/team/due-label";
import { formatDisplayTime } from "@/lib/routing/round-time";
import { useTeamPlannerStore } from "@/lib/store/team-planner-store";
import { workCategoryMeta } from "@/lib/team/work-category";
import type { Allocation, Job, Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

export function JobCard({
  job,
  allocation,
  selected,
  conflict,
  onSelect,
  onCategoryMenu,
  sortableId,
}: {
  job: Job;
  allocation?: Allocation;
  selected: boolean;
  conflict?: boolean;
  onSelect: () => void;
  onCategoryMenu: (jobId: string, position: { x: number; y: number }) => void;
  sortableId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: sortableId,
      data: {
        type: allocation ? "allocation" : "job",
        allocationId: allocation?.id,
        jobId: job.id,
        consultantId: allocation?.consultantId,
        date: allocation?.scheduledDate,
      },
    });

  const weekStart = useTeamPlannerStore((state) => state.weekStart);
  const due = dueStateLabel(job.dueDate, new Date(), weekStart);
  const priority = (job.priority ?? "normal") as Priority;
  const time = allocation?.startTime;
  const category = workCategoryMeta(job.workCategory);
  const heading =
    job.workCategory === "not_available"
      ? "Not available"
      : job.suburb || job.address;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        backgroundColor: category.fill,
        color: category.text,
      }}
      {...attributes}
      {...listeners}
      title={
        category.id === "management_locked"
          ? `${job.jobNumber ?? ""} — Do not move without Management Approval`.trim()
          : job.jobNumber
      }
      data-job-id={job.id}
      data-work-category={category.id}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${heading}. ${category.label}. Right-click to change category.`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onCategoryMenu(job.id, { x: event.clientX, y: event.clientY });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }
        if (event.key === "F10" && event.shiftKey) {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          onCategoryMenu(job.id, { x: rect.left, y: rect.bottom + 4 });
        }
      }}
      className={cn(
        "w-full cursor-grab rounded-[2px] px-1.5 py-1 text-left active:cursor-grabbing",
        selected && "ring-2 ring-navy ring-offset-1",
        isDragging && "z-20 opacity-70",
        "focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
      )}
    >
      <span className="flex items-start justify-between gap-1">
        <span className="min-w-0 truncate text-[12px] leading-4 font-semibold">
          {heading}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {category.id === "management_locked" ? (
            <Lock className="size-3" strokeWidth={2.25} />
          ) : null}
          {conflict ? <AlertTriangle className="size-3" strokeWidth={2} /> : null}
          {priority !== "normal" ? (
            <span
              className="text-[9px] font-semibold tracking-wide uppercase"
              style={{ color: category.onDark ? "#fff" : undefined }}
            >
              {priority}
            </span>
          ) : null}
        </span>
      </span>
      <span className="mt-0.5 block truncate text-[11px] leading-4" style={{ color: category.muted }}>
        {job.workCategory === "not_available"
          ? "Unavailable"
          : `${time ? formatDisplayTime(time) : "Flexible"}${job.title ? ` · ${job.title}` : ""}`}
      </span>
      {due && job.workCategory !== "not_available" ? (
        <span className="mt-0.5 block text-[10px] leading-3" style={{ color: category.muted }}>
          {due}
        </span>
      ) : null}
    </div>
  );
}
