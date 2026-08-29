"use client";

import { Pencil, X } from "lucide-react";
import { AddressSearchField } from "@/components/day-route/AddressSearchField";
import { SamplingDurationField } from "@/components/day-route/SamplingDurationField";
import { jobHasResolvedLocation } from "@/lib/geo";
import {
  addressRegionSuffix,
  streetAndSuburbLabel,
} from "@/lib/geocoding/address-label";
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
  const heading = streetAndSuburbLabel(job);
  const region = addressRegionSuffix(job.resolvedDisplayAddress ?? job.address);
  const warning =
    stale
      ? "Address changed — will resolve when you plan the day"
      : needsConfirmation
        ? "Needs confirmation"
        : job.geocodingStatus === "not_found"
          ? "Could not locate this address"
          : null;

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500 tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            <div className="min-w-0 flex-1">
              {confirmed ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold tracking-tight text-slate-900">
                      {heading}
                    </p>
                    {region ? (
                      <p className="mt-0.5 truncate text-[12px] text-slate-500">
                        {region}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => changeJobAddress(job.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-brand"
                  >
                    <Pencil className="size-3" strokeWidth={1.75} />
                    Edit
                  </button>
                </div>
              ) : (
                <AddressSearchField
                  query={job.address}
                  onQueryChange={(value) => updatePendingJob(job.id, value)}
                  onPick={(result) => confirmGeocodedAddress(job.id, result)}
                  onNotFound={() => markAddressNotFound(job.id)}
                  inputAriaLabel={`Address ${index + 1}`}
                />
              )}
              {warning ? (
                <p className="mt-1.5 text-[11.5px] text-amber-700">{warning}</p>
              ) : null}
            </div>
            <div className="shrink-0 lg:pt-0.5">
              <SamplingDurationField
                compact
                minutes={duration}
                onChange={(value) => updateSamplingDuration(job.id, value)}
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label={`Remove ${heading}`}
          title="Remove property"
          onClick={() => removePendingJob(job.id)}
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </li>
  );
}
