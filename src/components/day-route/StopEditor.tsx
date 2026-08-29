"use client";

import { AlertTriangle, CalendarOff, Check, X } from "lucide-react";
import { AddressSearchField } from "@/components/day-route/AddressSearchField";
import { BookingStatusText } from "@/components/day-route/BookingStatusBadge";
import { Button } from "@/components/ui/button";
import { SamplingDurationField } from "@/components/day-route/SamplingDurationField";
import { jobHasResolvedLocation } from "@/lib/geo";
import { formatDisplayTime } from "@/lib/routing/round-time";
import { samplingDurationOf } from "@/lib/routing/sampling";
import { useDayRouteStore } from "@/lib/store/day-route-store";
import type {
  AppointmentConstraint,
  BookingStatus,
  GeocodingResult,
  Job,
  RouteStop,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: BookingStatus; label: string; active: string }[] = [
  {
    value: "uncontacted",
    label: "Uncontacted",
    active: "border-slate-400 bg-slate-100 text-slate-700",
  },
  {
    value: "contact_attempted",
    label: "Attempted",
    active: "border-amber-300 bg-amber-50 text-amber-800",
  },
  {
    value: "tentatively_booked",
    label: "Tentative",
    active: "border-brand/40 bg-brand/[0.08] text-brand-strong",
  },
  {
    value: "confirmed",
    label: "Confirmed",
    active: "border-prensa-green/50 bg-prensa-green/[0.12] text-prensa-green-ink",
  },
  {
    value: "unable_to_contact",
    label: "Unavailable",
    active: "border-rose-200 bg-rose-50 text-rose-700",
  },
  {
    value: "complete",
    label: "Complete",
    active: "border-slate-400 bg-slate-100 text-slate-700",
  },
];

const CONSTRAINT_OPTIONS: {
  value: AppointmentConstraint["type"];
  label: string;
}[] = [
  { value: "flexible", label: "Flexible" },
  { value: "fixed", label: "Fixed" },
  { value: "after", label: "After" },
  { value: "before", label: "Before" },
  { value: "between", label: "Between" },
];

export function StopEditor() {
  const selectedJobId = useDayRouteStore((state) => state.selectedJobId);
  const jobs = useDayRouteStore((state) => state.jobs);
  const stops = useDayRouteStore((state) => state.plan.stops);
  const updateJobConstraint = useDayRouteStore((state) => state.updateJobConstraint);
  const updateBookingStatus = useDayRouteStore((state) => state.updateBookingStatus);
  const updateJobNotes = useDayRouteStore((state) => state.updateJobNotes);
  const updateSamplingDuration = useDayRouteStore(
    (state) => state.updateSamplingDuration
  );
  const changeJobAddress = useDayRouteStore((state) => state.changeJobAddress);
  const confirmGeocodedAddress = useDayRouteStore(
    (state) => state.confirmGeocodedAddress
  );
  const updatePendingJob = useDayRouteStore((state) => state.updatePendingJob);
  const visitDefault = useDayRouteStore(
    (state) => state.plan.settings.visitDurationMinutes
  );
  const confirmSuggestedTime = useDayRouteStore((state) => state.confirmSuggestedTime);
  const moveOutOfDay = useDayRouteStore((state) => state.moveOutOfDay);
  const selectJob = useDayRouteStore((state) => state.selectJob);

  const job = selectedJobId ? jobs[selectedJobId] : undefined;
  const stop = stops.find((item) => item.jobId === selectedJobId);
  if (!job || !stop) return null;

  return (
    <StopEditorForm
      job={job}
      stop={stop}
      totalStops={stops.length}
      updateJobConstraint={updateJobConstraint}
      updateBookingStatus={updateBookingStatus}
      updateJobNotes={updateJobNotes}
      updateSamplingDuration={updateSamplingDuration}
      changeJobAddress={changeJobAddress}
      confirmGeocodedAddress={confirmGeocodedAddress}
      updatePendingJob={updatePendingJob}
      visitDefault={visitDefault}
      confirmSuggestedTime={confirmSuggestedTime}
      moveOutOfDay={moveOutOfDay}
      selectJob={selectJob}
    />
  );
}

function StopEditorForm({
  job,
  stop,
  totalStops,
  updateJobConstraint,
  updateBookingStatus,
  updateJobNotes,
  updateSamplingDuration,
  changeJobAddress,
  confirmGeocodedAddress,
  updatePendingJob,
  visitDefault,
  confirmSuggestedTime,
  moveOutOfDay,
  selectJob,
}: {
  job: Job;
  stop: RouteStop;
  totalStops: number;
  updateJobConstraint: (jobId: string, constraint: AppointmentConstraint) => void;
  updateBookingStatus: (jobId: string, status: BookingStatus) => void;
  updateJobNotes: (jobId: string, notes: string) => void;
  updateSamplingDuration: (jobId: string, minutes: number) => void;
  changeJobAddress: (jobId: string) => void;
  confirmGeocodedAddress: (jobId: string, result: GeocodingResult) => void;
  updatePendingJob: (jobId: string, address: string) => void;
  visitDefault: number;
  confirmSuggestedTime: (jobId: string) => void;
  moveOutOfDay: (stopId: string) => void;
  selectJob: (jobId: string | null) => void;
}) {
  const constraintType = job.constraint.type;
  const timeValue =
    job.constraint.type === "between"
      ? job.constraint.start
      : job.constraint.type === "flexible"
        ? ""
        : job.constraint.time;
  const endValue = job.constraint.type === "between" ? job.constraint.end : "";
  const isConfirmed = job.bookingStatus === "confirmed";
  const blocking = stop.conflict?.code === "exceeds_working_day";

  function setConstraintType(type: AppointmentConstraint["type"]) {
    if (type === "flexible") {
      updateJobConstraint(job.id, { type: "flexible" });
      return;
    }
    const fallback = stop.suggestedArrival ?? "09:00";
    if (type === "between") {
      updateJobConstraint(job.id, {
        type: "between",
        start: timeValue || fallback,
        end: "16:00",
      });
      return;
    }
    updateJobConstraint(job.id, { type, time: timeValue || fallback });
  }

  function setTime(next: string) {
    if (constraintType === "flexible" || !next) return;
    if (constraintType === "between") {
      updateJobConstraint(job.id, {
        type: "between",
        start: next,
        end: endValue || "16:00",
      });
      return;
    }
    updateJobConstraint(job.id, { type: constraintType, time: next });
  }

  return (
    <section className="panel animate-in fade-in slide-in-from-right-1 duration-150">
      <div className="panel-header flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow">
            Stop {stop.order + 1} of {totalStops}
          </p>
          <h2 className="mt-1 truncate text-[15px] font-semibold tracking-tight text-slate-900">
            {jobHasResolvedLocation(job)
              ? job.suburb
              : "Location not resolved"}
          </h2>
          <p className="truncate text-[12px] text-slate-500">
            {job.resolvedDisplayAddress ?? job.address}
          </p>
          {jobHasResolvedLocation(job) ? (
            <button
              type="button"
              onClick={() => changeJobAddress(job.id)}
              className="mt-1 text-[11.5px] font-medium text-brand hover:text-brand-strong"
            >
              Change address
            </button>
          ) : (
            <div className="mt-2">
              <p className="mb-1.5 text-[11.5px] text-amber-700">
                Address changed — resolve again
              </p>
              <AddressSearchField
                query={job.address}
                onQueryChange={(value) => updatePendingJob(job.id, value)}
                onPick={(result) => confirmGeocodedAddress(job.id, result)}
                inputAriaLabel="Address to resolve"
              />
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Close stop editor"
          onClick={() => selectJob(null)}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex items-baseline justify-between gap-2 border-b border-hairline px-4 py-2.5">
        <span className="text-[26px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">
          {stop.suggestedArrival ? formatDisplayTime(stop.suggestedArrival) : "—"}
        </span>
        <BookingStatusText status={job.bookingStatus} />
      </div>

      {stop.conflict ? (
        <div
          className={cn(
            "flex items-start gap-2 border-b px-4 py-2.5 text-[12px]",
            blocking
              ? "border-rose-100 bg-rose-50 text-rose-800"
              : "border-amber-100 bg-amber-50 text-amber-900"
          )}
        >
          <AlertTriangle className="mt-px size-3.5 shrink-0" strokeWidth={2} />
          <span>
            {stop.conflict.message} Adjust the availability below or remove it from
            the day.
          </span>
        </div>
      ) : null}

      <div className="space-y-2.5 px-4 py-3">
        <SamplingDurationField
          minutes={samplingDurationOf(job, { visitDurationMinutes: visitDefault })}
          onChange={(value) => updateSamplingDuration(job.id, value)}
        />

        <div>
          <span className="field-label mb-1.5">Tenant availability</span>
          <div className="grid grid-cols-5 gap-1">
            {CONSTRAINT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setConstraintType(option.value)}
                className={cn(
                  "h-7 rounded-md border px-0.5 text-[10.5px] font-medium transition-colors duration-150",
                  constraintType === option.value
                    ? "border-brand bg-brand/[0.08] text-brand-strong"
                    : "border-hairline bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {constraintType !== "flexible" ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="field-label">
                {constraintType === "between" ? "From" : "Time"}
              </span>
              <input
                type="time"
                className="field-input"
                value={timeValue}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
            {constraintType === "between" ? (
              <label className="space-y-1">
                <span className="field-label">To</span>
                <input
                  type="time"
                  className="field-input"
                  value={endValue}
                  onChange={(event) =>
                    updateJobConstraint(job.id, {
                      type: "between",
                      start: timeValue || "09:00",
                      end: event.target.value,
                    })
                  }
                />
              </label>
            ) : null}
          </div>
        ) : null}

        <div>
          <span className="field-label mb-1.5">Booking status</span>
          <div className="grid grid-cols-3 gap-1">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateBookingStatus(job.id, option.value)}
                className={cn(
                  "h-7 rounded-md border px-0.5 text-[10.5px] font-medium transition-colors duration-150",
                  job.bookingStatus === option.value
                    ? option.active
                    : "border-hairline bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {stop.suggestedArrival ? (
          <Button
            type="button"
            disabled={isConfirmed}
            className="h-10 w-full bg-brand text-[13px] text-white hover:bg-brand-strong disabled:bg-prensa-green/15 disabled:text-prensa-green-ink disabled:opacity-100"
            onClick={() => confirmSuggestedTime(job.id)}
          >
            <Check />
            {isConfirmed
              ? `Confirmed for ${formatDisplayTime(stop.suggestedArrival)}`
              : `Confirm ${formatDisplayTime(stop.suggestedArrival)}`}
          </Button>
        ) : null}

        <label className="block space-y-1">
          <span className="field-label">Operational note</span>
          <textarea
            rows={2}
            className="w-full resize-y rounded-lg border border-hairline bg-white px-2.5 py-2 text-[12.5px] text-slate-900 transition-colors outline-none hover:border-slate-300 focus:border-brand focus:ring-3 focus:ring-brand/15"
            value={job.notes ?? ""}
            placeholder="Access details, gate code, site contact role"
            onChange={(event) => updateJobNotes(job.id, event.target.value)}
          />
        </label>
      </div>

      <div className="border-t border-hairline px-2 py-1.5">
        <button
          type="button"
          onClick={() => moveOutOfDay(stop.id)}
          className="flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-[12px] text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
        >
          <CalendarOff className="size-3.5" />
          Move out of this day
        </button>
      </div>
    </section>
  );
}
