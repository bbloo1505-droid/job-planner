"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { JobEditor } from "@/components/team-planner/JobEditor";
import { MatchPanel } from "@/components/team-planner/MatchPanel";
import { PlannerCell } from "@/components/team-planner/PlannerCell";
import { ScheduledJobPanel } from "@/components/team-planner/ScheduledJobPanel";
import { TeamMap } from "@/components/team-planner/TeamMap";
import { UnassignedPanel, matchesLite } from "@/components/team-planner/UnassignedPanel";
import { WorkCategoryKey } from "@/components/team-planner/WorkCategoryKey";
import { WorkCategoryMenu } from "@/components/team-planner/WorkCategoryMenu";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/AppShell";
import { allocationForJob, useTeamPlannerStore } from "@/lib/store/team-planner-store";
import { workCategoryMeta } from "@/lib/team/work-category";
import { columnLabel, isoDate, weekDays, weekRangeLabel } from "@/lib/team/week";
import type { WorkCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const preferPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : closestCorners(args);
};

export function TeamPlannerApp() {
  const consultants = useTeamPlannerStore((state) => state.consultants);
  const jobs = useTeamPlannerStore((state) => state.jobs);
  const allocations = useTeamPlannerStore((state) => state.allocations);
  const weekStart = useTeamPlannerStore((state) => state.weekStart);
  const selectedDate = useTeamPlannerStore((state) => state.selectedDate);
  const selectedConsultantId = useTeamPlannerStore((state) => state.selectedConsultantId);
  const selectedJobId = useTeamPlannerStore((state) => state.selectedJobId);
  const view = useTeamPlannerStore((state) => state.view);
  const search = useTeamPlannerStore((state) => state.search);
  const priorityFilter = useTeamPlannerStore((state) => state.priorityFilter);
  const dueThisWeekOnly = useTeamPlannerStore((state) => state.dueThisWeekOnly);
  const consultantFilter = useTeamPlannerStore((state) => state.consultantFilter);
  const undoStack = useTeamPlannerStore((state) => state.undoStack);
  const moveAllocation = useTeamPlannerStore((state) => state.moveAllocation);
  const assignJob = useTeamPlannerStore((state) => state.assignJob);
  const unassign = useTeamPlannerStore((state) => state.unassign);
  const reorderInCell = useTeamPlannerStore((state) => state.reorderInCell);
  const selectDate = useTeamPlannerStore((state) => state.selectDate);
  const selectConsultant = useTeamPlannerStore((state) => state.selectConsultant);
  const selectJob = useTeamPlannerStore((state) => state.selectJob);
  const setView = useTeamPlannerStore((state) => state.setView);
  const setSearch = useTeamPlannerStore((state) => state.setSearch);
  const setPriorityFilter = useTeamPlannerStore((state) => state.setPriorityFilter);
  const setDueThisWeekOnly = useTeamPlannerStore((state) => state.setDueThisWeekOnly);
  const setConsultantFilter = useTeamPlannerStore((state) => state.setConsultantFilter);
  const setEditingCell = useTeamPlannerStore((state) => state.setEditingCell);
  const goWeek = useTeamPlannerStore((state) => state.goWeek);
  const goToday = useTeamPlannerStore((state) => state.goToday);
  const undo = useTeamPlannerStore((state) => state.undo);
  const updateJob = useTeamPlannerStore((state) => state.updateJob);

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [categoryMenu, setCategoryMenu] = useState<{
    jobId: string;
    x: number;
    y: number;
  } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const selectedIsUnassigned = Boolean(
    selectedJobId && !allocationForJob({ allocations }, selectedJobId)
  );

  const openCategoryMenu = useCallback((jobId: string, position: { x: number; y: number }) => {
    setCategoryMenu({ jobId, ...position });
  }, []);

  const onEscape = useCallback(() => {
    setEditingCell(null);
    selectJob(null);
    setCategoryMenu(null);
  }, [selectJob, setEditingCell]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      if (event.key === "Escape") {
        onEscape();
        return;
      }
      const undoPressed =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z" &&
        !event.shiftKey;
      if (undoPressed && !isEditing) {
        event.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onEscape, undo]);

  const visibleConsultants = consultants.filter(
    (item) => consultantFilter === "all" || item.id === consultantFilter
  );

  function onDragStart(event: DragStartEvent) {
    const jobId = event.active.data.current?.jobId as string | undefined;
    setActiveJobId(jobId ?? null);
    setCategoryMenu(null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveJobId(null);
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as
      | {
          type?: string;
          allocationId?: string;
          jobId?: string;
          consultantId?: string;
          date?: string;
        }
      | undefined;
    const overData = over.data.current as
      | { type?: string; consultantId?: string; date?: string; allocationId?: string }
      | undefined;
    const overId = String(over.id);

    if (overId === "unassigned" || overData?.type === "unassigned") {
      if (activeData?.type === "allocation" && activeData.allocationId) {
        unassign(activeData.allocationId);
      }
      return;
    }

    const cell = parseCellTarget(overId, overData);
    if (!cell) return;

    if (activeData?.type === "job" && activeData.jobId) {
      assignJob(activeData.jobId, cell.consultantId, cell.date);
      return;
    }

    if (activeData?.type === "allocation" && activeData.allocationId) {
      const sameCell =
        activeData.consultantId === cell.consultantId && activeData.date === cell.date;
      if (sameCell && overData?.type === "allocation" && overData.allocationId) {
        const cellItems = allocations
          .filter(
            (item) =>
              item.consultantId === cell.consultantId && item.scheduledDate === cell.date
          )
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const from = cellItems.findIndex((item) => item.id === activeData.allocationId);
        const to = cellItems.findIndex((item) => item.id === overData.allocationId);
        if (from >= 0 && to >= 0) reorderInCell(cell.consultantId, cell.date, from, to);
        return;
      }
      moveAllocation(activeData.allocationId, cell.consultantId, cell.date);
    }
  }

  return (
    <AppShell>
      <DndContext
        id="team-planner"
        sensors={sensors}
        collisionDetection={preferPointer}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveJobId(null)}
      >
        <div className="flex h-full min-h-0 flex-col bg-canvas">
          <header className="shrink-0 border-b border-hairline bg-white px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div>
                  <p className="eyebrow">Team Planner</p>
                  <h1 className="text-[18px] leading-tight font-semibold tracking-tight text-slate-900">
                    {weekRangeLabel(weekStart)}
                  </h1>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Previous week"
                    onClick={() => goWeek(-1)}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Next week"
                    onClick={() => goWeek(1)}
                  >
                    <ChevronRight />
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={goToday}>
                    Today
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-md border border-hairline p-0.5">
                  <button
                    type="button"
                    data-view="planner"
                    onClick={() => setView("planner")}
                    className={cn(
                      "h-7 rounded px-2.5 text-[12px] font-medium",
                      view === "planner" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Planner
                  </button>
                  <button
                    type="button"
                    data-view="map"
                    onClick={() => setView("map")}
                    className={cn(
                      "h-7 rounded px-2.5 text-[12px] font-medium",
                      view === "map" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    data-view="split"
                    onClick={() => setView("split")}
                    className={cn(
                      "h-7 rounded px-2.5 text-[12px] font-medium",
                      view === "split" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Split
                  </button>
                </div>
                {view !== "map" ? <WorkCategoryKey /> : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={undoStack.length === 0}
                  onClick={undo}
                >
                  <Undo2 />
                  Undo
                </Button>
              </div>
            </div>
            {view !== "map" ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                className="field-input h-7 max-w-[220px]"
                placeholder="Search location or job no."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className="field-input h-7 w-[140px]"
                value={consultantFilter}
                onChange={(event) => setConsultantFilter(event.target.value)}
              >
                <option value="all">All consultants</option>
                {consultants.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                className="field-input h-7 w-[120px]"
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value as typeof priorityFilter)
                }
              >
                <option value="all">All priority</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
              <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
                <input
                  type="checkbox"
                  checked={dueThisWeekOnly}
                  onChange={(event) => setDueThisWeekOnly(event.target.checked)}
                />
                Due this week
              </label>
            </div>
            ) : null}
          </header>

          <div className="flex min-h-0 flex-1">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div
                className={cn(
                  "min-h-0 overflow-auto",
                  view === "map" ? "hidden" : "flex-1"
                )}
              >
                <div
                  className="grid min-w-0"
                  style={{
                    gridTemplateColumns: "minmax(148px,168px) repeat(5, minmax(0, 1fr))",
                  }}
                  role="grid"
                  aria-label="Weekly allocation board"
                >
                  <div className="sticky top-0 z-10 border-r border-b border-hairline bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500">
                    Consultant
                  </div>
                  {days.map((day) => {
                    const iso = isoDate(day);
                    const label = columnLabel(day);
                    const active = selectedDate === iso;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => selectDate(iso)}
                        className={cn(
                          "sticky top-0 z-10 border-r border-b border-hairline bg-slate-50 px-2 py-2 text-left last:border-r-0",
                          active && "bg-brand/[0.08]"
                        )}
                      >
                        <span className="block text-[10px] font-semibold tracking-[0.08em] text-slate-400">
                          {label.day}
                        </span>
                        <span className="block text-[12px] font-semibold text-slate-800">
                          {label.date}
                        </span>
                      </button>
                    );
                  })}

                  {visibleConsultants.map((consultant) => (
                    <ConsultantRow
                      key={consultant.id}
                      consultantId={consultant.id}
                      selected={selectedConsultantId === consultant.id}
                      onSelect={() => selectConsultant(consultant.id)}
                      onCategoryMenu={openCategoryMenu}
                      days={days.map(isoDate)}
                      jobs={jobs}
                      allocations={allocations.filter((item) => {
                        const job = jobs[item.jobId];
                        if (!job) return false;
                        return matchesLite(
                          job,
                          search,
                          priorityFilter,
                          dueThisWeekOnly,
                          weekStart
                        );
                      })}
                    />
                  ))}
                </div>
              </div>
              {view === "split" || view === "map" ? (
                <div
                  className={
                    view === "map" ? "min-h-0 flex-1" : "min-h-[280px] flex-1 border-t border-hairline"
                  }
                >
                  <TeamMap variant={view === "map" ? "full" : "split"} />
                </div>
              ) : null}
            </div>

            <aside
              className={cn(
                "flex shrink-0 flex-col bg-white",
                "w-[min(34vw,320px)] min-w-[260px] max-w-[340px]",
                "max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-20 max-md:shadow-md"
              )}
            >
              {selectedIsUnassigned ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <MatchPanel key={selectedJobId ?? "match"} />
                </div>
              ) : view === "planner" ? (
                <>
                  {selectedJobId ? (
                    <div className="min-h-0 flex-[1.2] overflow-hidden">
                      <JobEditor key={selectedJobId} />
                    </div>
                  ) : null}
                  <div
                    className={
                      selectedJobId
                        ? "flex min-h-[160px] flex-1 flex-col overflow-hidden"
                        : "min-h-0 flex-1"
                    }
                  >
                    <UnassignedPanel onCategoryMenu={openCategoryMenu} />
                  </div>
                </>
              ) : (
                <>
                  {selectedJobId ? (
                    <ScheduledJobPanel compact={view === "split"} />
                  ) : null}
                  {view === "split" || !selectedJobId ? (
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <UnassignedPanel onCategoryMenu={openCategoryMenu} />
                    </div>
                  ) : null}
                </>
              )}
            </aside>
          </div>
        </div>
        <DragOverlay>
          {activeJobId && jobs[activeJobId] ? (
            <DragCard jobId={activeJobId} />
          ) : null}
        </DragOverlay>
      </DndContext>
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
    </AppShell>
  );
}

function ConsultantRow({
  consultantId,
  selected,
  onSelect,
  onCategoryMenu,
  days,
  jobs,
  allocations,
}: {
  consultantId: string;
  selected: boolean;
  onSelect: () => void;
  onCategoryMenu: (jobId: string, position: { x: number; y: number }) => void;
  days: string[];
  jobs: ReturnType<typeof useTeamPlannerStore.getState>["jobs"];
  allocations: ReturnType<typeof useTeamPlannerStore.getState>["allocations"];
}) {
  const consultant = useTeamPlannerStore((state) =>
    state.consultants.find((item) => item.id === consultantId)
  );
  if (!consultant) return null;

  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "border-r border-b border-hairline bg-white px-3 py-2 text-left",
          selected && "bg-brand/[0.06]"
        )}
      >
        <span className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: consultant.displayColour }}
          />
          <span className="truncate text-[13px] font-medium text-slate-900">
            {consultant.name}
          </span>
        </span>
        <span className="mt-0.5 block text-[10.5px] text-slate-400">
          {consultant.initials} · {consultant.baseOffice?.replace(" (demo)", "")}
        </span>
      </button>
      {days.map((date) => (
        <PlannerCell
          key={`${consultant.id}-${date}`}
          consultant={consultant}
          date={date}
          jobs={jobs}
          onCategoryMenu={onCategoryMenu}
          allocations={allocations.filter(
            (item) => item.consultantId === consultant.id && item.scheduledDate === date
          )}
        />
      ))}
    </>
  );
}

function DragCard({ jobId }: { jobId: string }) {
  const job = useTeamPlannerStore((state) => state.jobs[jobId]);
  if (!job) return null;
  const category = workCategoryMeta(job.workCategory);
  return (
    <div
      className="rounded-[2px] px-2 py-1 text-[12px] font-semibold shadow-sm"
      style={{
        backgroundColor: category.fill,
        color: category.text,
      }}
    >
      {job.suburb || job.title || "Job"}
    </div>
  );
}

function parseCellTarget(
  overId: string,
  overData?: { type?: string; consultantId?: string; date?: string }
): { consultantId: string; date: string } | null {
  if (overData?.consultantId && overData.date) {
    return { consultantId: overData.consultantId, date: overData.date };
  }
  const match = overId.match(/^cell:(.+):(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  return { consultantId: match[1], date: match[2] };
}
