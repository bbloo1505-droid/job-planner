"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AllocationMapModel } from "@/lib/map/allocation-map-model";
import type { LocalMapLibreProvider } from "@/lib/map/local-maplibre-provider";
import type { MapLocation, MapPadding } from "@/lib/map/provider";
import { cn } from "@/lib/utils";

export function MapCanvas({
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
  const rootRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<LocalMapLibreProvider | null>(null);
  const onSelectRef = useRef(onSelectJob);
  const modelRef = useRef(model);
  const fitRef = useRef({ fitKey, fitLocations, padding, focus });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelectJob;
    modelRef.current = model;
    fitRef.current = { fitKey, fitLocations, padding, focus };
  }, [fitKey, fitLocations, focus, model, onSelectJob, padding]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    let cancelled = false;

    void (async () => {
      try {
        const { LocalMapLibreProvider } = await import("@/lib/map/local-maplibre-provider");
        if (cancelled || !rootRef.current) return;
        const provider = await LocalMapLibreProvider.create(rootRef.current, {
          padding: fitRef.current.padding,
          onSelectJob: (jobId) => onSelectRef.current(jobId),
        });
        if (cancelled) {
          provider.destroy();
          return;
        }
        providerRef.current = provider;
        provider.setPadding(fitRef.current.padding);
        provider.setModel(modelRef.current);
        provider.fitIfNeeded(fitRef.current.fitKey, fitRef.current.fitLocations);
        if (fitRef.current.focus) provider.focusLocation(fitRef.current.focus);
        setReady(true);
      } catch {
        if (!cancelled) setReady(false);
      }
    })();

    return () => {
      cancelled = true;
      providerRef.current?.destroy();
      providerRef.current = null;
    };
  }, []);

  useEffect(() => {
    providerRef.current?.setPadding(padding);
    providerRef.current?.setModel(model);
  }, [model, padding]);

  useEffect(() => {
    providerRef.current?.fitIfNeeded(fitKey, fitLocations);
  }, [fitKey, fitLocations]);

  useEffect(() => {
    if (focus) providerRef.current?.focusLocation(focus);
  }, [focus]);

  return (
    <>
      <div
        ref={rootRef}
        className={cn("prensa-map-canvas absolute inset-0")}
        data-testid="maplibre-canvas"
        data-map-ready={ready ? "true" : "false"}
        data-insertion-preview={insertionActive ? "true" : "false"}
      />
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        <button
          type="button"
          data-testid="map-zoom-in"
          aria-label="Zoom in"
          onClick={() => providerRef.current?.zoomIn()}
          className="flex size-7 items-center justify-center rounded border border-hairline bg-white text-[15px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          +
        </button>
        <button
          type="button"
          data-testid="map-zoom-out"
          aria-label="Zoom out"
          onClick={() => providerRef.current?.zoomOut()}
          className="flex size-7 items-center justify-center rounded border border-hairline bg-white text-[15px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          −
        </button>
        <button
          type="button"
          data-testid="fit-jobs"
          onClick={() => providerRef.current?.fitToLocations(fitLocations)}
          className="h-7 rounded border border-hairline bg-white px-2 text-[10.5px] font-semibold tracking-wide text-slate-700 hover:bg-slate-50"
        >
          Fit jobs
        </button>
      </div>
    </>
  );
}
