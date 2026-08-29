"use client";

import {
  AlertTriangle,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { constraintLabel } from "@/lib/format";
import { useDayRouteStore } from "@/lib/store/day-route-store";
import { cn } from "@/lib/utils";

const AUTO_DISMISS_MS = 6000;

export function RouteStatusBar() {
  const needsRecalculate = useDayRouteStore((state) => state.needsRecalculate);
  const lastConstraintJobId = useDayRouteStore((state) => state.lastConstraintJobId);
  const jobs = useDayRouteStore((state) => state.jobs);
  const stops = useDayRouteStore((state) => state.plan.stops);
  const recalculate = useDayRouteStore((state) => state.recalculate);
  const selectJob = useDayRouteStore((state) => state.selectJob);
  const message = useDayRouteStore((state) => state.impactMessage);
  const impact = useDayRouteStore((state) => state.lastImpact);
  const dismissImpact = useDayRouteStore((state) => state.dismissImpact);

  const failed = Boolean(impact?.exceedsWorkingDay);

  useEffect(() => {
    if (!message || failed) return;
    const timer = setTimeout(dismissImpact, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, failed, dismissImpact]);

  if (needsRecalculate) {
    const job = lastConstraintJobId ? jobs[lastConstraintJobId] : undefined;
    const label = job ? lowerFirst(constraintLabel(job.constraint)) : null;
    return (
      <Bar className="border-amber-200 bg-amber-50/70">
        <p className="flex min-w-0 items-center gap-2 text-amber-900">
          <RotateCcw className="size-3.5 shrink-0" strokeWidth={2} />
          <span className="truncate">
            {job && label ? (
              <>
                <span className="font-semibold">{job.suburb}</span> availability
                changed to {label}
              </>
            ) : (
              "Day settings changed — recalculate to update the order and times"
            )}
          </span>
        </p>
        <Button
          type="button"
          size="sm"
          className="h-7 shrink-0 bg-amber-600 px-2.5 text-white hover:bg-amber-700"
          onClick={recalculate}
        >
          Recalculate route
        </Button>
      </Bar>
    );
  }

  if (!message) return null;

  const improved = (impact?.deltaMinutes ?? 0) < 0 && !failed;
  const Icon = failed ? AlertTriangle : improved ? TrendingDown : TrendingUp;
  const conflictStop = failed ? stops.find((stop) => stop.conflict) : undefined;
  const conflictJob = conflictStop ? jobs[conflictStop.jobId] : undefined;

  return (
    <Bar
      className={cn(
        failed
          ? "border-rose-200 bg-rose-50/70 text-rose-800"
          : improved
            ? "border-prensa-green/40 bg-prensa-green/[0.08] text-prensa-green-ink"
            : "border-hairline bg-slate-50 text-slate-700"
      )}
    >
      <p className="flex min-w-0 items-center gap-2">
        <Icon className="size-3.5 shrink-0" strokeWidth={2} />
        <span className="truncate font-medium">{message}</span>
      </p>
      <span className="flex shrink-0 items-center gap-1">
        {conflictJob ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2.5"
            onClick={() => selectJob(conflictJob.id, "stop")}
          >
            Review {conflictJob.suburb}
          </Button>
        ) : null}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismissImpact}
          className="flex size-6 items-center justify-center rounded text-current/50 transition-colors hover:bg-black/5 hover:text-current"
        >
          <X className="size-3" />
        </button>
      </span>
    </Bar>
  );
}

function Bar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-hairline bg-white px-7 py-2">
      <div
        className={cn(
          "flex h-9 items-center justify-between gap-3 rounded-md border px-3 text-[12.5px]",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
