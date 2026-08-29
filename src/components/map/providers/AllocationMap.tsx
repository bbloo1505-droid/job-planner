"use client";

import { GoogleAllocationMap } from "@/components/map/providers/GoogleAllocationMap";
import { MapLibreAllocationMap } from "@/components/map/providers/MapLibreAllocationMap";
import type { AllocationMapModel } from "@/lib/map/allocation-map-model";
import { useMapProviderRuntime } from "@/lib/map/map-provider-runtime";
import type { MapLocation, MapPadding } from "@/lib/map/provider";

export function AllocationMap({
  model,
  fitKey,
  fitLocations,
  focus,
  padding,
  insertionActive,
  onSelectJob,
}: {
  model: AllocationMapModel;
  fitKey: string;
  fitLocations: MapLocation[];
  focus: MapLocation | null;
  padding: MapPadding;
  insertionActive: boolean;
  onSelectJob: (jobId: string) => void;
}) {
  const runtime = useMapProviderRuntime();
  const shared = {
    model,
    fitKey,
    fitLocations,
    focus,
    padding,
    insertionActive,
    onSelectJob,
  };

  if (runtime.render === "google-unavailable") {
    return (
      <UnavailablePanel
        testId="google-maps-unavailable"
        engine="google-unavailable"
        title="Google Maps provider unavailable."
        body="Use local prototype map instead."
        detail={runtime.errorMessage}
        onSwitchLocal={runtime.switchToLocal}
      />
    );
  }

  if (runtime.render === "openfreemap-unavailable") {
    return (
      <UnavailablePanel
        testId="openfreemap-unavailable"
        engine="openfreemap-unavailable"
        title="OpenFreeMap unavailable."
        body="Use local prototype map instead."
        detail={runtime.errorMessage}
        onSwitchLocal={runtime.switchToLocal}
      />
    );
  }

  if (runtime.render === "google") {
    return (
      <GoogleAllocationMap
        key="google"
        {...shared}
        onLoadError={runtime.reportGoogleError}
      />
    );
  }

  if (runtime.render === "openfreemap") {
    return (
      <MapLibreAllocationMap
        key="openfreemap"
        basemapKind="openfreemap"
        {...shared}
        onLoadError={runtime.reportOpenFreeMapError}
      />
    );
  }

  return <MapLibreAllocationMap key="local-maplibre" basemapKind="local" {...shared} />;
}

function UnavailablePanel({
  testId,
  engine,
  title,
  body,
  detail,
  onSwitchLocal,
}: {
  testId: string;
  engine: string;
  title: string;
  body: string;
  detail: string | null;
  onSwitchLocal: () => void;
}) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-[#eef2f6] px-6"
      data-testid={testId}
      data-map-engine={engine}
      data-map-ready="false"
    >
      <div className="max-w-[320px] rounded-md border border-hairline bg-white px-4 py-3 text-center">
        <p className="text-[13px] font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-[12px] text-slate-600">{body}</p>
        {detail ? <p className="mt-2 text-[11px] leading-snug text-slate-500">{detail}</p> : null}
        <button
          type="button"
          data-testid="switch-to-local-map"
          onClick={onSwitchLocal}
          className="mt-3 h-8 rounded border border-hairline bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Use local map
        </button>
      </div>
    </div>
  );
}
