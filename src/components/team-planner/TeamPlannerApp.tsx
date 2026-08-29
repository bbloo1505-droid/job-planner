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
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { JobEditor } from "@/components/team-planner/JobEditor";
import { MatchPanel } from "@/components/team-planner/MatchPanel";
import { PlanningBoard } from "@/components/team-planner/PlanningBoard";
import { UnassignedPanel, matchesLite } from "@/components/team-planner/UnassignedPanel";
import { WorkCategoryKey } from "@/components/team-planner/WorkCategoryKey";
import { WorkCategoryMenu } from "@/components/team-planner/WorkCategoryMenu";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/AppShell";
import { allocationForJob, useTeamPlannerStore } from "@/lib/store/team-planner-store";
import { monthDays, monthLabel } from "@/lib/team/month";
import { workCategoryMeta } from "@/lib/team/work-category";
import { weekDays, weekRangeLabel } from "@/lib/team/week";
import type { Allocation, WorkCategory } from "@/lib/types";
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
  const monthStart = useTeamPlannerStore((state) => state.monthStart);
  const boardView = useTeamPlannerStore((state) => state.boardView);
  const showWeekends = useTeamPlannerStore((state) => state.showWeekends);
  const selectedJobId = useTeamPlannerStore((state) => state.selectedJobId);
  const selectedDate = useTeamPlannerStore((state) => state.selectedDate);
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
  const selectJob = useTeamPlannerStore((state) => state.selectJob);
  const setSearch = useTeamPlannerStore((state) => state.setSearch);
  const setPriorityFilter = useTeamPlannerStore((state) => state.setPriorityFilter);
  const setDueThisWeekOnly = useTeamPlannerStore((state) => state.setDueThisWeekOnly);
  const setConsultantFilter = useTeamPlannerStore((state) => state.setConsultantFilter);
  const setEditingCell = useTeamPlannerStore((state) => state.setEditingCell);
  const goWeek = useTeamPlannerStore((state) => state.goWeek);
  const goMonth = useTeamPlannerStore((state) => state.goMonth);
  const goToday = useTeamPlannerStore((state) => state.goToday);
  const setBoardView = useTeamPlannerStore((state) => state.setBoardView);
  const setShowWeekends = useTeamPlannerStore((state) => state.setShowWeekends);
  const revealDate = useTeamPlannerStore((state) => state.revealDate);
  const setGeoScope = useTeamPlannerStore((state) => state.setGeoScope);
  const undo = useTeamPlannerStore((state) => state.undo);
  const updateJob = useTeamPlannerStore((state) => state.updateJob);

  const rootRef = useRef<HTMLDivElement>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [categoryMenu, setCategoryMenu] = useState<{
    jobId: string;
    x: number;
    y: number;
  } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const days = useMemo(
    () => (boardView === "month" ? monthDays(monthStart, showWeekends) : weekDays(weekStart)),
    [boardView, monthStart, showWeekends, weekStart]
  );
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
    rootRef.current?.setAttribute("data-planner-ready", "true");
  }, []);

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

  const allocationsByCell = useMemo(
    () => indexAllocations(allocations, jobs, search, priorityFilter, dueThisWeekOnly, weekStart),
    [allocations, dueThisWeekOnly, jobs, priorityFilter, search, weekStart]
  );

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 3) return;
    const hits = allocations.filter((item) => {
      const job = jobs[item.jobId];
      if (!job) return false;
      const hay = `${job.jobNumber ?? ""} ${job.suburb ?? ""} ${job.address} ${job.title ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    if (hits.length !== 1) return;
    const hit = hits[0];
    revealDate(hit.scheduledDate, {
      consultantId: hit.consultantId,
      jobId: hit.jobId,
    });
  }, [allocations, jobs, revealDate, search]);

  function onDragStart(event: DragStartEvent) {
    const jobId = event.active.data.current?.jobId as string | undefined;
    setActiveJobId(jobId ?? null);
    setCategoryMenu(null);
  }

  function onDragMove(event: DragMoveEvent) {
    const board = document.querySelector<HTMLElement>("[data-testid='planning-board']");
    const translated = event.active.rect.current.translated;
    if (!board || !translated) return;
    const rect = board.getBoundingClientRect();
    const edge = 64;
    if (translated.left < rect.left + edge) board.scrollLeft -= 22;
    if (translated.right > rect.right - edge) board.scrollLeft += 22;
    if (translated.top < rect.top + edge) board.scrollTop -= 16;
    if (translated.bottom > rect.bottom - edge) board.scrollTop += 16;
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
      const movingJob = activeData.jobId ? jobs[activeData.jobId] : undefined;
      if (
        !sameCell &&
        movingJob?.workCategory === "management_locked" &&
        !window.confirm("Do not move without Management Approval. Move this job anyway?")
      ) {
        return;
      }
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
        autoScroll={{ threshold: { x: 0.14, y: 0.14 }, acceleration: 12 }}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveJobId(null)}
      >
        <div
          ref={rootRef}
          className="flex h-full min-h-0 flex-col bg-canvas"
          data-testid="team-planner-app"
          data-planner-ready="false"
          data-selected-date={selectedDate ?? ""}
        >
          <header className="shrink-0 border-b border-slate-200/70 bg-white px-5 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div>
                  <p className="eyebrow">Team Planner</p>
                  <h1
                    className="text-[18px] leading-tight font-semibold tracking-tight text-slate-900"
                    data-testid="planner-period-label"
                  >
                    {boardView === "month" ? monthLabel(monthStart) : weekRangeLabel(weekStart)}
                  </h1>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={boardView === "month" ? "Previous month" : "Previous week"}
                    onClick={() => (boardView === "month" ? goMonth(-1) : goWeek(-1))}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={boardView === "month" ? "Next month" : "Next week"}
                    onClick={() => (boardView === "month" ? goMonth(1) : goWeek(1))}
                  >
                    <ChevronRight />
                  </Button>
                  <Button type="button" variant="outline" size="sm" data-testid="planner-today" onClick={goToday}>
                    Today
                  </Button>
                </div>
                <div className="flex rounded-md border border-hairline p-0.5" data-testid="board-view-switch">
                  <button
                    type="button"
                    data-board-option="month"
                    onClick={() => setBoardView("month")}
                    className={cn(
                      "h-7 rounded px-2.5 text-[12px] font-medium",
                      boardView === "month" ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    data-board-option="week"
                    onClick={() => setBoardView("week")}
                    className={cn(
                      "h-7 rounded px-2.5 text-[12px] font-medium",
                      boardView === "week" ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Week
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <WorkCategoryKey />
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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                className="field-input h-7 max-w-[220px]"
                placeholder="Search location or job no."
                aria-label="Search jobs"
                data-testid="planner-search"
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
              {boardView === "month" ? (
                <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={showWeekends}
                    onChange={(event) => setShowWeekends(event.target.checked)}
                  />
                  Show weekends
                </label>
              ) : null}
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <PlanningBoard
                  consultants={visibleConsultants}
                  days={days}
                  jobs={jobs}
                  allocationsByCell={allocationsByCell}
                  compact={boardView === "month"}
                  onCategoryMenu={openCategoryMenu}
                  onDateSelect={selectDate}
                  onWeekSelect={(date) => {
                    selectDate(date);
                    setGeoScope("week");
                  }}
                />
              </div>
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
              ) : (
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

function indexAllocations(
  allocations: Allocation[],
  jobs: ReturnType<typeof useTeamPlannerStore.getState>["jobs"],
  search: string,
  priorityFilter: string,
  dueThisWeekOnly: boolean,
  weekStart: string
): Map<string, Allocation[]> {
  const map = new Map<string, Allocation[]>();
  for (const item of allocations) {
    const job = jobs[item.jobId];
    if (!job || !matchesLite(job, search, priorityFilter, dueThisWeekOnly, weekStart)) continue;
    const key = `${item.consultantId}:${item.scheduledDate}`;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.startTime ?? "").localeCompare(b.startTime ?? "")
    );
  }
  return map;
}

function DragCard({ jobId }: { jobId: string }) {
  const job = useTeamPlannerStore((state) => state.jobs[jobId]);
  if (!job) return null;
  const category = workCategoryMeta(job.workCategory);
  return (
    <div
      className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold shadow-md"
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
