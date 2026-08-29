import { resolvedPointOf } from "@/lib/geo";
import type {
  BookingStatus,
  DayPlanSettings,
  GeoPoint,
  Job,
  RouteStop,
} from "@/lib/types";
import type { MapLocation } from "@/lib/map/provider";

export interface DayRouteOfficeMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  role: "start" | "finish" | "start-finish";
}

export interface DayRouteStopMarker {
  id: string;
  jobId: string;
  order: number;
  lat: number;
  lng: number;
  suburb: string;
  address: string;
  appointmentTime?: string;
  bookingStatus: BookingStatus;
  selected: boolean;
}

export interface DayRouteCandidateMarker {
  id: string;
  jobId: string;
  lat: number;
  lng: number;
  suburb: string;
}

export interface DayRouteMapModel {
  offices: DayRouteOfficeMarker[];
  stops: DayRouteStopMarker[];
  unresolvedJobIds: string[];
  candidate: DayRouteCandidateMarker | null;
  line: GeoPoint[];
  fitLocations: MapLocation[];
}

export function sameCoordinate(a: GeoPoint, b: GeoPoint): boolean {
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

export function buildDayRouteMapModel(input: {
  settings: DayPlanSettings;
  stops: RouteStop[];
  jobs: Record<string, Job>;
  selectedJobId: string | null;
  selectedKind: "stop" | "unbooked" | null;
}): DayRouteMapModel {
  const { settings, stops, jobs, selectedJobId, selectedKind } = input;
  const start = resolvedPointOf(settings.startLat, settings.startLng);
  const finish = resolvedPointOf(settings.finishLat, settings.finishLng);

  const offices: DayRouteOfficeMarker[] = [];
  if (start && finish && sameCoordinate(start, finish)) {
    offices.push({
      id: "office-start-finish",
      lat: start.lat,
      lng: start.lng,
      label: shortOfficeLabel(settings.startLocation),
      role: "start-finish",
    });
  } else {
    if (start) {
      offices.push({
        id: "office-start",
        lat: start.lat,
        lng: start.lng,
        label: shortOfficeLabel(settings.startLocation),
        role: "start",
      });
    }
    if (finish) {
      offices.push({
        id: "office-finish",
        lat: finish.lat,
        lng: finish.lng,
        label: shortOfficeLabel(settings.finishLocation ?? settings.startLocation),
        role: "finish",
      });
    }
  }

  const stopMarkers: DayRouteStopMarker[] = [];
  const unresolvedJobIds: string[] = [];
  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    const job = jobs[stop.jobId];
    if (!job) continue;
    const point = resolvedPointOf(job.latitude, job.longitude, job.suburb);
    if (!point) {
      unresolvedJobIds.push(job.id);
      continue;
    }
    stopMarkers.push({
      id: `stop-${job.id}`,
      jobId: job.id,
      order: index + 1,
      lat: point.lat,
      lng: point.lng,
      suburb: job.suburb || `Stop ${index + 1}`,
      address: job.address,
      appointmentTime: stop.suggestedArrival,
      bookingStatus: job.bookingStatus,
      selected: selectedKind === "stop" && selectedJobId === job.id,
    });
  }

  let candidate: DayRouteCandidateMarker | null = null;
  if (selectedKind === "unbooked" && selectedJobId) {
    const job = jobs[selectedJobId];
    const point = job
      ? resolvedPointOf(job.latitude, job.longitude, job.suburb)
      : null;
    if (job && point) {
      candidate = {
        id: `candidate-${job.id}`,
        jobId: job.id,
        lat: point.lat,
        lng: point.lng,
        suburb: job.suburb || "Opportunity",
      };
    }
  }

  const line: GeoPoint[] = [];
  const pushUnique = (point: GeoPoint) => {
    const last = line[line.length - 1];
    if (last && sameCoordinate(last, point)) return;
    line.push(point);
  };
  if (start) pushUnique(start);
  for (const stop of stopMarkers) pushUnique({ lat: stop.lat, lng: stop.lng });
  if (finish) pushUnique(finish);

  const fitLocations: MapLocation[] = [];
  const seen = new Set<string>();
  const addFit = (point: GeoPoint, id: string) => {
    const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    fitLocations.push({ ...point, id });
  };
  if (start) addFit(start, "start");
  for (const stop of stopMarkers) addFit(stop, stop.id);
  if (finish) addFit(finish, "finish");

  return {
    offices,
    stops: stopMarkers,
    unresolvedJobIds,
    candidate,
    line,
    fitLocations,
  };
}

function shortOfficeLabel(value: string): string {
  if (value.toLowerCase().includes("milton")) return "Milton office";
  return value;
}
