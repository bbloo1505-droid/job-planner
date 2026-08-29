"use client";

import { X } from "lucide-react";
import { AddressSearchField } from "@/components/day-route/AddressSearchField";
import { SamplingDurationField } from "@/components/day-route/SamplingDurationField";
import { jobHasResolvedLocation } from "@/lib/geo";
import { samplingDurationOf } from "@/lib/routing/sampling";
import { useDayRouteStore } from "@/lib/store/day-route-store";
import type { Job } from "@/lib/types";

export function PropertyAddressRow({
  job,
  index,
  defaultDuration,
}: {
  job: Job;
  index: number;
  defaultDuration: number;
}) {
  const updatePendingJob = useDayRouteStore((state) => state.updatePendingJob);
  const confirmGeocodedAddress = useDayRouteStore(
    (state) => state.confirmGeocodedAddress
  );
  const changeJobAddress = useDayRouteStore((state) => state.changeJobAddress);
  const markAddressNotFound = useDayRouteStore((state) => state.markAddressNotFound);
  const updateSamplingDuration = useDayRouteStore(
    (state) => state.updateSamplingDuration
  );
  const removePendingJob = useDayRouteStore((state) => state.removePendingJob);

  const confirmed = jobHasResolvedLocation(job);
  const stale = job.geocodingStatus === "stale";
  const needsConfirmation = job.geocodingStatus === "needs_confirmation";
  const duration = samplingDurationOf(job, {
    visitDurationMinutes: defaultDuration,
  });

  return (
    <li className="soft-card space-y-2 px-3.5 py-3">
      <div className="flex items-start gap-1.5">
        <span className="mt-2 w-[22px] shrink-0 text-right text-[11px] text-slate-400 tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          {confirmed ? (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-slate-900">
                  {job.suburb || "Confirmed address"}
                </p>
                <p className="truncate text-[12px] text-slate-500">
                  {job.resolvedDisplayAddress ?? job.address}
                </p>
              </div>
              <button
                type="button"
                onClick={() => changeJobAddress(job.id)}
                className="shrink-0 text-[11.5px] font-medium text-brand hover:text-brand-strong"
              >
                Change address
              </button>
            </div>
          ) : (
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={job.address}
                placeholder="12 Example St, Indooroopilly QLD"
                aria-label={`Address ${index + 1}`}
                onKeyDown={(event) => event.stopPropagation()}
                onChange={(event) => updatePendingJob(job.id, event.target.value)}
                className="h-8 min-w-0 rounded-md border border-hairline bg-white px-2 text-[13px] text-slate-700 outline-none hover:border-slate-300 focus:border-brand focus:text-slate-900 focus:ring-3 focus:ring-brand/15"
              />
              <details className="lg:w-[220px]">
                <summary className="cursor-pointer list-none text-[11.5px] font-medium text-slate-500 hover:text-brand">
                  Find address
                </summary>
                <div className="mt-2">
                  <AddressSearchField
                    query={job.address}
                    onQueryChange={(value) => updatePendingJob(job.id, value)}
                    onPick={(result) => confirmGeocodedAddress(job.id, result)}
                    onNotFound={() => markAddressNotFound(job.id)}
                    inputAriaLabel={`Find address ${index + 1}`}
                    findLabel="Find address"
                  />
                </div>
              </details>
            </div>
          )}

          {stale ? (
            <p className="text-[11.5px] text-amber-700">
              Address changed — will resolve when you plan the day
            </p>
          ) : null}
          {needsConfirmation ? (
            <p className="text-[11.5px] text-amber-700">Needs confirmation</p>
          ) : null}
          {job.geocodingStatus === "not_found" ? (
            <p className="text-[11.5px] text-amber-700">
              Could not locate this address
            </p>
          ) : null}

          <SamplingDurationField
            compact
            minutes={duration}
            onChange={(value) => updateSamplingDuration(job.id, value)}
          />
        </div>
        <button
          type="button"
          aria-label={`Remove ${job.suburb ?? "property"}`}
          title="Remove property"
          onClick={() => removePendingJob(job.id)}
          className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </li>
  );
}
