import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@/lib/dummy-data";
import { geocodeAddress } from "@/lib/geo";
import { buildDayRouteMapModel } from "@/lib/map/day-route-map-model";
import type { Job, RouteStop } from "@/lib/types";

function job(id: string, address: string): Job {
  const geo = geocodeAddress(address);
  return {
    id,
    address: geo?.address ?? address,
    suburb: geo?.suburb,
    latitude: geo?.lat,
    longitude: geo?.lng,
    estimatedMinutes: 20,
    constraint: { type: "flexible" },
    bookingStatus: "uncontacted",
  };
}

function stop(jobId: string, order: number): RouteStop {
  return { id: `stop-${jobId}`, jobId, order };
}

describe("day route map model", () => {
  it("anchors resolved stops and skips unresolved addresses", () => {
    const jobs = {
      a: job("a", "12 Example St, Indooroopilly"),
      b: job("b", "cork st deception bay"),
      c: job("c", "15 Test Ave, Darra"),
    };
    const model = buildDayRouteMapModel({
      settings: DEFAULT_SETTINGS,
      stops: [stop("a", 0), stop("b", 1), stop("c", 2)],
      jobs,
      selectedJobId: "c",
      selectedKind: "stop",
    });

    assert.deepEqual(
      model.stops.map((item) => item.order),
      [1, 3]
    );
    assert.equal(model.stops[0].suburb, "Indooroopilly");
    assert.equal(model.stops[1].suburb, "Darra");
    assert.equal(model.stops[1].selected, true);
    assert.deepEqual(model.unresolvedJobIds, ["b"]);
    assert.equal(
      model.line.some((point) => point.lat === 0 && point.lng === 0),
      false
    );
    assert.equal(model.offices.length, 1);
    assert.equal(model.offices[0].role, "start-finish");
  });

  it("draws a schematic line through start, resolved stops, and finish", () => {
    const jobs = {
      a: job("a", "12 Example St, Indooroopilly"),
      b: job("b", "84 Sample Rd, Oxley"),
    };
    const model = buildDayRouteMapModel({
      settings: DEFAULT_SETTINGS,
      stops: [stop("a", 0), stop("b", 1)],
      jobs,
      selectedJobId: null,
      selectedKind: null,
    });
    assert.ok(model.line.length >= 3);
    assert.equal(model.line[0].lat, DEFAULT_SETTINGS.startLat);
    assert.equal(model.line[model.line.length - 1].lat, DEFAULT_SETTINGS.finishLat);
    assert.equal(model.fitLocations.length >= 3, true);
  });

  it("previews a selected nearby opportunity without adding it to the line", () => {
    const jobs = {
      a: job("a", "12 Example St, Indooroopilly"),
      n: job("n", "8 Railway Pde, Darra"),
    };
    const model = buildDayRouteMapModel({
      settings: DEFAULT_SETTINGS,
      stops: [stop("a", 0)],
      jobs,
      selectedJobId: "n",
      selectedKind: "unbooked",
    });
    assert.ok(model.candidate);
    assert.equal(model.candidate?.jobId, "n");
    assert.equal(
      model.line.some(
        (point) =>
          Math.abs(point.lat - (jobs.n.latitude ?? 0)) < 1e-6 &&
          Math.abs(point.lng - (jobs.n.longitude ?? 0)) < 1e-6
      ),
      false
    );
  });

  it("B. draws returned road geometry instead of the schematic polyline", () => {
    const jobs = {
      a: job("a", "12 Example St, Indooroopilly"),
      b: job("b", "84 Sample Rd, Oxley"),
    };
    const roadLine = [
      { lat: -27.47, lng: 153.006 },
      { lat: -27.49, lng: 153.0 },
      { lat: -27.51, lng: 152.99 },
      { lat: -27.56, lng: 152.978 },
    ];
    const model = buildDayRouteMapModel({
      settings: DEFAULT_SETTINGS,
      stops: [stop("a", 0), stop("b", 1)],
      jobs,
      selectedJobId: null,
      selectedKind: null,
      roadLine,
    });
    assert.equal(model.line.length, roadLine.length);
    assert.deepEqual(model.line[1], roadLine[1]);
    assert.equal(model.stops.length, 2);
  });
});
