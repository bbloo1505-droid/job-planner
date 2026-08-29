import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAllocationMapModel,
  buildInsertionPreview,
  jobsToGeoJSON,
  locationsForFit,
  searchMapMarkers,
} from "@/lib/map/allocation-map-model";
import { collectNetworkUrls, createLocalMapStyle, queenslandContextData } from "@/lib/map/local-style";
import { MAP_PROVIDER_KIND } from "@/lib/map/provider";
import { createTeamDemo } from "@/lib/team/dummy-data";
import { isoDate, weekDays } from "@/lib/team/week";
import { rankAllocationCandidates } from "@/lib/geo/rank-allocation-candidates";

const WEEK = weekDays("2026-08-31").map(isoDate);

describe("local MapLibre style", () => {
  it("bundles Queensland context without network URLs, tiles, glyphs, or sprites", () => {
    const style = createLocalMapStyle();
    assert.equal(style.glyphs, undefined);
    assert.equal(style.sprite, undefined);
    const urls = collectNetworkUrls(style);
    assert.deepEqual(urls, []);
    const jobs = style.sources.jobs;
    assert.equal(jobs.type, "geojson");
    if (jobs.type === "geojson") {
      assert.equal(jobs.cluster, true);
    }
    const kinds = new Set(
      queenslandContextData().features.map((item) => String(item.properties?.kind ?? ""))
    );
    assert.equal(kinds.has("state"), true);
    assert.equal(kinds.has("seq"), true);
    assert.equal(kinds.has("place"), true);
    const names = queenslandContextData()
      .features.filter((item) => item.properties?.kind === "place")
      .map((item) => String(item.properties?.name));
    for (const name of [
      "Brisbane",
      "Gold Coast",
      "Sunshine Coast",
      "Toowoomba",
      "Gympie",
      "Bundaberg",
      "Rockhampton",
    ]) {
      assert.equal(names.includes(name), true, name);
    }
    assert.equal(MAP_PROVIDER_KIND, "local-maplibre");
  });
});

describe("allocation map model", () => {
  it("builds a Nambour insertion preview on Taylor / Thursday", () => {
    const demo = createTeamDemo();
    const nambour = demo.jobs["tj-120"];
    const ranked = rankAllocationCandidates({
      job: nambour,
      consultants: demo.consultants,
      jobs: demo.jobs,
      allocations: demo.allocations,
      workingDays: WEEK,
    });
    assert.equal(ranked[0].consultantId, "c-taylor");
    assert.equal(ranked[0].date, "2026-09-03");

    const preview = buildInsertionPreview({
      job: nambour,
      candidate: ranked[0],
      jobs: demo.jobs,
      allocations: demo.allocations,
    });
    assert.ok(preview);
    const labels = preview.proposed.map((item) => item.label);
    assert.equal(labels.includes("Nambour"), true);
    assert.equal(labels.includes("Maroochydore"), true);
    assert.equal(labels.includes("Buderim"), true);
    assert.equal(preview.proposed.find((item) => item.inserted)?.label, "Nambour");
    assert.deepEqual(
      preview.existing.map((item) => item.label),
      ["Maroochydore", "Buderim"]
    );

    const model = buildAllocationMapModel({
      jobs: demo.jobs,
      allocations: demo.allocations,
      consultants: demo.consultants,
      geoScope: "2026-09-03",
      hiddenConsultantIds: [],
      selectedJobId: "tj-120",
      selectedConsultantId: null,
      workingDays: WEEK,
      allocationPreview: {
        jobId: "tj-120",
        consultantId: "c-taylor",
        date: "2026-09-03",
      },
    });
    assert.equal(model.activeMatch?.consultantId, "c-taylor");
    assert.equal(model.insertionPreview?.proposed.some((item) => item.inserted), true);
    assert.ok(model.candidateLinks.length > 0);
    const nambourMarker = model.markers.find((item) => item.id === "tj-120");
    assert.equal(nambourMarker?.kind, "unassigned");
    assert.equal(nambourMarker?.selected, true);
  });

  it("fits match-mode locations to the unassigned job and insertion stops", () => {
    const demo = createTeamDemo();
    const model = buildAllocationMapModel({
      jobs: demo.jobs,
      allocations: demo.allocations,
      consultants: demo.consultants,
      geoScope: "2026-09-03",
      hiddenConsultantIds: [],
      selectedJobId: "tj-120",
      selectedConsultantId: null,
      workingDays: WEEK,
      allocationPreview: {
        jobId: "tj-120",
        consultantId: "c-taylor",
        date: "2026-09-03",
      },
    });
    const fit = locationsForFit({
      model,
      selectedConsultantId: null,
      matchMode: true,
    });
    const ids = new Set(model.insertionPreview?.proposed.map((item) => item.id));
    assert.ok(fit.length >= 2);
    assert.ok(ids.has("tj-120"));
  });

  it("searches synthetic job numbers and suburbs locally", () => {
    const demo = createTeamDemo();
    const model = buildAllocationMapModel({
      jobs: demo.jobs,
      allocations: demo.allocations,
      consultants: demo.consultants,
      geoScope: "week",
      hiddenConsultantIds: [],
      selectedJobId: null,
      selectedConsultantId: null,
      workingDays: WEEK,
      allocationPreview: null,
    });
    const nambour = searchMapMarkers(model.markers, "Nambour");
    assert.equal(nambour.length, 1);
    assert.equal(nambour[0].id, "tj-120");
    const byNumber = searchMapMarkers(model.markers, nambour[0].jobNumber ?? "PR-TEST");
    assert.ok(byNumber.length >= 1);
  });

  it("encodes at least 50 synthetic markers without changing coordinates", () => {
    const markers = Array.from({ length: 56 }, (_, index) => ({
      id: `load-${index}`,
      kind: "unassigned" as const,
      lat: -27.47 + (index % 8) * 0.04,
      lng: 153.02 + Math.floor(index / 8) * 0.05,
      colour: "#9a5a58",
      initials: "",
      consultantId: null,
      consultantName: "Unassigned",
      label: `Load ${index}`,
      priority: "normal" as const,
      selected: false,
      opacity: 1,
      matchRank: null,
    }));
    const geojson = jobsToGeoJSON(markers);
    assert.equal(geojson.features.length, 56);
    geojson.features.forEach((feature, index) => {
      assert.equal(feature.geometry.type, "Point");
      if (feature.geometry.type === "Point") {
        assert.equal(feature.geometry.coordinates[0], markers[index].lng);
        assert.equal(feature.geometry.coordinates[1], markers[index].lat);
      }
    });
  });

  it("keeps weekly schematic points ordered by date for a focused consultant", () => {
    const demo = createTeamDemo();
    const model = buildAllocationMapModel({
      jobs: demo.jobs,
      allocations: demo.allocations,
      consultants: demo.consultants,
      geoScope: "week",
      hiddenConsultantIds: [],
      selectedJobId: null,
      selectedConsultantId: "c-taylor",
      workingDays: WEEK,
      allocationPreview: null,
    });
    assert.ok(model.weeklyPath);
    assert.equal(model.weeklyPath?.consultantId, "c-taylor");
    const dates = model.weeklyPath?.points.map((item) => item.date) ?? [];
    const sorted = [...dates].sort();
    assert.deepEqual(dates, sorted);
    assert.ok((model.weeklyPath?.points.length ?? 0) >= 2);
  });
});
