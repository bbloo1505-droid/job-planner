"use client";

import { Check, LoaderCircle } from "lucide-react";
import type { PlanResolveProgress } from "@/lib/geocoding/plan-my-day";

export function ResolutionProgress({ progress }: { progress: PlanResolveProgress }) {
  const finding = progress.items.find((item) => item.status === "finding");
  return (
    <div
      className="rounded-lg border border-hairline bg-white px-4 py-3"
      data-testid="resolution-progress"
    >
      <p className="text-[13px] font-semibold text-slate-900">
        {progress.phase === "planning"
          ? "Building route…"
          : "Resolving addresses…"}
      </p>
      <p className="mt-0.5 text-[12px] text-slate-500 tabular-nums">
        {progress.resolvedCount} of {progress.totalCount} resolved
        {finding ? ` — Finding ${finding.label}…` : ""}
      </p>
      <ul className="mt-3 space-y-1.5">
        {progress.items.map((item) => (
          <li
            key={item.jobId}
            className="flex items-center gap-2 text-[12.5px] text-slate-700"
          >
            <StatusIcon status={item.status} />
            <span className="min-w-0 truncate">
              {item.status === "finding"
                ? `Finding ${item.label}…`
                : item.status === "waiting"
                  ? `Waiting: ${item.label}`
                  : item.status === "needs_confirmation"
                    ? `${item.label} — needs confirmation`
                    : item.status === "failed"
                      ? item.label
                      : item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusIcon({
  status,
}: {
  status: PlanResolveProgress["items"][number]["status"];
}) {
  if (status === "resolved" || status === "skipped") {
    return <Check className="size-3.5 shrink-0 text-prensa-green" strokeWidth={2.5} />;
  }
  if (status === "finding") {
    return (
      <LoaderCircle className="size-3.5 shrink-0 animate-spin text-brand" strokeWidth={2} />
    );
  }
  if (status === "failed") {
    return (
      <span className="w-3.5 shrink-0 text-center text-[11px] font-semibold text-amber-700">
        !
      </span>
    );
  }
  if (status === "needs_confirmation") {
    return (
      <span className="w-3.5 shrink-0 text-center text-[11px] font-semibold text-amber-700">
        ?
      </span>
    );
  }
  return <span className="size-3.5 shrink-0 rounded-full border border-slate-300" />;
}
