"use client";

import { useDroppable } from "@dnd-kit/core";
import { UnassignedRow } from "@/components/team-planner/UnassignedRow";
import { useTeamPlannerStore, unassignedJobs } from "@/lib/store/team-planner-store";
import { cn } from "@/lib/utils";

export function UnassignedPanel({
  onCategoryMenu,
}: {
  onCategoryMenu: (jobId: string, position: { x: number; y: number }) => void;
}) {
  const jobs = useTeamPlannerStore((state) => state.jobs);
  const allocations = useTeamPlannerStore((state) => state.allocations);
  const selectedJobId = useTeamPlannerStore((state) => state.selectedJobId);
  const search = useTeamPlannerStore((state) => state.search);
  const priorityFilter = useTeamPlannerStore((state) => state.priorityFilter);
  const dueThisWeekOnly = useTeamPlannerStore((state) => state.dueThisWeekOnly);
  const weekStart = useTeamPlannerStore((state) => state.weekStart);
  const selectJob = useTeamPlannerStore((state) => state.selectJob);
  const { setNodeRef, isOver } = useDroppable({
    id: "unassigned",
    data: { type: "unassigned" },
  });

  const items = unassignedJobs({ jobs, allocations }).filter((job) =>
    matchesLite(job, search, priorityFilter, dueThisWeekOnly, weekStart)
  );

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex h-full min-h-0 flex-col border-l border-hairline bg-white",
        isOver && "bg-brand/[0.04]"
      )}
    >
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2.5">
        <h2 className="panel-heading">Unassigned jobs</h2>
        <span className="text-[11px] text-slate-400 tabular-nums">{items.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-auto p-1.5">
        {items.length === 0 ? (
          <p className="px-1 py-8 text-center text-[12px] text-slate-400">
            Nothing in the queue.
          </p>
        ) : (
          items.map((job) => (
            <UnassignedRow
              key={job.id}
              job={job}
              selected={selectedJobId === job.id}
              onSelect={() => selectJob(job.id)}
              onCategoryMenu={onCategoryMenu}
            />
          ))
        )}
      </div>
      <p className="border-t border-hairline px-3 py-2 text-[11px] text-slate-400">
        Drag onto a consultant / day to allocate.
      </p>
    </section>
  );
}

export function matchesLite(
  job: { address: string; suburb?: string; jobNumber?: string; title?: string; priority?: string; dueDate?: string },
  search: string,
  priorityFilter: string,
  dueThisWeekOnly: boolean,
  weekStart: string
): boolean {
  const q = search.trim().toLowerCase();
  if (q) {
    const hay = `${job.address} ${job.suburb ?? ""} ${job.jobNumber ?? ""} ${job.title ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (priorityFilter !== "all" && (job.priority ?? "normal") !== priorityFilter) return false;
  if (dueThisWeekOnly) {
    if (!job.dueDate) return false;
    if (job.dueDate < weekStart || job.dueDate > addFriday(weekStart)) return false;
  }
  return true;
}

function addFriday(monday: string): string {
  const date = new Date(`${monday}T00:00:00`);
  date.setDate(date.getDate() + 4);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
