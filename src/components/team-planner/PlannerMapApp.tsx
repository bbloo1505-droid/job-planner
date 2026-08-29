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
import { ScheduledJobPanel } from "@/components/team-planner/ScheduledJobPanel";
import { TeamMap } from "@/components/team-planner/TeamMap";
import { UnassignedPanel } from "@/components/team-planner/UnassignedPanel";
import { WorkCategoryMenu } from "@/components/team-planner/WorkCategoryMenu";
import { allocationForJob, useTeamPlannerStore } from "@/lib/store/team-planner-store";
import { weekRangeLabel } from "@/lib/team/week";
import type { WorkCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

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

  const selectedIsUnassigned = Boolean(
    selectedJobId && !allocationForJob({ allocations }, selectedJobId)
  );
  const openCategoryMenu = useCallback((jobId: string, position: { x: number; y: number }) => {
    setCategoryMenu({ jobId, ...position });
  }, []);

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
          <header className="shrink-0 border-b border-slate-200/70 bg-white px-5 py-3.5">
            <p className="eyebrow">Planner Map</p>
            <h1 className="mt-1 text-[18px] leading-tight font-semibold tracking-tight text-slate-900">
              Allocation map
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-500">{weekRangeLabel(weekStart)}</p>
          </header>
          <div className="flex min-h-0 flex-1">
            <div className="min-h-0 min-w-0 flex-1">
              <TeamMap variant="full" />
            </div>
            <aside
              className={cn(
                "flex shrink-0 flex-col border-l border-hairline bg-white",
                "w-[min(34vw,320px)] min-w-[260px] max-w-[340px]",
                "max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-20 max-md:shadow-md"
              )}
            >
              {selectedIsUnassigned ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <MatchPanel key={selectedJobId ?? "match"} />
                </div>
              ) : selectedJobId ? (
                <ScheduledJobPanel />
              ) : (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <UnassignedPanel onCategoryMenu={openCategoryMenu} />
                </div>
              )}
            </aside>
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
