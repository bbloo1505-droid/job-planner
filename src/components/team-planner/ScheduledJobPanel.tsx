"use client";

import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { formatDisplayTime } from "@/lib/routing/round-time";
import { workCategoryMeta } from "@/lib/team/work-category";
import {
  allocationForJob,
  useTeamPlannerStore,
} from "@/lib/store/team-planner-store";
import type { Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ScheduledJobPanel({ compact = false }: { compact?: boolean }) {
  const selectedJobId = useTeamPlannerStore((state) => state.selectedJobId);
  const jobs = useTeamPlannerStore((state) => state.jobs);
  const allocations = useTeamPlannerStore((state) => state.allocations);
  const consultants = useTeamPlannerStore((state) => state.consultants);
  const setView = useTeamPlannerStore((state) => state.setView);
  const selectJob = useTeamPlannerStore((state) => state.selectJob);
  const job = selectedJobId ? jobs[selectedJobId] : undefined;
  const allocation = job ? allocationForJob({ allocations }, job.id) : undefined;
  const consultant = allocation
    ? consultants.find((item) => item.id === allocation.consultantId)
    : undefined;

  if (!job || !allocation) return null;

  const category = workCategoryMeta(job.workCategory);
  const priority = (job.priority ?? "normal") as Priority;
  const when = allocation.scheduledDate
    ? `${format(parseISO(allocation.scheduledDate), "EEEE")}${
        allocation.startTime ? ` · ${formatDisplayTime(allocation.startTime)}` : ""
      }`
    : null;

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col border-l border-hairline bg-white",
        compact ? "shrink-0" : "flex-1"
      )}
      data-testid="scheduled-job-panel"
    >
      <div className="border-b border-hairline px-3 py-2">
        <p className="text-[11px] text-slate-500">{consultant?.name ?? "Consultant"}</p>
        <h2 className="mt-0.5 truncate text-[15px] font-semibold text-slate-900">
          {job.suburb || job.address}
        </h2>
        <p className="mt-0.5 truncate text-[12.5px] text-slate-700">{job.title ?? "Job"}</p>
        {when ? <p className="mt-1 text-[12px] text-slate-600">{when}</p> : null}
        <p className="mt-1 text-[11.5px] text-slate-500">{category.label}</p>
        {job.jobNumber ? (
          <p className="text-[11.5px] tabular-nums text-slate-500">{job.jobNumber}</p>
        ) : null}
        {priority !== "normal" ? (
          <p className="text-[11.5px] text-slate-500">{priorityLabel(priority)}</p>
        ) : null}
        {job.dueDate ? (
          <p className="text-[11.5px] text-slate-500">
            Due {format(parseISO(job.dueDate), "EEE d MMM")}
          </p>
        ) : null}
      </div>
      <div className="px-3 py-2">
        <Button
          type="button"
          variant="outline"
          data-testid="view-in-planner"
          className="h-8 w-full text-[12px]"
          onClick={() => setView("planner")}
        >
          View in planner
        </Button>
        <button
          type="button"
          onClick={() => selectJob(null)}
          className="mt-2 w-full text-center text-[11px] text-slate-500 hover:text-slate-800"
        >
          Clear selection
        </button>
      </div>
    </section>
  );
}

function priorityLabel(priority: Priority): string {
  if (priority === "urgent") return "Urgent priority";
  if (priority === "high") return "High priority";
  if (priority === "low") return "Low priority";
  return "Normal priority";
}
