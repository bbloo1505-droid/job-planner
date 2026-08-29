"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  consultantFirstName,
  formatAdditionalTravel,
  rankAllocationCandidates,
} from "@/lib/geo/rank-allocation-candidates";
import { isoDate, weekDays } from "@/lib/team/week";
import { workCategoryMeta } from "@/lib/team/work-category";
import {
  allocationForJob,
  useTeamPlannerStore,
} from "@/lib/store/team-planner-store";
import type { Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MatchPanel() {
  const selectedJobId = useTeamPlannerStore((state) => state.selectedJobId);
  const jobs = useTeamPlannerStore((state) => state.jobs);
  const allocations = useTeamPlannerStore((state) => state.allocations);
  const consultants = useTeamPlannerStore((state) => state.consultants);
  const weekStart = useTeamPlannerStore((state) => state.weekStart);
  const assignJob = useTeamPlannerStore((state) => state.assignJob);
  const selectJob = useTeamPlannerStore((state) => state.selectJob);
  const allocationPreview = useTeamPlannerStore((state) => state.allocationPreview);
  const setAllocationPreview = useTeamPlannerStore((state) => state.setAllocationPreview);
  const job = selectedJobId ? jobs[selectedJobId] : undefined;
  const assigned = job ? allocationForJob({ allocations }, job.id) : undefined;

  const workingDays = useMemo(
    () => weekDays(weekStart).map(isoDate),
    [weekStart]
  );

  const candidates = useMemo(() => {
    if (!job || assigned) return [];
    return rankAllocationCandidates({
      job,
      consultants,
      jobs,
      allocations,
      workingDays,
    });
  }, [assigned, allocations, consultants, job, jobs, workingDays]);

  const displayed = useMemo(() => displayCandidates(candidates), [candidates]);
  const selected =
    displayed.find(
      (item) =>
        allocationPreview?.jobId === selectedJobId &&
        item.consultantId === allocationPreview.consultantId &&
        item.date === allocationPreview.date
    ) ??
    displayed.find((item) => item.feasible) ??
    displayed[0];

  if (!job || assigned) return null;

  const priority = (job.priority ?? "normal") as Priority;
  const category = workCategoryMeta(job.workCategory);
  const due = job.dueDate ? `Due ${format(parseISO(job.dueDate), "EEEE")}` : null;
  const first = selected ? consultantFirstName(selected.consultantName) : "";
  const day = selected ? format(parseISO(selected.date), "EEE") : "";

  return (
    <section
      className="flex min-h-0 flex-col border-l border-slate-200/80 bg-[#f8f9fb]"
      data-testid="match-panel"
      data-job-id={job.id}
    >
      <div className="border-b border-slate-200/70 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => selectJob(null)}
          className="text-[11px] text-slate-500 hover:text-slate-800"
        >
          ← Back to unassigned jobs
        </button>
        <h2 className="mt-1.5 truncate text-[15px] font-semibold text-slate-900">
          {job.suburb || job.address}
        </h2>
        <p className="mt-0.5 truncate text-[12.5px] text-slate-700">{job.title ?? "Job"}</p>
        <p className="mt-1 text-[11.5px] text-slate-500">{category.label}</p>
        <p className="text-[11.5px] text-slate-500">
          <PriorityLine priority={priority} />
        </p>
        {due ? <p className="text-[11.5px] text-slate-500">{due}</p> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-2.5">
        <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
          Best allocation options
        </p>
        <p className="mt-0.5 text-[10.5px] text-slate-400">
          Prototype travel estimate — not live road routing
        </p>
        {candidates.length === 0 ? (
          <p className="mt-3 text-[12px] text-slate-500">
            No consultants in this date window to compare.
          </p>
        ) : (
          <ol className="mt-2.5 space-y-2">
            {displayed.map((item) => {
              const active =
                selected?.consultantId === item.consultantId && selected.date === item.date;
              const rank = item.feasible ? feasibleIndex(displayed, item) : null;
              return (
                <li key={`${item.consultantId}-${item.date}`}>
                  <button
                    type="button"
                    data-match-rank={rank ?? undefined}
                    data-match-consultant={item.consultantId}
                    data-match-date={item.date}
                    data-match-feasible={item.feasible ? "true" : "false"}
                    onClick={() =>
                      setAllocationPreview({
                        jobId: job.id,
                        consultantId: item.consultantId,
                        date: item.date,
                      })
                    }
                    onMouseEnter={() =>
                      setAllocationPreview({
                        jobId: job.id,
                        consultantId: item.consultantId,
                        date: item.date,
                      })
                    }
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-brand/40 bg-brand/[0.06] shadow-sm"
                        : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <span className="flex items-start gap-2">
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                          item.feasible
                            ? "bg-navy text-white"
                            : "bg-slate-200 text-slate-500"
                        )}
                      >
                        {rank ?? "–"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-slate-900">
                          {item.consultantName}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-slate-600">
                          {format(parseISO(item.date), "EEEE")}
                        </span>
                        {item.feasible ? (
                          <>
                            <span className="mt-0.5 block text-[11.5px] text-slate-500">
                              Existing work: {item.existingWork}
                            </span>
                            <span className="mt-0.5 block text-[11.5px] text-slate-500">
                              Best insertion: {item.insertionLabel}
                            </span>
                            <span className="mt-0.5 block text-[11.5px] tabular-nums text-slate-500">
                              {formatAdditionalTravel(item.additionalTravelMinutes)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="mt-0.5 block text-[11.5px] font-medium text-slate-600">
                              Not feasible
                            </span>
                            <span className="mt-0.5 block text-[11.5px] text-slate-500">
                              {item.infeasibleReason ?? "Cannot fit this job"}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                  </button>
                  {active && item.feasible ? (
                    <Button
                      type="button"
                      data-testid="assign-from-map"
                      className="mt-2 h-9 w-full rounded-xl bg-brand text-[13px] font-semibold text-white hover:bg-brand-strong"
                      onClick={() => assignJob(job.id, item.consultantId, item.date)}
                    >
                      Assign {first} / {day}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <p className="border-t border-hairline px-3 py-2 text-[10.5px] text-slate-400">
        Does not allocate until you confirm. Ctrl/Cmd+Z undoes.
      </p>
    </section>
  );
}

function PriorityLine({ priority }: { priority: Priority }) {
  if (priority === "urgent") {
    return <span className="font-medium text-[#b4453c]">Urgent priority</span>;
  }
  if (priority === "high") {
    return <span className="font-medium text-[#b57a2a]">High priority</span>;
  }
  if (priority === "low") {
    return <span>Low priority</span>;
  }
  return <span>Normal priority</span>;
}

function displayCandidates<T extends { feasible: boolean }>(candidates: T[]): T[] {
  const feasible = candidates.filter((item) => item.feasible).slice(0, 5);
  const infeasible = candidates.filter((item) => !item.feasible).slice(0, 3);
  return [...feasible, ...infeasible];
}

function feasibleIndex<T extends { feasible: boolean; consultantId: string; date: string }>(
  list: T[],
  item: T
): number | null {
  const feasible = list.filter((entry) => entry.feasible);
  const index = feasible.findIndex(
    (entry) => entry.consultantId === item.consultantId && entry.date === item.date
  );
  return index >= 0 ? index + 1 : null;
}
