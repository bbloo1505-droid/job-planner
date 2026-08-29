"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { PlannerCell } from "@/components/team-planner/PlannerCell";
import { formatHours } from "@/lib/team/schedule";
import {
  isWeekStartColumn,
  monthColumnLabel,
  scrollAnchorForMonth,
  weekGroupLabel,
} from "@/lib/team/month";
import { columnLabel, isoDate } from "@/lib/team/week";
import { useTeamPlannerStore } from "@/lib/store/team-planner-store";
import type { Allocation, Consultant, Job } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAME_COL = 176;
const MONTH_COL = 166;

export function PlanningBoard({
  consultants,
  days,
  jobs,
  allocationsByCell,
  compact,
  onCategoryMenu,
  onDateSelect,
  onWeekSelect,
}: {
  consultants: Consultant[];
  days: Date[];
  jobs: Record<string, Job>;
  allocationsByCell: Map<string, Allocation[]>;
  compact: boolean;
  onCategoryMenu: (jobId: string, position: { x: number; y: number }) => void;
  onDateSelect: (date: string) => void;
  onWeekSelect?: (date: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScrollKey = useRef<string | null>(null);
  const selectedDate = useTeamPlannerStore((state) => state.selectedDate);
  const selectConsultant = useTeamPlannerStore((state) => state.selectConsultant);
  const focusTarget = useTeamPlannerStore((state) => state.focusTarget);
  const monthStart = useTeamPlannerStore((state) => state.monthStart);
  const boardView = useTeamPlannerStore((state) => state.boardView);
  const showWeekends = useTeamPlannerStore((state) => state.showWeekends);
  const todayIso = todayDateIso();

  const dayIsos = useMemo(() => days.map(isoDate), [days]);
  const stats = useMemo(
    () => consultantPeriodStats(consultants, dayIsos, allocationsByCell, jobs),
    [allocationsByCell, consultants, dayIsos, jobs]
  );

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !focusTarget) return;
    const cell =
      (focusTarget.consultantId &&
        root.querySelector<HTMLElement>(
          `[data-cell="${focusTarget.consultantId}:${focusTarget.date}"]`
        )) ||
      root.querySelector<HTMLElement>(`[data-date-col="${focusTarget.date}"]`);
    cell?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [focusTarget]);

  useEffect(() => {
    const root = scrollRef.current;
    const key = `${boardView}:${monthStart}:${showWeekends}`;
    if (!root || boardView !== "month" || initialScrollKey.current === key) return;
    initialScrollKey.current = key;
    const anchor = scrollAnchorForMonth(monthStart, showWeekends, new Date());
    const header = root.querySelector<HTMLElement>(`[data-date-col="${anchor}"]`);
    header?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [boardView, monthStart, showWeekends]);

  return (
    <div
      ref={scrollRef}
      className="prensa-planner-scroll h-full min-h-0 overflow-x-scroll overflow-y-auto"
      data-testid="planning-board"
      data-board-view={boardView}
      data-month={monthStart.slice(0, 7)}
      onWheel={(event) => {
        if (!event.shiftKey) return;
        event.currentTarget.scrollLeft += event.deltaY;
        event.preventDefault();
      }}
    >
      <div
        className={cn("grid", compact ? "min-w-max" : "min-w-full")}
        style={{
          gridTemplateColumns: compact
            ? `${NAME_COL}px repeat(${days.length}, ${MONTH_COL}px)`
            : `${NAME_COL}px repeat(${days.length}, minmax(140px, 1fr))`,
        }}
        role="grid"
        aria-label={compact ? "Monthly allocation board" : "Weekly allocation board"}
      >
        <div className="prensa-planner-corner px-3 py-1.5 text-[11px] font-medium text-slate-500">
          Consultant
        </div>
        {days.map((day, index) => {
          const iso = isoDate(day);
          const label = compact ? monthColumnLabel(day) : columnLabel(day);
          const active = selectedDate === iso;
          const today = iso === todayIso;
          const weekStartCol = compact && isWeekStartColumn(day) && index > 0;
          return (
            <div
              key={iso}
              data-date-col={iso}
              data-week-start={weekStartCol ? "true" : undefined}
              className={cn(
                "prensa-planner-head px-2 py-1.5 text-left",
                weekStartCol && "prensa-planner-week-break",
                active && "bg-brand/[0.10]",
                today && "prensa-planner-today"
              )}
            >
              {weekStartCol && onWeekSelect ? (
                <button
                  type="button"
                  data-week-select={iso}
                  onClick={() => onWeekSelect(iso)}
                  className="mb-0.5 block text-[8.5px] font-semibold tracking-[0.08em] text-slate-400 hover:text-navy"
                >
                  {weekGroupLabel(day)}
                </button>
              ) : weekStartCol ? (
                <span className="mb-0.5 block text-[8.5px] font-semibold tracking-[0.08em] text-slate-400">
                  {weekGroupLabel(day)}
                </span>
              ) : (
                <span className="mb-0.5 block h-[11px]" />
              )}
              <button
                type="button"
                data-date-header={iso}
                onClick={() => onDateSelect(iso)}
                className="block w-full text-left"
              >
                <span className="block text-[10px] font-semibold tracking-[0.08em] text-slate-400">
                  {label.day}
                </span>
                <span className="block text-[12px] font-semibold text-slate-800">{label.date}</span>
              </button>
            </div>
          );
        })}

        {consultants.map((consultant) => (
          <ConsultantRow
            key={consultant.id}
            consultant={consultant}
            days={dayIsos}
            dayDates={days}
            jobs={jobs}
            allocationsByCell={allocationsByCell}
            jobsLabel={stats.get(consultant.id) ?? "0 jobs"}
            compact={compact}
            onSelect={() => selectConsultant(consultant.id)}
            onCategoryMenu={onCategoryMenu}
          />
        ))}
      </div>
    </div>
  );
}

const ConsultantRow = memo(function ConsultantRow({
  consultant,
  days,
  dayDates,
  jobs,
  allocationsByCell,
  jobsLabel,
  compact,
  onSelect,
  onCategoryMenu,
}: {
  consultant: Consultant;
  days: string[];
  dayDates: Date[];
  jobs: Record<string, Job>;
  allocationsByCell: Map<string, Allocation[]>;
  jobsLabel: string;
  compact: boolean;
  onSelect: () => void;
  onCategoryMenu: (jobId: string, position: { x: number; y: number }) => void;
}) {
  const selected = useTeamPlannerStore((state) => state.selectedConsultantId === consultant.id);
  return (
    <>
      <button
        type="button"
        data-consultant-row={consultant.id}
        onClick={onSelect}
        className={cn(
          "prensa-planner-name px-3 py-1.5 text-left",
          selected && "bg-brand/[0.06]"
        )}
      >
        <span className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: consultant.displayColour }}
          />
          <span className="truncate text-[13px] font-medium text-slate-900">{consultant.name}</span>
        </span>
        <span className="mt-0.5 block text-[10.5px] text-slate-400">{jobsLabel}</span>
      </button>
      {days.map((date, index) => (
        <PlannerCell
          key={`${consultant.id}-${date}`}
          consultant={consultant}
          date={date}
          jobs={jobs}
          compact={compact}
          weekBreak={compact && index > 0 && isWeekStartColumn(dayDates[index])}
          onCategoryMenu={onCategoryMenu}
          allocations={allocationsByCell.get(`${consultant.id}:${date}`) ?? []}
        />
      ))}
    </>
  );
});

function consultantPeriodStats(
  consultants: Consultant[],
  days: string[],
  allocationsByCell: Map<string, Allocation[]>,
  jobs: Record<string, Job>
): Map<string, string> {
  const daySet = new Set(days);
  const stats = new Map<string, string>();
  for (const consultant of consultants) {
    let count = 0;
    let minutes = 0;
    for (const date of daySet) {
      const items = allocationsByCell.get(`${consultant.id}:${date}`) ?? [];
      count += items.length;
      for (const item of items) minutes += jobs[item.jobId]?.estimatedMinutes ?? 0;
    }
    stats.set(
      consultant.id,
      `${count} ${count === 1 ? "job" : "jobs"}${minutes > 0 ? ` · ${formatHours(minutes)}` : ""}`
    );
  }
  return stats;
}

function todayDateIso(): string {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

