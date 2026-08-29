"use client";

import { useEffect, useRef, useState } from "react";
import { MapViewportControls } from "@/components/map/providers/MapViewportControls";
import type { AllocationMapModel } from "@/lib/map/allocation-map-model";
import type { GoogleMapsProvider } from "@/lib/map/google-maps-provider";
import { googleMapsBrowserKey } from "@/lib/map/map-provider-runtime";
import type { MapLocation, MapPadding } from "@/lib/map/provider";
import { cn } from "@/lib/utils";

export function GoogleAllocationMap({
  model,
  fitKey,
  fitLocations,
  focus,
  padding,
  insertionActive,
  onSelectJob,
  onLoadError,
}: {
  model: AllocationMapModel;
  fitKey: string;
  fitLocations: MapLocation[];
  focus: MapLocation | null;
  padding: MapPadding;
  insertionActive: boolean;
  onSelectJob: (jobId: string) => void;
  onLoadError: (message: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<GoogleMapsProvider | null>(null);
  const onSelectRef = useRef(onSelectJob);
  const onErrorRef = useRef(onLoadError);
  const modelRef = useRef(model);
  const fitRef = useRef({ fitKey, fitLocations, padding, focus });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelectJob;
    onErrorRef.current = onLoadError;
    modelRef.current = model;
    fitRef.current = { fitKey, fitLocations, padding, focus };
  }, [fitKey, fitLocations, focus, model, onLoadError, onSelectJob, padding]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    let cancelled = false;

    void (async () => {
      try {
        const { GoogleMapsProvider } = await import("@/lib/map/google-maps-provider");
        if (cancelled || !rootRef.current) return;
        const provider = await GoogleMapsProvider.create(rootRef.current, {
          padding: fitRef.current.padding,
          apiKey: googleMapsBrowserKey(),
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
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Google Maps failed to load.";
        onErrorRef.current(message);
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
        className={cn("prensa-map-canvas prensa-google-map absolute inset-0")}
        data-testid="google-maps-canvas"
        data-map-engine="google"
        data-map-ready={ready ? "true" : "false"}
        data-insertion-preview={insertionActive ? "true" : "false"}
      />
      {!ready ? (
        <p className="pointer-events-none absolute inset-x-0 top-12 z-10 text-center text-[12px] text-slate-500">
          Loading map…
        </p>
      ) : null}
      <MapViewportControls
        onZoomIn={() => providerRef.current?.zoomIn()}
        onZoomOut={() => providerRef.current?.zoomOut()}
        onFitJobs={() => providerRef.current?.fitToLocations(fitLocations)}
      />
    </>
  );
}
