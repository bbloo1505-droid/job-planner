"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  buildTeamReport,
  type ReportPeriod,
  type ReportSlice,
} from "@/lib/reports/team-analytics";
import { formatDuration } from "@/lib/route-summary";
import { useTeamPlannerStore } from "@/lib/store/team-planner-store";
import { cn } from "@/lib/utils";

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All jobs" },
];

export function ReportsApp() {
  const jobs = useTeamPlannerStore((state) => state.jobs);
  const allocations = useTeamPlannerStore((state) => state.allocations);
  const weekStart = useTeamPlannerStore((state) => state.weekStart);
  const monthStart = useTeamPlannerStore((state) => state.monthStart);
  const [period, setPeriod] = useState<ReportPeriod>("week");
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const report = useMemo(
    () =>
      buildTeamReport({
        jobs,
        allocations,
        period,
        weekStart,
        monthStart,
      }),
    [jobs, allocations, period, weekStart, monthStart]
  );

  return (
    <AppShell>
      <div
        className="h-full overflow-y-auto bg-canvas"
        data-page="reports"
        data-period={period}
        data-client={clientReady ? "ready" : "ssr"}
      >
        <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-7">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-5">
            <h1 className="text-[20px] font-semibold tracking-tight text-slate-900 md:text-[22px]">
              Reports & Analytics
            </h1>
            <div className="relative inline-flex">
              <select
                aria-label="Report period"
                data-testid="report-period"
                value={period}
                onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
                className="h-9 appearance-none rounded-xl border border-hairline bg-white py-0 pr-9 pl-3 text-[13px] font-medium text-slate-800 shadow-card outline-none transition-colors hover:border-slate-300 focus:border-brand focus:ring-3 focus:ring-brand/15"
              >
                {PERIODS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-slate-400" />
            </div>
          </header>

          <section className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-5">
            <KpiCard label="Total Jobs" value={String(report.totalJobs)} />
            <KpiCard label="Scheduled Jobs" value={String(report.scheduledJobs)} />
            <KpiCard
              label="Unassigned Jobs"
              value={String(report.unassignedJobs)}
              valueClass="text-[#e4453a]"
            />
            <KpiCard
              label="At-Risk Jobs"
              value={String(report.atRiskJobs)}
              valueClass="text-[#f7941e]"
            />
            <article className="col-span-2 rounded-2xl bg-white px-3 py-3 shadow-card sm:px-5 sm:py-4 xl:col-span-1">
              <p className="text-[12px] text-slate-500">Estimated Travel Saved</p>
              <p
                className="mt-1 text-[22px] leading-7 font-semibold tabular-nums text-[#22a05a] sm:text-[28px] sm:leading-8"
                data-kpi="travel-saved"
              >
                {report.travelSavedKm} km
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-slate-500">
                <Clock className="size-3.5" strokeWidth={1.75} />
                <span data-kpi="travel-time">{formatDuration(report.travelSavedMinutes)}</span>
              </p>
            </article>
          </section>

          <section className="grid gap-3 lg:grid-cols-3">
            <article className="rounded-2xl bg-white p-5 shadow-card">
              <h2 className="mb-4 text-[14px] font-semibold text-slate-900">Jobs by Priority</h2>
              <DonutChart slices={report.byPriority} />
            </article>
            <article className="rounded-2xl bg-white p-5 shadow-card">
              <h2 className="mb-1 text-[14px] font-semibold text-slate-900">Jobs by Status</h2>
              <p className="mb-4 text-[11px] leading-4 text-slate-400">
                Same colour language as the QLD Planning Board.
              </p>
              <DonutChart slices={report.byStatus} legend="key" />
            </article>
            <article className="rounded-2xl bg-white p-5 shadow-card">
              <h2 className="mb-4 text-[14px] font-semibold text-slate-900">Top Locations</h2>
              {report.topLocations.length === 0 ? (
                <p className="text-[13px] text-slate-500">No field jobs in this period.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {report.topLocations.map((item) => (
                    <li
                      key={item.name}
                      className="flex items-center justify-between py-2.5 text-[13.5px]"
                    >
                      <span className="text-slate-700">{item.name}</span>
                      <span className="tabular-nums font-medium text-slate-900">{item.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <article className="rounded-2xl bg-white px-3 py-3 shadow-card sm:px-5 sm:py-4">
      <p className="text-[12px] text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-[22px] leading-7 font-semibold tabular-nums text-slate-900 sm:text-[28px] sm:leading-8",
          valueClass
        )}
        data-kpi={label}
      >
        {value}
      </p>
    </article>
  );
}

function DonutChart({
  slices,
  legend = "dot",
}: {
  slices: ReportSlice[];
  legend?: "dot" | "key";
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:gap-5">
      <svg viewBox="0 0 100 100" className="mx-auto size-[112px] shrink-0 sm:mx-0 sm:size-[132px]" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#eef2f6"
          strokeWidth="14"
        />
        {total > 0
          ? slices.map((slice) => {
              const length = (slice.value / total) * circumference;
              const node = (
                <circle
                  key={slice.key}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="14"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                />
              );
              offset += length;
              return node;
            })
          : null}
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
        {slices.map((slice) => (
          <li
            key={slice.key}
            className="flex items-center justify-between gap-3 text-[13px]"
            data-report-slice={slice.key}
            data-report-color={slice.color}
          >
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span
                className={
                  legend === "key"
                    ? "inline-block h-4 min-w-4 shrink-0 rounded-[2px] px-1.5"
                    : "size-2.5 shrink-0 rounded-full"
                }
                style={{ background: slice.color }}
                aria-hidden
              />
              {slice.label}
            </span>
            <span className="shrink-0 tabular-nums text-slate-900">
              {slice.value}{" "}
              <span className="text-slate-400">({slice.percent}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
