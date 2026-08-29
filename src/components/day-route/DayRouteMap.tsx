"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapViewportControls } from "@/components/map/providers/MapViewportControls";
import { buildDayRouteMapModel } from "@/lib/map/day-route-map-model";
import type { DayRouteMapProvider } from "@/lib/map/day-route-map-provider";
import {
  OPENFREEMAP_MAP_NOTICE,
  OPENFREEMAP_OSM_NOTICE,
  SCHEMATIC_ROUTE_LINE_NOTICE,
} from "@/lib/map/provider";
import { useDayRouteStore } from "@/lib/store/day-route-store";

export function DayRouteMap() {
  const settings = useDayRouteStore((state) => state.plan.settings);
  const stops = useDayRouteStore((state) => state.plan.stops);
  const jobs = useDayRouteStore((state) => state.jobs);
  const selectedJobId = useDayRouteStore((state) => state.selectedJobId);
  const selectedKind = useDayRouteStore((state) => state.selectedKind);
  const selectJob = useDayRouteStore((state) => state.selectJob);

  const model = useMemo(
    () =>
      buildDayRouteMapModel({
        settings,
        stops,
        jobs,
        selectedJobId,
        selectedKind,
      }),
    [jobs, selectedJobId, selectedKind, settings, stops]
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<DayRouteMapProvider | null>(null);
  const selectRef = useRef(selectJob);
  const modelRef = useRef(model);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    selectRef.current = selectJob;
    modelRef.current = model;
  }, [model, selectJob]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    let cancelled = false;
    setReady(false);
    setError(null);
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    node.append(host);

    void (async () => {
      try {
        const { DayRouteMapProvider } = await import(
          "@/lib/map/day-route-map-provider"
        );
        if (cancelled) {
          host.remove();
          return;
        }
        const provider = await DayRouteMapProvider.create(host, {
          onSelectJob: (jobId, kind) => selectRef.current(jobId, kind),
        });
        if (cancelled) {
          provider.destroy();
          host.remove();
          return;
        }
        providerRef.current = provider;
        provider.setModel(modelRef.current);
        setReady(true);
      } catch (cause) {
        host.remove();
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Map failed to load.");
        setReady(false);
      }
    })();

    return () => {
      cancelled = true;
      providerRef.current?.destroy();
      providerRef.current = null;
      host.remove();
    };
  }, []);

  useEffect(() => {
    providerRef.current?.setModel(model);
  }, [model]);

  useEffect(() => {
    if (!ready) return;
    if (selectedKind === "stop" && selectedJobId) {
      providerRef.current?.focusStop(selectedJobId);
    }
  }, [ready, selectedJobId, selectedKind]);

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header flex items-center justify-between gap-3">
        <h2 className="panel-heading">Route overview</h2>
        <p className="text-[11px] text-slate-400">
          {OPENFREEMAP_MAP_NOTICE}
        </p>
      </div>

        {model.unresolvedJobIds.length > 0 ? (
          <p className="border-b border-amber-100 bg-amber-50/70 px-4 py-2 text-[12px] text-amber-900">
            {model.unresolvedJobIds.length === 1
              ? "1 stop is not on the map — resolve the address to place it."
              : `${model.unresolvedJobIds.length} stops are not on the map — resolve the addresses to place them.`}
          </p>
        ) : null}
      <div className="relative h-[360px] bg-[#e8eef3] lg:h-[400px]">
        <div
          ref={rootRef}
          className="prensa-map-canvas prensa-openfreemap absolute inset-0"
          data-testid="day-route-map"
          data-map-engine="openfreemap"
          data-map-ready={ready ? "true" : "false"}
        />
        {!ready && !error ? (
          <p className="pointer-events-none absolute inset-x-0 top-12 z-10 text-center text-[12px] text-slate-500">
            Loading map…
          </p>
        ) : null}
        {error ? (
          <p className="absolute inset-x-4 top-12 z-10 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[12px] text-amber-800">
            OpenFreeMap unavailable. {error}
          </p>
        ) : null}
        <MapViewportControls
          onZoomIn={() => providerRef.current?.zoomIn()}
          onZoomOut={() => providerRef.current?.zoomOut()}
          onFitJobs={() => providerRef.current?.fitRoute()}
          fitLabel="Fit route"
          fitTestId="fit-route"
        />
      </div>
      <p className="border-t border-hairline px-4 py-2 text-[11px] leading-4 text-slate-400">
        {OPENFREEMAP_MAP_NOTICE}
        <span className="text-slate-300"> · </span>
        {OPENFREEMAP_OSM_NOTICE}
        <span className="text-slate-300"> · </span>
        {SCHEMATIC_ROUTE_LINE_NOTICE}
      </p>
    </section>
  );
}
