"use client";

import { format } from "date-fns";
import { ArrowRight, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { safeDate } from "@/lib/format";
import { useDayRouteStore } from "@/lib/store/day-route-store";

export function PlanDayForm() {
  const settings = useDayRouteStore((state) => state.plan.settings);
  const jobs = useDayRouteStore((state) => state.jobs);
  const pendingJobIds = useDayRouteStore((state) => state.pendingJobIds);
  const updateSettings = useDayRouteStore((state) => state.updateSettings);
  const bulkAddAddresses = useDayRouteStore((state) => state.bulkAddAddresses);
  const addPendingAddress = useDayRouteStore((state) => state.addPendingAddress);
  const updatePendingJob = useDayRouteStore((state) => state.updatePendingJob);
  const removePendingJob = useDayRouteStore((state) => state.removePendingJob);
  const runOptimise = useDayRouteStore((state) => state.runOptimise);
  const [pasteText, setPasteText] = useState("");

  const pendingJobs = pendingJobIds.map((id) => jobs[id]).filter(Boolean);
  const readyCount = pendingJobs.filter((job) => job.address.trim()).length;
  const hasProperties = pendingJobs.length > 0;
  const date = safeDate(settings.date);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="shrink-0 border-b border-hairline bg-white px-7 pt-4 pb-3.5">
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
          Paste the properties you need to visit and we&apos;ll suggest an efficient
          order and appointment times to offer tenants.
        </p>
      </header>

      <div className="shrink-0 border-b border-hairline bg-white px-7 py-3">
        <div className="flex flex-wrap items-end gap-x-3.5 gap-y-3">
          <Field label="Date" width="w-[136px]">
            <input
              type="date"
              className="field-input"
              value={settings.date}
              onChange={(event) => updateSettings({ date: event.target.value })}
            />
          </Field>
          <Field label="Start" width="w-[164px]">
            <input
              className="field-input"
              value={settings.startLocation}
              onChange={(event) =>
                updateSettings({ startLocation: event.target.value })
              }
            />
          </Field>
          <Field label="Start time" width="w-[104px]">
            <input
              type="time"
              className="field-input"
              value={settings.startTime}
              onChange={(event) => updateSettings({ startTime: event.target.value })}
            />
          </Field>
          <Field label="Finish" width="w-[164px]">
            <input
              className="field-input"
              value={settings.finishLocation ?? ""}
              onChange={(event) =>
                updateSettings({ finishLocation: event.target.value })
              }
            />
          </Field>
          <Field label="Day ends" width="w-[104px]">
            <input
              type="time"
              className="field-input"
              value={settings.workingHoursEnd}
              onChange={(event) =>
                updateSettings({ workingHoursEnd: event.target.value })
              }
            />
          </Field>
          <Field label="Visit" width="w-[86px]">
            <input
              type="number"
              min={5}
              step={5}
              className="field-input"
              value={settings.visitDurationMinutes}
              onChange={(event) =>
                updateSettings({
                  visitDurationMinutes: Number(event.target.value) || 20,
                })
              }
            />
          </Field>
          <Field label="Buffer" width="w-[86px]">
            <input
              type="number"
              min={0}
              step={5}
              className="field-input"
              value={settings.travelBufferMinutes}
              onChange={(event) =>
                updateSettings({
                  travelBufferMinutes: Number(event.target.value) || 0,
                })
              }
            />
          </Field>
          <Field label="Round to" width="w-[112px]">
            <select
              className="field-input"
              value={settings.roundToMinutes}
              onChange={(event) =>
                updateSettings({
                  roundToMinutes: Number(event.target.value) === 30 ? 30 : 15,
                })
              }
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-7 py-4">
        <div className="mx-auto grid w-full max-w-[1240px] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="panel">
            <div className="border-b border-hairline px-4 py-2.5">
              <h2 className="panel-heading">Properties to visit</h2>
            </div>

            {hasProperties ? (
              <ul className="divide-y divide-hairline">
                {pendingJobs.map((job, index) => (
                  <li
                    key={job.id}
                    className="grid h-11 grid-cols-[26px_132px_minmax(0,1fr)_32px] items-center gap-1.5 px-3"
                  >
                    <span className="text-right text-[11px] text-slate-400 tabular-nums">
                      {index + 1}
                    </span>
                    <span
                      className={
                        job.suburb && job.suburb !== "Unknown"
                          ? "truncate text-[13px] font-medium text-slate-900"
                          : "truncate text-[13px] text-slate-400"
                      }
                    >
                      {job.suburb && job.suburb !== "Unknown" ? job.suburb : "—"}
                    </span>
                    <input
                      value={job.address}
                      placeholder="12 Example St, Indooroopilly"
                      aria-label={`Address ${index + 1}`}
                      onChange={(event) =>
                        updatePendingJob(job.id, event.target.value)
                      }
                      className="h-8 w-full rounded-md border border-hairline bg-white px-2 text-[13px] text-slate-700 transition-colors outline-none hover:border-slate-300 focus:border-brand focus:text-slate-900 focus:ring-3 focus:ring-brand/15"
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${job.suburb ?? "property"}`}
                      title="Remove property"
                      onClick={() => removePendingJob(job.id)}
                      className="flex size-7 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] font-medium text-slate-700">
                  No properties yet
                </p>
                <p className="mt-1 text-[12.5px] text-slate-500">
                  Paste your address list to build the day, one per line.
                </p>
              </div>
            )}

            <div className="border-t border-hairline px-2 py-1.5">
              <button
                type="button"
                onClick={() => addPendingAddress()}
                className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
              >
                <Plus className="size-3.5" />
                Add another property
              </button>
            </div>
          </section>

          <section className={hasProperties ? "panel" : "panel order-first xl:order-none"}>
            <div className="border-b border-hairline px-4 py-2.5">
              <h2 className="panel-heading">
                {hasProperties ? "Add more properties" : "Add properties"}
              </h2>
            </div>
            <div className="p-3">
              <textarea
                rows={4}
                className="w-full resize-y rounded-lg border border-hairline bg-white px-2.5 py-2 text-[12.5px] leading-relaxed text-slate-800 transition-colors outline-none hover:border-slate-300 focus:border-brand focus:ring-3 focus:ring-brand/15"
                placeholder={
                  hasProperties
                    ? "Paste additional addresses — one per line"
                    : "Paste addresses — one per line"
                }
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full"
                disabled={!pasteText.trim()}
                onClick={() => {
                  bulkAddAddresses(pasteText);
                  setPasteText("");
                }}
              >
                Add properties
              </Button>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Synthetic data only — addresses stay on this device.
              </p>
            </div>
          </section>
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-hairline bg-white px-7 py-3">
        <p className="text-[13px] text-slate-500">
          <span className="font-semibold text-slate-900 tabular-nums">
            {readyCount}
          </span>{" "}
          {readyCount === 1 ? "property" : "properties"} ready
        </p>
        <Button
          type="button"
          size="lg"
          disabled={readyCount === 0}
          onClick={runOptimise}
          className="bg-brand px-5 text-white hover:bg-brand-strong"
        >
          Optimise my day
          <ArrowRight />
        </Button>
      </footer>
    </div>
  );
}

function Field({
  label,
  width,
  children,
}: {
  label: string;
  width: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`${width} space-y-1`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
