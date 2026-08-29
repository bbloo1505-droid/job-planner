"use client";

import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useState } from "react";
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
      <header className="shrink-0 border-b border-slate-200/70 bg-white px-7 pt-5 pb-4">
        <p className="eyebrow">Day Route Planner</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-[22px] leading-none font-semibold tracking-tight text-slate-900">
            {date ? `Plan ${format(date, "EEEE")}` : "Plan your day"}
          </h1>
          {date ? (
            <span className="text-[13px] text-slate-500">
              {format(date, "d MMMM yyyy")}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[13px] text-slate-500">
          Enter today&apos;s properties, set sampling duration, then plan the day.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-7 py-5">
        <div className="mx-auto w-full max-w-[760px] space-y-5">
          <section className="panel">
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
              <Field label="Day start">
                <input
                  type="time"
                  className="field-input"
                  aria-label="Day start"
                  value={settings.startTime}
                  onChange={(event) =>
                    updateSettings({ startTime: event.target.value })
                  }
                />
              </Field>
              <Field label="Day end">
                <input
                  type="time"
                  className="field-input"
                  aria-label="Day end"
                  value={settings.workingHoursEnd ?? "16:00"}
                  onChange={(event) =>
                    updateSettings({ workingHoursEnd: event.target.value })
                  }
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  className="field-input"
                  value={settings.date}
                  onChange={(event) => updateSettings({ date: event.target.value })}
                />
              </Field>
              <label className="space-y-1 sm:col-span-3">
                <span className="field-label">Start / finish location</span>
                <input
                  className="field-input"
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
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header flex items-end justify-between gap-3">
              <h2 className="panel-heading">Properties</h2>
              <div className="hidden grid-cols-[minmax(0,1fr)_132px] gap-3 pr-8 text-[10.5px] font-medium tracking-wide text-slate-400 uppercase sm:grid sm:w-[min(100%,520px)]">
                <span>Address</span>
                <span>Duration</span>
              </div>
            </div>
            <p className="border-b border-amber-100 bg-amber-50/70 px-4 py-2 text-[11.5px] leading-relaxed text-amber-900">
              {GEOCODING_PRIVACY_NOTICE}
            </p>

            {isPlanning && planProgress ? (
              <div className="p-4">
                <ResolutionProgress progress={planProgress} />
              </div>
            ) : pendingJobs.length > 0 ? (
              <ul className="space-y-2 p-3">
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
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] font-medium text-slate-700">
                  No properties yet
                </p>
                <p className="mt-1 text-[12.5px] text-slate-500">
                  Add a property or paste a list, one address per line.
                </p>
              </div>
            )}

            {!isPlanning ? (
              <div className="border-t border-hairline px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => addPendingAddress()}
                  className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                >
                  <Plus className="size-3.5" />
                  Add property
                </button>
              </div>
            ) : null}
          </section>

          {!isPlanning ? (
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-heading">Paste addresses</h2>
              </div>
              <div className="p-3">
                <textarea
                  rows={3}
                  className="w-full resize-y rounded-lg border border-hairline bg-white px-2.5 py-2 text-[12.5px] leading-relaxed text-slate-800 transition-colors outline-none hover:border-slate-300 focus:border-brand focus:ring-3 focus:ring-brand/15"
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
            </section>
          ) : null}
        </div>
      </div>

      <footer className="flex shrink-0 flex-col gap-3 border-t border-hairline bg-white px-7 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-slate-500">
          <span className="font-semibold text-slate-900 tabular-nums">
            {typedCount}
          </span>{" "}
          {typedCount === 1 ? "property" : "properties"} ready to plan
        </p>
        <Button
          type="button"
          size="lg"
          disabled={typedCount === 0 || isPlanning}
          onClick={() => void planMyDay()}
          data-testid="plan-my-day"
          className="h-11 w-full bg-brand px-8 text-[15px] font-semibold text-white hover:bg-brand-strong sm:w-auto"
        >
          {isPlanning ? "Planning…" : "Plan my day"}
        </Button>
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
