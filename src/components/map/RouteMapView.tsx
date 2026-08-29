"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { pointOf } from "@/lib/geo";
import { useDayRouteStore } from "@/lib/store/day-route-store";
import type { GeoPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MapPoint {
  id: string;
  label: string;
  point: GeoPoint;
  kind: "start" | "stop" | "finish";
  order?: number;
  selected?: boolean;
}

const WIDTH = 720;
const HEIGHT = 280;
const PAD = 40;

export function RouteMapView() {
  const settings = useDayRouteStore((state) => state.plan.settings);
  const stops = useDayRouteStore((state) => state.plan.stops);
  const jobs = useDayRouteStore((state) => state.jobs);
  const selectedJobId = useDayRouteStore((state) => state.selectedJobId);
  const selectJob = useDayRouteStore((state) => state.selectJob);

  const points = useMemo(() => {
    const result: MapPoint[] = [];
    const start = pointOf(settings.startLat, settings.startLng);
    if (start) {
      result.push({ id: "start", label: "Start", point: start, kind: "start" });
    }
    stops.forEach((stop, index) => {
      const job = jobs[stop.jobId];
      const point = job ? pointOf(job.latitude, job.longitude) : null;
      if (!job || !point) return;
      result.push({
        id: job.id,
        label: job.suburb ?? `Stop ${index + 1}`,
        point,
        kind: "stop",
        order: index + 1,
        selected: selectedJobId === job.id,
      });
    });
    const finish = pointOf(settings.finishLat, settings.finishLng);
    if (finish && stops.length > 0) {
      result.push({ id: "finish", label: "Finish", point: finish, kind: "finish" });
    }
    return result;
  }, [jobs, selectedJobId, settings, stops]);

  const projected = useMemo(() => projectPoints(points), [points]);
  const path = projected.map((item) => `${item.x},${item.y}`).join(" ");
  const [open, setOpen] = useState(true);

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-1.5 rounded text-left focus-visible:ring-3 focus-visible:ring-brand/25 focus-visible:outline-none"
        >
          <ChevronDown
            className={cn(
              "size-3.5 text-slate-400 transition-transform duration-150",
              !open && "-rotate-90"
            )}
            strokeWidth={2}
          />
          <h2 className="panel-heading">Route overview</h2>
        </button>
        <p className="text-[11px] text-slate-400">
          Prototype schematic — not to scale
        </p>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={cn("w-full bg-[#fafbfd]", open ? "h-[210px]" : "hidden")}
        role="img"
        aria-label="Prototype route schematic, not to scale"
      >
        <defs>
          <pattern id="grid-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#dfe5ee" />
          </pattern>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#grid-dots)" />

        {projected.length > 1 ? (
          <>
            <polyline
              fill="none"
              stroke="#cfe2f1"
              strokeWidth="7"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={path}
            />
            <polyline
              fill="none"
              stroke="#1a2744"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={path}
            />
          </>
        ) : null}

        {projected.map((item) => {
          const isStop = item.kind === "stop";
          return (
            <g
              key={item.id}
              transform={`translate(${item.x}, ${item.y})`}
              className={isStop ? "cursor-pointer" : undefined}
              onClick={() => {
                if (isStop) selectJob(item.id, "stop");
              }}
            >
              {item.selected ? (
                <circle r="15" fill="#1b7ab8" opacity="0.18" />
              ) : null}
              <circle
                r={isStop ? 10.5 : 7}
                fill={
                  item.kind === "start"
                    ? "#1a2744"
                    : item.kind === "finish"
                      ? "#ffffff"
                      : item.selected
                        ? "#15628f"
                        : "#1b7ab8"
                }
                stroke={item.kind === "finish" ? "#94a3b8" : "#ffffff"}
                strokeWidth={item.kind === "finish" ? 2 : 2.5}
              />
              {isStop ? (
                <text
                  textAnchor="middle"
                  y="3.5"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="700"
                >
                  {item.order}
                </text>
              ) : null}
              <text
                textAnchor="middle"
                y={isStop ? 25 : 22}
                fill="#475569"
                fontSize="10.5"
                fontWeight="600"
                stroke="#fafbfd"
                strokeWidth="3"
                paintOrder="stroke"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function projectPoints(points: MapPoint[]) {
  if (points.length === 0) return [];
  const lats = points.map((item) => item.point.lat);
  const lngs = points.map((item) => item.point.lng);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);
  if (maxLat === minLat) {
    minLat -= 0.02;
    maxLat += 0.02;
  }
  if (maxLng === minLng) {
    minLng -= 0.02;
    maxLng += 0.02;
  }
  const latPad = (maxLat - minLat) * 0.16;
  const lngPad = (maxLng - minLng) * 0.16;
  minLat -= latPad;
  maxLat += latPad;
  minLng -= lngPad;
  maxLng += lngPad;

  return points.map((item) => ({
    ...item,
    x: PAD + ((item.point.lng - minLng) / (maxLng - minLng)) * (WIDTH - PAD * 2),
    y: PAD + ((maxLat - item.point.lat) / (maxLat - minLat)) * (HEIGHT - PAD * 2),
  }));
}
