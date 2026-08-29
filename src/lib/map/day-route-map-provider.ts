import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  Popup,
  type GeoJSONSource,
} from "maplibre-gl";
import type { DayRouteMapModel } from "@/lib/map/day-route-map-model";
import {
  applyCandidateMarkerElement,
  applyOfficeMarkerElement,
  applyStopMarkerElement,
  bindActivate,
  createCandidateMarkerElement,
  createOfficeMarkerElement,
  createStopMarkerElement,
  stopPopupHtml,
} from "@/lib/map/day-route-markers";
import { OPENFREEMAP_STYLE_URL } from "@/lib/map/maplibre-basemap";
import {
  configureMapLibreWorker,
  openFreeMapTransformRequest,
  waitForMapStyle,
} from "@/lib/map/maplibre-engine";
import { QLD_MAX_BOUNDS } from "@/lib/map/local-style";
import type { MapLocation, MapPadding } from "@/lib/map/provider";
import { lngLatOf } from "@/lib/map/provider";

const DEFAULT_PADDING: MapPadding = { top: 48, right: 48, bottom: 72, left: 48 };
const BRISBANE_CENTER: [number, number] = [152.99, -27.54];
const LINE_SOURCE = "day-route-line";
const LINE_LAYER = "day-route-line";
const LINE_CASING = "day-route-line-casing";

type SelectRouteJob = (jobId: string, kind: "stop" | "unbooked") => void;

export class DayRouteMapProvider {
  private map: MapLibreMap;
  private markers = new Map<string, Marker>();
  private popup: Popup;
  private model: DayRouteMapModel;
  private padding: MapPadding;
  private onSelectJob: SelectRouteJob;
  private resizeObserver: ResizeObserver | null = null;
  private fittedOnce = false;

  private constructor(
    map: MapLibreMap,
    options: {
      padding?: Partial<MapPadding>;
      onSelectJob: SelectRouteJob;
    }
  ) {
    this.map = map;
    this.padding = { ...DEFAULT_PADDING, ...options.padding };
    this.onSelectJob = options.onSelectJob;
    this.model = {
      offices: [],
      stops: [],
      unresolvedJobIds: [],
      candidate: null,
      line: [],
      fitLocations: [],
    };
    this.popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 16,
      className: "prensa-map-pop",
      maxWidth: "220px",
    });
    this.map.dragRotate.disable();
    this.map.touchZoomRotate.disableRotation();
    this.resizeObserver = new ResizeObserver(() => {
      this.map.resize();
    });
    this.resizeObserver.observe(this.map.getContainer());
    this.map.resize();
  }

  static async create(
    container: HTMLElement,
    options: {
      padding?: Partial<MapPadding>;
      onSelectJob: SelectRouteJob;
    }
  ): Promise<DayRouteMapProvider> {
    configureMapLibreWorker();
    const map = new MapLibreMap({
      container,
      style: OPENFREEMAP_STYLE_URL,
      center: BRISBANE_CENTER,
      zoom: 10.4,
      minZoom: 5,
      maxZoom: 16,
      maxBounds: QLD_MAX_BOUNDS,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      fadeDuration: 0,
      transformRequest: (url) => openFreeMapTransformRequest(url),
    });
    const provider = new DayRouteMapProvider(map, options);
    void waitForMapStyle(map, 20000, false).then(() => {
      provider.onStyleReady();
    });
    return provider;
  }

  private onStyleReady(): void {
    this.addRouteLineLayers();
    this.setModel(this.model);
    this.fitInitial();
    this.map.resize();
  }

  setModel(model: DayRouteMapModel): void {
    this.model = model;
    this.writeLine(model);
    this.syncMarkers(model);
    this.refreshPopup(model);
  }

  fitRoute(locations = this.model.fitLocations): void {
    if (locations.length === 0) {
      this.map.easeTo({
        center: BRISBANE_CENTER,
        zoom: 10.4,
        duration: 280,
        padding: this.padding,
      });
      return;
    }
    if (locations.length === 1) {
      this.map.easeTo({
        center: lngLatOf(locations[0]),
        zoom: 12.2,
        duration: 280,
        padding: this.padding,
      });
      return;
    }
    const bounds = new LngLatBounds();
    for (const point of locations) bounds.extend(lngLatOf(point));
    this.map.fitBounds(bounds, {
      padding: this.padding,
      maxZoom: 12.4,
      duration: 320,
    });
  }

  fitInitial(): void {
    if (this.fittedOnce) return;
    this.fittedOnce = true;
    this.fitRoute();
  }

  focusStop(jobId: string): void {
    const stop = this.model.stops.find((item) => item.jobId === jobId);
    if (!stop) {
      this.popup.remove();
      return;
    }
    const lngLat: [number, number] = [stop.lng, stop.lat];
    if (!this.map.getBounds().contains(lngLat)) {
      this.map.easeTo({
        center: lngLat,
        duration: 360,
        padding: this.padding,
      });
    }
    this.popup.setLngLat(lngLat).setHTML(stopPopupHtml(stop)).addTo(this.map);
  }

  zoomIn(): void {
    this.map.zoomIn({ duration: 180 });
  }

  zoomOut(): void {
    this.map.zoomOut({ duration: 180 });
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.popup.remove();
    for (const marker of this.markers.values()) marker.remove();
    this.markers.clear();
    this.map.remove();
  }

  private addRouteLineLayers(): void {
    if (this.map.getSource(LINE_SOURCE)) return;
    this.map.addSource(LINE_SOURCE, {
      type: "geojson",
      data: emptyCollection(),
    });
    this.map.addLayer({
      id: LINE_CASING,
      type: "line",
      source: LINE_SOURCE,
      paint: {
        "line-color": "#cfe2f1",
        "line-width": 7,
        "line-opacity": 0.95,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });
    this.map.addLayer({
      id: LINE_LAYER,
      type: "line",
      source: LINE_SOURCE,
      paint: {
        "line-color": "#1a2744",
        "line-width": 2.25,
        "line-opacity": 0.92,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });
  }

  private writeLine(model: DayRouteMapModel): void {
    const source = this.map.getSource(LINE_SOURCE) as GeoJSONSource | undefined;
    if (!source) return;
    if (model.line.length < 2) {
      source.setData(emptyCollection());
      return;
    }
    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: model.line.map((point) => [point.lng, point.lat]),
          },
        },
      ],
    });
  }

  private syncMarkers(model: DayRouteMapModel): void {
    const seen = new Set<string>();

    for (const office of model.offices) {
      seen.add(office.id);
      const existing = this.markers.get(office.id);
      if (existing) {
        existing.setLngLat([office.lng, office.lat]);
        applyOfficeMarkerElement(existing.getElement(), office);
        continue;
      }
      const el = createOfficeMarkerElement(office);
      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat([office.lng, office.lat])
        .addTo(this.map);
      this.markers.set(office.id, marker);
    }

    for (const stop of model.stops) {
      seen.add(stop.id);
      const existing = this.markers.get(stop.id);
      if (existing) {
        existing.setLngLat([stop.lng, stop.lat]);
        applyStopMarkerElement(existing.getElement(), stop);
        continue;
      }
      const el = createStopMarkerElement(stop);
      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat([stop.lng, stop.lat])
        .addTo(this.map);
      bindActivate(el, () => this.onSelectJob(stop.jobId, "stop"));
      this.markers.set(stop.id, marker);
    }

    if (model.candidate) {
      const candidate = model.candidate;
      seen.add(candidate.id);
      const existing = this.markers.get(candidate.id);
      if (existing) {
        existing.setLngLat([candidate.lng, candidate.lat]);
        applyCandidateMarkerElement(existing.getElement(), candidate);
      } else {
        const el = createCandidateMarkerElement(candidate);
        const marker = new Marker({ element: el, anchor: "center" })
          .setLngLat([candidate.lng, candidate.lat])
          .addTo(this.map);
        bindActivate(el, () => this.onSelectJob(candidate.jobId, "unbooked"));
        this.markers.set(candidate.id, marker);
      }
    }

    for (const [id, marker] of this.markers) {
      if (seen.has(id)) continue;
      marker.remove();
      this.markers.delete(id);
    }
  }

  private refreshPopup(model: DayRouteMapModel): void {
    const selected = model.stops.find((item) => item.selected);
    if (!selected) {
      this.popup.remove();
      return;
    }
    this.popup
      .setLngLat([selected.lng, selected.lat])
      .setHTML(stopPopupHtml(selected))
      .addTo(this.map);
  }
}

function emptyCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

export type { MapLocation };
