"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { MapCanvas } from "@/components/team-planner/MapCanvas";
import { consultantFirstName } from "@/lib/geo/rank-allocation-candidates";
import {
  buildAllocationMapModel,
  locationsForFit,
  searchMapMarkers,
} from "@/lib/map/allocation-map-model";
import {
  LOCAL_MAP_NOTICE,
  LOCAL_TRAVEL_NOTICE,
  MAP_PROVIDER_KIND,
  WEEKLY_PATH_NOTICE,
  type MapPadding,
} from "@/lib/map/provider";
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

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const workingDays = useMemo(() => days.map(isoDate), [days]);
  const weekFocus = geoScope === "week" && Boolean(selectedConsultantId);
  const padding = variant === "full" ? FULL_PAD : SPLIT_PAD;

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
        allocationPreview,
      }),
    [
      allocations,
      allocationPreview,
      consultants,
      geoScope,
      jobs,
      mapHiddenConsultantIds,
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
        variant === "split" ? "h-full min-h-[280px]" : "h-full"
      )}
      data-testid="geo-map"
      data-geo-scope={geoScope}
      data-map-provider={MAP_PROVIDER_KIND}
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
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Map day">
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
            <button
              type="button"
              role="tab"
              aria-selected={geoScope === "week"}
              data-geo-day="week"
              onClick={() => setGeoScope("week")}
              className={cn(
                "h-6 rounded px-2 text-[10.5px] font-semibold tracking-wide",
                geoScope === "week" ? "bg-navy text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              WHOLE WEEK
            </button>
          </div>
          {variant === "full" || variant === "split" ? (
            <input
              className="field-input h-6 max-w-[180px] text-[12px]"
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

      <div className={cn("relative min-h-0", variant === "full" ? "flex-1" : "min-h-[280px] flex-1")}>
        <MapCanvas
          model={model}
          fitKey={fitKey}
          fitLocations={fitLocations}
          focus={focus}
          padding={padding}
          insertionActive={Boolean(model.insertionPreview)}
          onSelectJob={selectJob}
        />
        {weekFocus ? (
          <p className="pointer-events-none absolute top-2 right-2 z-10 rounded border border-hairline bg-white/95 px-2 py-1 text-[10.5px] text-slate-500">
            {WEEKLY_PATH_NOTICE}
          </p>
        ) : null}
        <div className="pointer-events-none absolute right-2 bottom-2 left-2 z-10 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10.5px] text-slate-500">{LOCAL_MAP_NOTICE}</p>
            <p className="text-[10.5px] text-slate-400">{LOCAL_TRAVEL_NOTICE}</p>
            <p className="text-[10.5px] text-slate-400">{weekRangeLabel(weekStart)}</p>
          </div>
          <ConsultantLegend consultants={consultants} />
        </div>
      </div>
    </section>
  );
}

function ConsultantLegend({
  consultants,
}: {
  consultants: { id: string; initials: string; displayColour: string }[];
}) {
  return (
    <div className="pointer-events-none hidden rounded border border-hairline bg-white/95 px-2 py-1.5 md:block">
      <p className="text-[9px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
        Consultants
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {consultants.map((item) => (
          <span key={item.id} className="flex items-center gap-1 text-[10px] text-slate-600">
            <span
              className="flex size-3.5 items-center justify-center rounded-full text-[7px] font-bold text-white"
              style={{ backgroundColor: item.displayColour }}
            >
              {item.initials}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
