"use client";

import { useMapProviderRuntime } from "@/lib/map/map-provider-runtime";
import type { MapProviderKind } from "@/lib/map/config";
import { cn } from "@/lib/utils";

const OPTIONS: { id: MapProviderKind; label: string }[] = [
  { id: "local-maplibre", label: "Local" },
  { id: "openfreemap", label: "OpenFreeMap" },
  { id: "google", label: "Google" },
];

export function DevMapProviderSwitch() {
  const runtime = useMapProviderRuntime();
  if (!runtime.isDev) return null;

  return (
    <div
      className="flex items-center gap-0.5 rounded border border-hairline p-0.5"
      data-testid="dev-map-provider-switch"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          data-provider-option={option.id}
          onClick={() => runtime.setOverride(option.id)}
          className={cn(
            "h-6 rounded px-2 text-[10.5px] font-semibold tracking-wide",
            runtime.requested === option.id
              ? "bg-navy text-white"
              : "text-slate-500 hover:bg-slate-50"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
