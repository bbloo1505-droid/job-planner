"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { AllocationMap } from "@/components/map/providers/AllocationMap";
import { DevMapProviderSwitch } from "@/components/map/providers/DevMapProviderSwitch";
import { consultantFirstName } from "@/lib/geo/rank-allocation-candidates";
import {
  buildAllocationMapModel,
  locationsForFit,
  searchMapMarkers,
} from "@/lib/map/allocation-map-model";
import { useMapProviderRuntime } from "@/lib/map/map-provider-runtime";
import {
  GOOGLE_MAP_NOTICE,
  GOOGLE_SYNTHETIC_NOTICE,
  GOOGLE_TRAVEL_NOTICE,
  LOCAL_MAP_NOTICE,
  LOCAL_TRAVEL_NOTICE,
  OPENFREEMAP_MAP_NOTICE,
  OPENFREEMAP_OSM_NOTICE,
  OPENFREEMAP_TRAVEL_NOTICE,
  SCHEMATIC_INSERTION_NOTICE,
  WEEKLY_PATH_NOTICE,
  type MapPadding,
} from "@/lib/map/provider";
import { monthWorkingIsoDates } from "@/lib/team/month";
import { isoDate, weekDays, weekRangeLabel } from "@/lib/team/week";
import { allocationForJob, useTeamPlannerStore } from "@/lib/store/team-planner-store";
import { cn } from "@/lib/utils";

const FULL_PAD: MapPadding = { top: 56, right: 48, bottom: 72, left: 56 };
const SPLIT_PAD: MapPadding = { top: 40, right: 28, bottom: 48, left: 36 };

export function TeamMap({ variant }: { variant: "full" | "split" }) {
  const jobs = useTeamPlannerStore((state) => state.jobs);
  const allocations = useTeamPlannerStore((state) => state.allocations);
  const consultants = useTeamPlannerStore((state) => state.consultants);
  const selectedJobId = useTeamPlannerStore((state) => state.selectedJobId);
  const selectedConsultantId = useTeamPlannerStore((state) => state.selectedConsultantId);
  const weekStart = useTeamPlannerStore((state) => state.weekStart);
  const monthStart = useTeamPlannerStore((state) => state.monthStart);
  const showWeekends = useTeamPlannerStore((state) => state.showWeekends);
  const selectedDate = useTeamPlannerStore((state) => state.selectedDate);
  const geoScope = useTeamPlannerStore((state) => state.geoScope);
  const search = useTeamPlannerStore((state) => state.search);
  const mapHiddenConsultantIds = useTeamPlannerStore((state) => state.mapHiddenConsultantIds);
  const allocationPreview = useTeamPlannerStore((state) => state.allocationPreview);
  const selectJob = useTeamPlannerStore((state) => state.selectJob);
  const setGeoScope = useTeamPlannerStore((state) => state.setGeoScope);
  const selectConsultant = useTeamPlannerStore((state) => state.selectConsultant);
  const toggleMapConsultantHidden = useTeamPlannerStore(
    (state) => state.toggleMapConsultantHidden
  );
  const setSearch = useTeamPlannerStore((state) => state.setSearch);
  const mapRuntime = useMapProviderRuntime();
  const padding = variant === "full" ? FULL_PAD : SPLIT_PAD;

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const workingDays = useMemo(() => days.map(isoDate), [days]);
  const monthDays = useMemo(
    () => monthWorkingIsoDates(monthStart, showWeekends),
    [monthStart, showWeekends]
  );
  const weekFocus = geoScope === "week" && Boolean(selectedConsultantId);

  const selectedJob = selectedJobId ? jobs[selectedJobId] : undefined;
  const selectedAllocation = selectedJob
    ? allocationForJob({ allocations }, selectedJob.id)
    : undefined;
  const matchMode = Boolean(selectedJob && !selectedAllocation);

  const model = useMemo(
    () =>
      buildAllocationMapModel({
        jobs,
        allocations,
        consultants,
        geoScope,
        hiddenConsultantIds: mapHiddenConsultantIds,
        selectedJobId,
        selectedConsultantId,
        workingDays,
        monthDays,
        allocationPreview,
      }),
    [
      allocations,
      allocationPreview,
      consultants,
      geoScope,
      jobs,
      mapHiddenConsultantIds,
      monthDays,
      selectedConsultantId,
      selectedJobId,
      workingDays,
    ]
  );

  const searchHits = useMemo(
    () => searchMapMarkers(model.markers, search),
    [model.markers, search]
  );
  const focus = searchHits.length === 1 ? searchHits[0] : null;
  const searchFit = searchHits.length > 1 ? searchHits : null;

  const fitLocations = useMemo(() => {
    if (searchFit && searchFit.length > 0) return searchFit;
    return locationsForFit({
      model,
      selectedConsultantId,
      matchMode,
    });
  }, [matchMode, model, searchFit, selectedConsultantId]);

  const fitKey = `${geoScope}|${selectedConsultantId ?? ""}|${matchMode ? selectedJobId : ""}|${searchHits.length > 1 ? search.trim() : ""}`;

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col bg-white",
        variant === "split" ? "h-full min-h-[320px]" : "h-full"
      )}
      data-testid="geo-map"
      data-geo-scope={geoScope}
      data-map-provider={mapRuntime.render}
      data-insertion-preview={model.insertionPreview ? "true" : "false"}
      data-insertion-path={
        model.insertionPreview
          ? model.insertionPreview.proposed.map((item) => item.label).join(" → ")
          : undefined
      }
      data-preview-consultant={model.activeMatch?.consultantId}
      data-preview-date={model.activeMatch?.date}
    >
      <div className="shrink-0 border-b border-hairline px-3 py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Map period">
            <button
              type="button"
              role="tab"
              aria-selected={geoScope !== "week" && geoScope !== "month"}
              data-geo-period="day"
              onClick={() => setGeoScope(selectedDate ?? workingDays[0] ?? weekStart)}
              className={cn(
                "h-6 rounded px-2 text-[10.5px] font-semibold tracking-wide",
                geoScope !== "week" && geoScope !== "month"
                  ? "bg-navy text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              Selected day
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={geoScope === "week"}
              data-geo-day="week"
              data-geo-period="week"
              onClick={() => setGeoScope("week")}
              className={cn(
                "h-6 rounded px-2 text-[10.5px] font-semibold tracking-wide",
                geoScope === "week" ? "bg-navy text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              Selected week
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={geoScope === "month"}
              data-geo-period="month"
              onClick={() => setGeoScope("month")}
              className={cn(
                "h-6 rounded px-2 text-[10.5px] font-semibold tracking-wide",
                geoScope === "month" ? "bg-navy text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              Whole month
            </button>
            <span className="mx-1 h-4 w-px bg-hairline" />
            {days.map((day) => {
              const iso = isoDate(day);
              const label = format(day, "EEE").toUpperCase();
              const active = geoScope === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-geo-day={iso}
                  onClick={() => setGeoScope(iso)}
                  className={cn(
                    "h-6 rounded px-2 text-[10.5px] font-semibold tracking-wide",
                    active ? "bg-navy text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DevMapProviderSwitch />
            {variant === "full" || variant === "split" ? (
              <input
                className="field-input h-9 w-full max-w-none text-base md:h-6 md:max-w-[180px] md:text-[12px]"
                placeholder="Search location or job no."
                value={search}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearch(value);
                  const hits = searchMapMarkers(model.markers, value);
                  if (hits.length === 1) selectJob(hits[0].id);
                }}
                aria-label="Search jobs on map"
              />
            ) : null}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {consultants.map((consultant) => {
            const hidden = mapHiddenConsultantIds.includes(consultant.id);
            const focused = selectedConsultantId === consultant.id;
            return (
              <div
                key={consultant.id}
                className={cn(
                  "flex items-center gap-1 rounded px-1 py-0.5 text-[11.5px]",
                  focused ? "bg-navy/[0.08] font-semibold text-slate-900" : "text-slate-600"
                )}
              >
                <input
                  type="checkbox"
                  checked={!hidden}
                  data-consultant-filter={consultant.id}
                  onChange={() => toggleMapConsultantHidden(consultant.id)}
                  className="size-3"
                />
                <button
                  type="button"
                  data-consultant-name={consultant.id}
                  onClick={() => {
                    if (hidden) toggleMapConsultantHidden(consultant.id);
                    selectConsultant(consultant.id);
                  }}
                  className="flex items-center gap-1"
                >
                  <span
                    className="flex size-[18px] items-center justify-center rounded-full text-[8px] font-bold text-white"
                    style={{ backgroundColor: consultant.displayColour }}
                  >
                    {consultant.initials}
                  </span>
                  {consultantFirstName(consultant.name)}
                </button>
              </div>
            );
          })}
          {selectedConsultantId ? (
            <button
              type="button"
              onClick={() => selectConsultant(null)}
              className="text-[11px] text-slate-500 hover:text-slate-800"
            >
              Clear focus
            </button>
          ) : null}
        </div>
      </div>

      <div className={cn("relative min-h-0", variant === "full" ? "flex-1" : "min-h-[320px] flex-1")}>
        <AllocationMap
          model={model}
          fitKey={fitKey}
          fitLocations={fitLocations}
          focus={focus}
          padding={padding}
          insertionActive={Boolean(model.insertionPreview)}
          onSelectJob={selectJob}
        />
        <div className="pointer-events-none absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
          {weekFocus ? (
            <p className="rounded border border-hairline bg-white/95 px-2 py-1 text-[10.5px] text-slate-500">
              {WEEKLY_PATH_NOTICE}
            </p>
          ) : null}
          {model.insertionPreview ? (
            <p
              className="rounded border border-hairline bg-white/95 px-2 py-1 text-[10.5px] text-slate-500"
              data-testid="schematic-insertion-caption"
            >
              {SCHEMATIC_INSERTION_NOTICE}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "pointer-events-none absolute right-2 left-2 z-10 flex items-end justify-between gap-3",
            mapRuntime.render === "google" || mapRuntime.render === "openfreemap"
              ? "bottom-10"
              : "bottom-2"
          )}
        >
          <div>
            {mapRuntime.render === "google" ? (
              <>
                <p className="text-[10.5px] text-slate-600">{GOOGLE_MAP_NOTICE}</p>
                <p className="text-[10.5px] text-slate-500">{GOOGLE_SYNTHETIC_NOTICE}</p>
                <p className="text-[10.5px] text-slate-400">{GOOGLE_TRAVEL_NOTICE}</p>
              </>
            ) : mapRuntime.render === "openfreemap" ? (
              <>
                <p className="text-[10.5px] text-slate-600">{OPENFREEMAP_MAP_NOTICE}</p>
                <p className="text-[10.5px] text-slate-500">{OPENFREEMAP_OSM_NOTICE}</p>
                <p className="text-[10.5px] text-slate-400">{OPENFREEMAP_TRAVEL_NOTICE}</p>
              </>
            ) : (
              <>
                <p className="text-[10.5px] text-slate-500">{LOCAL_MAP_NOTICE}</p>
                <p className="text-[10.5px] text-slate-400">{LOCAL_TRAVEL_NOTICE}</p>
              </>
            )}
            <p className="text-[10.5px] text-slate-400">{weekRangeLabel(weekStart)}</p>
            <ConsultantLegend consultants={consultants} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ConsultantLegend({
  consultants,
}: {
  consultants: { id: string; name: string; displayColour: string }[];
}) {
  return (
    <div className="pointer-events-none mt-2 hidden rounded-xl border border-slate-200/80 bg-white/95 px-2.5 py-2 shadow-[0_6px_16px_-10px_rgb(15_23_42_/_0.45)] md:block">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {consultants.map((item) => (
          <span key={item.id} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
            <span
              className="size-2.5 shrink-0 rounded-full shadow-[0_0_0_1px_rgb(255_255_255)]"
              style={{ backgroundColor: item.displayColour }}
            />
            {consultantFirstName(item.name)}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
          <span className="size-2.5 shrink-0 rounded-full bg-[#e4453a] shadow-[0_0_0_1px_rgb(255_255_255)]" />
          Unassigned
        </span>
      </div>
    </div>
  );
}

