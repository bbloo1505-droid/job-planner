"use client";

import { format } from "date-fns";
import { ArrowRight, ChevronDown, MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { DayTimingSettings } from "@/components/day-route/DayTimingSettings";
import { PropertyAddressRow } from "@/components/day-route/PropertyAddressRow";
import { ResolutionProgress } from "@/components/day-route/ResolutionProgress";
import { Button } from "@/components/ui/button";
import { safeDate } from "@/lib/format";
import { GEOCODING_PRIVACY_NOTICE } from "@/lib/geocoding/provider";
import { useDayRouteStore } from "@/lib/store/day-route-store";

export function PlanDayForm() {
  const settings = useDayRouteStore((state) => state.plan.settings);
  const jobs = useDayRouteStore((state) => state.jobs);
  const pendingJobIds = useDayRouteStore((state) => state.pendingJobIds);
  const updateSettings = useDayRouteStore((state) => state.updateSettings);
  const bulkAddAddresses = useDayRouteStore((state) => state.bulkAddAddresses);
  const addPendingAddress = useDayRouteStore((state) => state.addPendingAddress);
  const planMyDay = useDayRouteStore((state) => state.planMyDay);
  const isPlanning = useDayRouteStore((state) => state.isPlanning);
  const planProgress = useDayRouteStore((state) => state.planProgress);
  const [pasteText, setPasteText] = useState("");

  const pendingJobs = pendingJobIds.map((id) => jobs[id]).filter(Boolean);
  const typedCount = pendingJobs.filter((job) => job.address.trim()).length;
  const date = safeDate(settings.date);
  const office = settings.startLocation;

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="shrink-0 border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4 px-4 py-4 md:px-6 md:py-5 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <p className="eyebrow">Day Route Planner</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <h1 className="text-[22px] leading-none font-semibold tracking-tight text-slate-900 md:text-[26px]">
                  {date ? `Plan ${format(date, "EEEE")}` : "Plan your day"}
                </h1>
                {date ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-600">
                    {format(date, "d MMM yyyy")}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-end">
              <Field label="Start">
                <input
                  type="time"
                  className="field-input h-10 w-full sm:h-8 sm:w-[7.5rem]"
                  aria-label="Day start"
                  value={settings.startTime}
                  onChange={(event) =>
                    updateSettings({ startTime: event.target.value })
                  }
                />
              </Field>
              <Field label="End">
                <input
                  type="time"
                  className="field-input h-10 w-full sm:h-8 sm:w-[7.5rem]"
                  aria-label="Day end"
                  value={settings.workingHoursEnd ?? "16:00"}
                  onChange={(event) =>
                    updateSettings({ workingHoursEnd: event.target.value })
                  }
                />
              </Field>
              <div className="col-span-2 sm:col-auto">
                <Field label="Date">
                  <input
                    type="date"
                    className="field-input h-10 w-full sm:h-8 sm:w-[10.5rem]"
                    value={settings.date}
                    onChange={(event) => updateSettings({ date: event.target.value })}
                  />
                </Field>
              </div>
            </div>
          </div>
          <label className="block space-y-1">
            <span className="field-label">Start / finish</span>
            <span className="relative block">
              <MapPin className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className="field-input h-10 pl-8 md:h-9"
                aria-label="Start / finish location"
                placeholder="Milton office"
                value={office}
                onChange={(event) => {
                  const value = event.target.value;
                  updateSettings({
                    startLocation: value,
                    finishLocation: value,
                  });
                }}
              />
            </span>
          </label>
          <DayTimingSettings />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 md:px-6 md:py-5 lg:px-8">
        <div className="mx-auto w-full max-w-[920px]">
          <section className="panel">
            <div className="flex items-end justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
              <div>
                <h2 className="panel-heading">Properties</h2>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Type an address, then set time on site.
                </p>
              </div>
              <p className="hidden text-[11px] font-medium tracking-wide text-slate-400 uppercase sm:block">
                Duration · min
              </p>
            </div>

            {isPlanning && planProgress ? (
              <div className="p-5">
                <ResolutionProgress progress={planProgress} />
              </div>
            ) : pendingJobs.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {pendingJobs.map((job, index) => (
                  <PropertyAddressRow
                    key={job.id}
                    job={job}
                    index={index}
                    defaultDuration={settings.visitDurationMinutes}
                  />
                ))}
              </ul>
            ) : (
              <div className="px-5 py-10 text-center">
                <p className="text-[14px] font-semibold text-slate-800">
                  No properties yet
                </p>
                <p className="mt-1 text-[13px] text-slate-500">
                  Add a property or paste a list, one address per line.
                </p>
              </div>
            )}

            {!isPlanning ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-2">
                <button
                  type="button"
                  onClick={() => addPendingAddress()}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
                >
                  <Plus className="size-3.5" />
                  Add property
                </button>
                <details className="min-w-0 flex-1 sm:max-w-[420px]">
                  <summary className="flex h-8 cursor-pointer list-none items-center justify-end gap-1 rounded-lg px-2.5 text-[12px] font-medium text-slate-500 hover:text-slate-800 [&::-webkit-details-marker]:hidden">
                    Paste a list
                    <ChevronDown className="size-3.5" />
                  </summary>
                  <div className="px-2 pb-2">
                    <textarea
                      rows={3}
                      className="mt-1 w-full resize-y rounded-lg border border-hairline bg-white px-2.5 py-2 text-[12.5px] leading-relaxed text-slate-800 transition-colors outline-none hover:border-slate-300 focus:border-brand focus:ring-3 focus:ring-brand/15"
                      placeholder="One address per line"
                      value={pasteText}
                      onChange={(event) => setPasteText(event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2"
                      disabled={!pasteText.trim()}
                      onClick={() => {
                        bulkAddAddresses(pasteText);
                        setPasteText("");
                      }}
                    >
                      Add to list
                    </Button>
                  </div>
                </details>
              </div>
            ) : null}
          </section>
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-slate-400">
            {GEOCODING_PRIVACY_NOTICE}
          </p>
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200/80 bg-white/95 shadow-[0_-8px_24px_-18px_rgb(26_39_68_/_0.35)] backdrop-blur-sm">
        <div
          className="mx-auto flex w-full max-w-[920px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6 lg:px-8"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <p className="text-[13px] text-slate-500">
            <span className="mr-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-navy px-1.5 text-[12px] font-semibold text-white tabular-nums">
              {typedCount}
            </span>
            {typedCount === 1 ? "property ready" : "properties ready"}
          </p>
          <Button
            type="button"
            size="lg"
            disabled={typedCount === 0 || isPlanning}
            onClick={() => void planMyDay()}
            data-testid="plan-my-day"
            className="h-11 w-full gap-2 rounded-xl bg-brand px-7 text-[15px] font-semibold text-white shadow-[0_8px_18px_-10px_rgb(27_122_184_/_0.9)] hover:bg-brand-strong sm:w-auto"
          >
            {isPlanning ? "Planning…" : "Plan my day"}
            {isPlanning ? null : <ArrowRight className="size-4" />}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
