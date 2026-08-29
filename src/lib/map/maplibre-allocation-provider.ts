import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  Popup,
  type GeoJSONSource,
} from "maplibre-gl";
import { addAllocationOverlays } from "@/lib/map/allocation-overlays";
import {
  jobsToGeoJSON,
  type AllocationMapModel,
  type CandidateLinkModel,
  type InsertionPreviewModel,
  type MapMarkerModel,
  type WeeklyPathModel,
} from "@/lib/map/allocation-map-model";
import { createLocalMapStyle, QLD_MAX_BOUNDS, queenslandContextData } from "@/lib/map/local-style";
import {
  OPENFREEMAP_STYLE_URL,
  type MapLibreBasemapKind,
} from "@/lib/map/maplibre-basemap";
import {
  configureMapLibreWorker,
  openFreeMapTransformRequest,
  waitForMapStyle,
} from "@/lib/map/maplibre-engine";
import {
  applyClusterMarkerCount,
  applyJobMarkerElement,
  bindActivate,
  createClusterMarkerElement,
  createJobMarkerElement,
  jobMarkerLngLat,
  markerPopupHtml,
} from "@/lib/map/marker-element";
import {
  type AllocationMapProvider,
  type MapLocation,
  type MapPadding,
  lngLatOf,
} from "@/lib/map/provider";

const DEFAULT_PADDING: MapPadding = { top: 52, right: 52, bottom: 64, left: 52 };
const SEQ_CENTER: [number, number] = [153.02, -27.22];

function isBlockedLocalUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("blob:") || url.startsWith("data:")) return false;
  if (typeof window !== "undefined" && url.startsWith(window.location.origin)) return false;
  if (url.startsWith("/")) return false;
  return /^(https?:)?\/\//i.test(url);
}

export class MapLibreAllocationProvider implements AllocationMapProvider {
  private map: MapLibreMap;
  private basemap: MapLibreBasemapKind;
  private markers = new Map<string, Marker>();
  private placeMarkers: Marker[] = [];
  private popup: Popup;
  private model: AllocationMapModel = {
    markers: [],
    candidateLinks: [],
    insertionPreview: null,
    weeklyPath: null,
    topMatches: [],
    activeMatch: null,
  };
  private padding: MapPadding;
  private onSelectJob: (jobId: string) => void;
  private markersDirty = true;
  private lastFitKey = "";
  private resizeObserver: ResizeObserver | null = null;

  private constructor(
    map: MapLibreMap,
    options: {
      basemap: MapLibreBasemapKind;
      padding?: Partial<MapPadding>;
      onSelectJob: (jobId: string) => void;
    }
  ) {
    this.map = map;
    this.basemap = options.basemap;
    this.padding = { ...DEFAULT_PADDING, ...options.padding };
    this.onSelectJob = options.onSelectJob;
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
    this.map.on("data", (event) => {
      if (event.dataType === "source" && event.sourceId === "jobs") this.queueMarkerSync();
    });
    this.map.on("zoomend", () => this.queueMarkerSync());
    this.map.on("moveend", () => this.queueMarkerSync());
    this.map.on("render", () => {
      if (!this.markersDirty) return;
      this.markersDirty = false;
      this.syncVisibleMarkers();
    });
    this.map.on("zoom", () => this.syncPlaceLabelOpacity());
    if (this.basemap === "local") this.addPlaceLabels();
  }

  static async create(
    container: HTMLElement,
    options: {
      basemap?: MapLibreBasemapKind;
      padding?: Partial<MapPadding>;
      onSelectJob: (jobId: string) => void;
    }
  ): Promise<MapLibreAllocationProvider> {
    configureMapLibreWorker();
    const basemap = options.basemap ?? "local";
    const openFreeMap = basemap === "openfreemap";
    const map = new MapLibreMap({
      container,
      style: openFreeMap ? OPENFREEMAP_STYLE_URL : createLocalMapStyle(),
      center: SEQ_CENTER,
      zoom: 7.2,
      minZoom: openFreeMap ? 5 : 4.2,
      maxZoom: openFreeMap ? 15 : 12.5,
      maxBounds: QLD_MAX_BOUNDS,
      attributionControl: openFreeMap ? { compact: true } : false,
      pitchWithRotate: false,
      fadeDuration: 0,
      transformRequest: (url) => {
        if (openFreeMap) {
          return openFreeMapTransformRequest(url);
        }
        if (isBlockedLocalUrl(url)) {
          return { url: "data:application/json,{}" };
        }
        return { url };
      },
    });
    await waitForMapStyle(map, openFreeMap ? 15000 : 8000, openFreeMap);
    if (openFreeMap) addAllocationOverlays(map);
    map.resize();
    return new MapLibreAllocationProvider(map, { ...options, basemap });
  }

  setPadding(padding: Partial<MapPadding>): void {
    this.padding = { ...this.padding, ...padding };
  }

  setModel(model: AllocationMapModel): void {
    this.model = model;
    this.showScheduledJobs(model.markers.filter((item) => item.kind === "scheduled"));
    this.showUnassignedJobs(model.markers.filter((item) => item.kind === "unassigned"));
    this.showCandidateLinks(model.candidateLinks);
    this.showInsertionPreview(model.insertionPreview);
    this.showWeeklyPath(model.weeklyPath ?? null);
    this.syncVisibleMarkers();
    this.refreshJobMarkerVisuals();
  }

  fitToLocations(locations: MapLocation[], padding?: Partial<MapPadding>): void {
    if (locations.length === 0) return;
    const pad = { ...this.padding, ...padding };
    if (locations.length === 1) {
      this.map.easeTo({
        center: lngLatOf(locations[0]),
        zoom: Math.min(10.4, this.map.getMaxZoom()),
        duration: 280,
        padding: pad,
      });
      return;
    }
    const bounds = new LngLatBounds();
    for (const point of locations) bounds.extend(lngLatOf(point));
    this.map.fitBounds(bounds, {
      padding: pad,
      maxZoom: 10.6,
      duration: 280,
    });
  }

  fitIfNeeded(key: string, locations: MapLocation[]): void {
    if (key === this.lastFitKey) return;
    this.lastFitKey = key;
    this.fitToLocations(locations);
  }

  focusLocation(location: MapLocation, zoom = 10.2): void {
    this.map.easeTo({
      center: lngLatOf(location),
      zoom: Math.min(zoom, this.map.getMaxZoom()),
      duration: 280,
      padding: this.padding,
    });
  }

  clearFocus(): void {
    this.fitToLocations(this.model.markers);
  }

  showScheduledJobs(jobs: MapMarkerModel[]): void {
    this.writeJobs(jobs, this.model.markers.filter((item) => item.kind === "unassigned"));
  }

  showUnassignedJobs(jobs: MapMarkerModel[]): void {
    this.writeJobs(this.model.markers.filter((item) => item.kind === "scheduled"), jobs);
  }

  showCandidateLinks(links: CandidateLinkModel[]): void {
    const source = this.map.getSource("links") as GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: links.map((item) => ({
        type: "Feature",
        properties: { rank: item.rank, id: item.id },
        geometry: {
          type: "LineString",
          coordinates: [lngLatOf(item.from), lngLatOf(item.to)],
        },
      })),
    });
  }

  showInsertionPreview(preview: InsertionPreviewModel | null): void {
    const source = this.map.getSource("preview") as GeoJSONSource | undefined;
    if (!source) return;
    if (!preview) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    const features: GeoJSON.Feature[] = [];
    if (preview.existing.length >= 2) {
      features.push({
        type: "Feature",
        properties: { kind: "existing" },
        geometry: {
          type: "LineString",
          coordinates: preview.existing.map((item) => [item.lng, item.lat]),
        },
      });
    }
    if (preview.proposed.length >= 2) {
      features.push({
        type: "Feature",
        properties: { kind: "proposed" },
        geometry: {
          type: "LineString",
          coordinates: preview.proposed.map((item) => [item.lng, item.lat]),
        },
      });
    }
    source.setData({ type: "FeatureCollection", features });
  }

  showWeeklyPath(path: WeeklyPathModel | null): void {
    const source = this.map.getSource("weekly") as GeoJSONSource | undefined;
    if (!source) return;
    if (!path || path.points.length < 2) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { colour: path.colour },
          geometry: {
            type: "LineString",
            coordinates: path.points.map((item) => [item.lng, item.lat]),
          },
        },
      ],
    });
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
    for (const marker of this.placeMarkers) marker.remove();
    this.placeMarkers = [];
    this.map.remove();
  }

  private writeJobs(scheduled: MapMarkerModel[], unassigned: MapMarkerModel[]): void {
    const source = this.map.getSource("jobs") as GeoJSONSource | undefined;
    source?.setData(jobsToGeoJSON([...scheduled, ...unassigned]));
    this.queueMarkerSync();
  }

  private queueMarkerSync(): void {
    this.markersDirty = true;
  }

  private refreshJobMarkerVisuals(): void {
    for (const [id, marker] of this.markers) {
      if (id.startsWith("cluster-")) continue;
      const item = this.model.markers.find((candidate) => candidate.id === id);
      if (item) applyJobMarkerElement(marker.getElement(), item);
    }
  }

  private addPlaceLabels(): void {
    const places = queenslandContextData().features.filter(
      (item) => item.properties?.kind === "place" && item.geometry.type === "Point"
    );
    for (const place of places) {
      if (place.geometry.type !== "Point") continue;
      const el = document.createElement("div");
      el.className = "prensa-map-place";
      el.textContent = String(place.properties?.name ?? "");
      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat(place.geometry.coordinates as [number, number])
        .addTo(this.map);
      this.placeMarkers.push(marker);
    }
    this.syncPlaceLabelOpacity();
  }

  private syncPlaceLabelOpacity(): void {
    const zoom = this.map.getZoom();
    const opacity = zoom >= 10.4 ? "0" : zoom >= 9.2 ? "0.35" : "0.7";
    for (const marker of this.placeMarkers) {
      marker.getElement().style.opacity = opacity;
    }
  }

  private syncVisibleMarkers(): void {
    if (!this.map.getSource("jobs")) return;
    const features = this.map.querySourceFeatures("jobs");
    const seen = new Set<string>();
    for (const feature of features) {
      const geometry = feature.geometry;
      if (geometry.type !== "Point") continue;
      const isCluster = Boolean(feature.properties?.cluster);
      const id = isCluster
        ? `cluster-${feature.properties?.cluster_id}`
        : String(feature.properties?.id ?? feature.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const existing = this.markers.get(id);
      if (existing) {
        if (isCluster) {
          existing.setLngLat(geometry.coordinates as [number, number]);
          applyClusterMarkerCount(existing.getElement(), Number(feature.properties?.point_count ?? 0));
        } else {
          const item = this.model.markers.find((marker) => marker.id === id);
          if (item) existing.setLngLat(jobMarkerLngLat(item));
        }
        continue;
      }
      if (isCluster) {
        const clusterId = Number(feature.properties?.cluster_id);
        const el = createClusterMarkerElement(Number(feature.properties?.point_count ?? 0));
        const marker = new Marker({ element: el, anchor: "center" })
          .setLngLat(geometry.coordinates as [number, number])
          .addTo(this.map);
        bindActivate(el, () => {
          const lngLat = marker.getLngLat();
          void this.expandCluster(clusterId, [lngLat.lng, lngLat.lat]);
        });
        this.markers.set(id, marker);
        continue;
      }
      const item = this.model.markers.find((marker) => marker.id === id);
      if (!item) continue;
      const el = createJobMarkerElement(item);
      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat(jobMarkerLngLat(item))
        .addTo(this.map);
      bindActivate(el, () => this.onSelectJob(item.id));
      el.addEventListener("mouseenter", () => this.showPopup(item.id));
      el.addEventListener("mouseleave", () => this.popup.remove());
      this.markers.set(id, marker);
    }
    for (const [id, marker] of this.markers) {
      if (seen.has(id)) continue;
      marker.remove();
      this.markers.delete(id);
    }
  }

  private showPopup(jobId: string): void {
    const item = this.model.markers.find((marker) => marker.id === jobId);
    if (!item) return;
    this.popup.setLngLat(jobMarkerLngLat(item)).setHTML(markerPopupHtml(item)).addTo(this.map);
  }

  private async expandCluster(clusterId: number, coordinates: [number, number]): Promise<void> {
    const source = this.map.getSource("jobs") as GeoJSONSource | undefined;
    if (!source) return;
    const zoom = await source.getClusterExpansionZoom(clusterId);
    this.map.easeTo({ center: coordinates, zoom, duration: 280 });
  }
}

