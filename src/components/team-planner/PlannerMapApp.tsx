"use client";

import {
  DndContext,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import { useCallback, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MatchPanel } from "@/components/team-planner/MatchPanel";
import { PlannerSideDock } from "@/components/team-planner/PlannerSideDock";
import { ScheduledJobPanel } from "@/components/team-planner/ScheduledJobPanel";
import { TeamMap } from "@/components/team-planner/TeamMap";
import { UnassignedPanel, matchesLite } from "@/components/team-planner/UnassignedPanel";
import { WorkCategoryMenu } from "@/components/team-planner/WorkCategoryMenu";
import {
  allocationForJob,
  unassignedJobs,
  useTeamPlannerStore,
} from "@/lib/store/team-planner-store";
import { weekRangeLabel } from "@/lib/team/week";
import type { WorkCategory } from "@/lib/types";

const preferPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : closestCorners(args);
};

export function PlannerMapApp() {
  const jobs = useTeamPlannerStore((state) => state.jobs);
  const allocations = useTeamPlannerStore((state) => state.allocations);
  const selectedJobId = useTeamPlannerStore((state) => state.selectedJobId);
  const weekStart = useTeamPlannerStore((state) => state.weekStart);
  const updateJob = useTeamPlannerStore((state) => state.updateJob);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const [categoryMenu, setCategoryMenu] = useState<{
    jobId: string;
    x: number;
    y: number;
  } | null>(null);

  const [sideOpen, setSideOpen] = useState(false);
  const [openedForJob, setOpenedForJob] = useState<string | null>(null);
  const search = useTeamPlannerStore((state) => state.search);
  const priorityFilter = useTeamPlannerStore((state) => state.priorityFilter);
  const dueThisWeekOnly = useTeamPlannerStore((state) => state.dueThisWeekOnly);

  const selectedIsUnassigned = Boolean(
    selectedJobId && !allocationForJob({ allocations }, selectedJobId)
  );
  const unassignedCount = unassignedJobs({ jobs, allocations }).filter((job) =>
    matchesLite(job, search, priorityFilter, dueThisWeekOnly, weekStart)
  ).length;
  const openCategoryMenu = useCallback((jobId: string, position: { x: number; y: number }) => {
    setCategoryMenu({ jobId, ...position });
  }, []);

  if (selectedJobId && selectedJobId !== openedForJob) {
    setOpenedForJob(selectedJobId);
    setSideOpen(true);
  }

  return (
    <AppShell>
      <DndContext
        id="planner-map"
        sensors={sensors}
        collisionDetection={preferPointer}
      >
        <div
          className="flex h-full min-h-0 flex-col bg-canvas"
          data-testid="planner-map-app"
        >
          <header className="shrink-0 border-b border-slate-200/70 bg-white px-4 py-2 md:px-5 md:py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <h1 className="text-[16px] leading-tight font-semibold tracking-tight text-slate-900 md:text-[18px]">
                Allocation map
              </h1>
              <p className="text-[12.5px] text-slate-500">{weekRangeLabel(weekStart)}</p>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div className="min-h-0 min-w-0 flex-1">
              <TeamMap variant="full" />
            </div>
            <PlannerSideDock
              open={sideOpen}
              onOpenChange={setSideOpen}
              label={
                selectedIsUnassigned
                  ? "Match job"
                  : selectedJobId
                    ? "Job details"
                    : "Unassigned jobs"
              }
              count={selectedJobId ? undefined : unassignedCount}
              acceptUnassign={!selectedIsUnassigned}
            >
              {selectedIsUnassigned ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <MatchPanel key={selectedJobId ?? "match"} />
                </div>
              ) : selectedJobId ? (
                <ScheduledJobPanel />
              ) : (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <UnassignedPanel embedded onCategoryMenu={openCategoryMenu} />
                </div>
              )}
            </PlannerSideDock>
          </div>
        </div>
        {categoryMenu ? (
          <WorkCategoryMenu
            x={categoryMenu.x}
            y={categoryMenu.y}
            current={jobs[categoryMenu.jobId]?.workCategory}
            onSelect={(value: WorkCategory) => {
              updateJob(categoryMenu.jobId, { workCategory: value });
            }}
            onClose={() => setCategoryMenu(null)}
          />
        ) : null}
      </DndContext>
    </AppShell>
  );
}
