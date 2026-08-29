"use client";

import { Clock } from "lucide-react";
import { formatDisplayTime } from "@/lib/routing/round-time";
import { samplingDurationOf } from "@/lib/routing/sampling";
import { streetAndSuburbLabel } from "@/lib/geocoding/address-label";
import { useDayRouteStore } from "@/lib/store/day-route-store";

export function SuggestedBookingTimes() {
  const stops = useDayRouteStore((state) => state.plan.stops);
  const jobs = useDayRouteStore((state) => state.jobs);
  const visitDefault = useDayRouteStore(
    (state) => state.plan.settings.visitDurationMinutes
  );

  if (stops.length === 0) return null;

  return (
    <section className="panel" data-testid="suggested-booking-times">
      <div className="panel-header">
        <h2 className="panel-heading">Suggested booking times</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">
          Offer these appointment times to tenants
        </p>
      </div>
      <ol className="space-y-2 p-3">
        {stops.map((stop, index) => {
          const job = jobs[stop.jobId];
          if (!job) return null;
          const duration = samplingDurationOf(job, {
            visitDurationMinutes: visitDefault,
          });
          return (
            <li
              key={stop.id}
              className="soft-card flex items-center gap-3 px-3.5 py-3"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500 tabular-nums">
                {index + 1}
              </span>
              <span className="w-[92px] shrink-0 text-[20px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">
                {stop.suggestedArrival
                  ? formatDisplayTime(stop.suggestedArrival)
                  : "—"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-slate-800">
                  {streetAndSuburbLabel(job)}
                </span>
                <span className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-slate-400">
                  <Clock className="size-3" strokeWidth={1.75} />
                  {duration} min sampling
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
