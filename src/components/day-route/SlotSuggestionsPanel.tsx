"use client";

import { ArrowLeft, Phone } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { formatDisplayTime } from "@/lib/routing/round-time";
import { getSlotSuggestions } from "@/lib/routing/slot-suggestions";
import { useDayRouteStore } from "@/lib/store/day-route-store";

export function SlotSuggestionsPanel() {
  const selectedJobId = useDayRouteStore((state) => state.selectedJobId);
  const selectedKind = useDayRouteStore((state) => state.selectedKind);
  const jobs = useDayRouteStore((state) => state.jobs);
  const stops = useDayRouteStore((state) => state.plan.stops);
  const settings = useDayRouteStore((state) => state.plan.settings);
  const applySlotSuggestion = useDayRouteStore((state) => state.applySlotSuggestion);
  const selectJob = useDayRouteStore((state) => state.selectJob);

  const job =
    selectedKind === "unbooked" && selectedJobId ? jobs[selectedJobId] : undefined;
  const routeJobs = stops.map((stop) => jobs[stop.jobId]).filter(Boolean);

  const suggestions = useMemo(() => {
    if (!job) return [];
    return getSlotSuggestions({
      job,
      routeJobs,
      settings,
      existingStops: stops,
    });
  }, [job, routeJobs, settings, stops]);

  if (!job) return null;

  const [best, ...rest] = suggestions;

  return (
    <section className="panel animate-in fade-in slide-in-from-right-1 duration-150">
      <div className="panel-header">
        <button
          type="button"
          onClick={() => selectJob(null)}
          className="mb-1.5 flex items-center gap-1 rounded text-[11px] text-slate-400 transition-colors hover:text-slate-700 focus-visible:ring-3 focus-visible:ring-brand/25 focus-visible:outline-none"
        >
          <ArrowLeft className="size-3" />
          All opportunities
        </button>
        <h2 className="panel-heading flex items-center gap-1.5">
          <Phone className="size-3.5 text-slate-400" strokeWidth={2} />
          Best times to offer
        </h2>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">
          {job.suburb} · {job.address}
        </p>
      </div>

      {suggestions.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12.5px] text-slate-400">
          No feasible slots inside the current working day.
        </p>
      ) : (
        <div className="p-3">
          {best ? (
            <div className="soft-card border-brand/20 bg-brand/[0.04] p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[26px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">
                  {formatDisplayTime(best.appointmentTime)}
                </span>
                <span className="rounded-full bg-prensa-green/15 px-2 py-0.5 text-[9.5px] font-semibold tracking-[0.06em] text-prensa-green-ink uppercase">
                  Best fit
                </span>
              </div>
              <p className="mt-1.5 text-[12px] text-slate-500 tabular-nums">
                {impactLabel(best.routeImpactMinutes)}
                {best.hasConflict ? " · tight fit" : ""}
              </p>
              <Button
                type="button"
                className="mt-2.5 h-9 w-full bg-brand text-white hover:bg-brand-strong"
                onClick={() => applySlotSuggestion(job.id, best)}
              >
                Use {formatDisplayTime(best.appointmentTime)}
              </Button>
            </div>
          ) : null}

          {rest.length > 0 ? (
            <ul className="mt-1 divide-y divide-hairline">
              {rest.map((suggestion) => (
                <li
                  key={`${suggestion.appointmentTime}-${suggestion.insertionIndex}`}
                  className="flex items-center justify-between gap-3 px-1 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] leading-tight font-semibold text-slate-900 tabular-nums">
                      {formatDisplayTime(suggestion.appointmentTime)}
                    </p>
                    <p className="text-[11.5px] text-slate-500 tabular-nums">
                      {impactLabel(suggestion.routeImpactMinutes)}
                      {suggestion.hasConflict ? " · tight fit" : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applySlotSuggestion(job.id, suggestion)}
                  >
                    Use
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}

function impactLabel(minutes: number): string {
  if (minutes === 0) return "No extra driving";
  if (minutes < 0) return `${Math.abs(minutes)} min less driving`;
  return `+${minutes} min driving`;
}
