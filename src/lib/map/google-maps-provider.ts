import Supercluster from "supercluster";
import type {
  AllocationMapModel,
  CandidateLinkModel,
  InsertionPreviewModel,
  MapMarkerModel,
  WeeklyPathModel,
} from "@/lib/map/allocation-map-model";
import { GOOGLE_BASEMAP_STYLES } from "@/lib/map/google-basemap-style";
import { createHtmlOverlayClass, type HtmlOverlayHandle } from "@/lib/map/google-html-overlay";
import { loadGoogleMapsApi } from "@/lib/map/google-maps-loader";
import {
  GOOGLE_DEFAULT_ZOOM,
  GOOGLE_MAX_ZOOM,
  GOOGLE_MIN_ZOOM,
  GOOGLE_SEQ_CENTER,
  GOOGLE_SINGLE_MARKER_ZOOM,
  candidatePolylineStyle,
  insertionExistingStyle,
  insertionProposedStyle,
  qldRestrictionBounds,
  schematicPath,
  toLatLngLiteral,
  weeklyPathStyle,
  type SchematicLineStyle,
} from "@/lib/map/google-view-helpers";
import {
  applyClusterMarkerCount,
  applyJobMarkerElement,
  bindActivate,
  createClusterMarkerElement,
  createJobMarkerElement,
  markerPopupHtml,
} from "@/lib/map/marker-element";
import {
  type AllocationMapProvider,
  type MapLocation,
  type MapPadding,
} from "@/lib/map/provider";

const DEFAULT_PADDING: MapPadding = { top: 52, right: 52, bottom: 64, left: 52 };

type ClusterIndex = Supercluster<{ id: string }>;

export class GoogleMapsProvider implements AllocationMapProvider {
  private map: google.maps.Map;
  private maps: google.maps.MapsLibrary;
  private core: google.maps.CoreLibrary;
  private HtmlOverlay: ReturnType<typeof createHtmlOverlayClass>;
  private overlays = new Map<string, HtmlOverlayHandle>();
  private polylines: google.maps.Polyline[] = [];
  private popup: HtmlOverlayHandle | null = null;
  private popupEl: HTMLDivElement;
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
  private lastFitKey = "";
  private clusterIndex: ClusterIndex = new Supercluster({ radius: 36, maxZoom: 7, minPoints: 2 });
  private resizeObserver: ResizeObserver | null = null;
  private listeners: Array<{ remove: () => void }> = [];

  private constructor(
    map: google.maps.Map,
    maps: google.maps.MapsLibrary,
    core: google.maps.CoreLibrary,
    options: { padding?: Partial<MapPadding>; onSelectJob: (jobId: string) => void }
  ) {
    this.map = map;
    this.maps = maps;
    this.core = core;
    this.HtmlOverlay = createHtmlOverlayClass(maps, core);
    this.padding = { ...DEFAULT_PADDING, ...options.padding };
    this.onSelectJob = options.onSelectJob;
    this.popupEl = document.createElement("div");
    this.popupEl.className = "prensa-map-google-pop";
    this.popupEl.style.pointerEvents = "none";

    const container = this.map.getDiv();
    this.resizeObserver = new ResizeObserver(() => {
      this.core.event.trigger(this.map, "resize");
    });
    this.resizeObserver.observe(container);

    this.listeners.push(
      this.core.event.addListener(this.map, "idle", () => this.syncOverlays()),
      this.core.event.addListener(this.map, "zoom_changed", () => this.syncOverlays())
    );
  }

  static async create(
    container: HTMLElement,
    options: { padding?: Partial<MapPadding>; onSelectJob: (jobId: string) => void; apiKey: string }
  ): Promise<GoogleMapsProvider> {
    const { core, maps } = await loadGoogleMapsApi(options.apiKey);
    const map = new maps.Map(container, {
      center: GOOGLE_SEQ_CENTER,
      zoom: GOOGLE_DEFAULT_ZOOM,
      minZoom: GOOGLE_MIN_ZOOM,
      maxZoom: GOOGLE_MAX_ZOOM,
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      rotateControl: false,
      scaleControl: false,
      clickableIcons: false,
      gestureHandling: "greedy",
      keyboardShortcuts: true,
      isFractionalZoomEnabled: true,
      restriction: {
        latLngBounds: qldRestrictionBounds(),
        strictBounds: false,
      },
      styles: GOOGLE_BASEMAP_STYLES,
    });

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      core.event.addListenerOnce(map, "idle", done);
      window.setTimeout(done, 12000);
    });

    return new GoogleMapsProvider(map, maps, core, options);
  }

  setPadding(padding: Partial<MapPadding>): void {
    this.padding = { ...this.padding, ...padding };
  }

  setModel(model: AllocationMapModel): void {
    this.model = model;
    this.rebuildClusters();
    this.syncOverlays();
    this.syncPolylines();
  }

  fitToLocations(locations: MapLocation[], padding?: Partial<MapPadding>): void {
    if (locations.length === 0) return;
    const pad = { ...this.padding, ...padding };
    if (locations.length === 1) {
      this.map.panTo(toLatLngLiteral(locations[0]));
      this.map.setZoom(Math.min(GOOGLE_SINGLE_MARKER_ZOOM, GOOGLE_MAX_ZOOM));
      return;
    }
    const bounds = new this.core.LatLngBounds();
    for (const point of locations) bounds.extend(toLatLngLiteral(point));
    this.map.fitBounds(bounds, pad);
    const zoom = this.map.getZoom();
    if (zoom != null && zoom > 10.6) this.map.setZoom(10.6);
  }

  fitIfNeeded(key: string, locations: MapLocation[]): void {
    if (key === this.lastFitKey) return;
    this.lastFitKey = key;
    this.fitToLocations(locations);
  }

  focusLocation(location: MapLocation, zoom = 10.2): void {
    this.map.panTo(toLatLngLiteral(location));
    this.map.setZoom(Math.min(zoom, GOOGLE_MAX_ZOOM));
  }

  clearFocus(): void {
    this.fitToLocations(this.model.markers);
  }

  showScheduledJobs(jobs: MapMarkerModel[]): void {
    this.model = {
      ...this.model,
      markers: [...jobs, ...this.model.markers.filter((item) => item.kind === "unassigned")],
    };
  }

  showUnassignedJobs(jobs: MapMarkerModel[]): void {
    this.model = {
      ...this.model,
      markers: [...this.model.markers.filter((item) => item.kind === "scheduled"), ...jobs],
    };
  }

  showCandidateLinks(links: CandidateLinkModel[]): void {
    this.model = { ...this.model, candidateLinks: links };
    this.syncPolylines();
  }

  showInsertionPreview(preview: InsertionPreviewModel | null): void {
    this.model = { ...this.model, insertionPreview: preview };
    this.syncPolylines();
  }

  showWeeklyPath(path: WeeklyPathModel | null): void {
    this.model = { ...this.model, weeklyPath: path };
    this.syncPolylines();
  }

  zoomIn(): void {
    this.map.setZoom((this.map.getZoom() ?? GOOGLE_DEFAULT_ZOOM) + 1);
  }

  zoomOut(): void {
    this.map.setZoom((this.map.getZoom() ?? GOOGLE_DEFAULT_ZOOM) - 1);
  }

  destroy(): void {
    this.hidePopup();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    for (const listener of this.listeners) listener.remove();
    this.listeners = [];
    for (const overlay of this.overlays.values()) overlay.setMap(null);
    this.overlays.clear();
    for (const line of this.polylines) line.setMap(null);
    this.polylines = [];
    this.map.unbindAll();
  }

  private rebuildClusters(): void {
    this.clusterIndex = new Supercluster({ radius: 36, maxZoom: 7, minPoints: 2 });
    this.clusterIndex.load(
      this.model.markers.map((item) => ({
        type: "Feature" as const,
        properties: { id: item.id },
        geometry: { type: "Point" as const, coordinates: [item.lng, item.lat] as [number, number] },
      }))
    );
  }

  private syncOverlays(): void {
    const bounds = this.map.getBounds();
    const zoom = Math.max(0, Math.round(this.map.getZoom() ?? GOOGLE_DEFAULT_ZOOM));
    const bbox = bounds
      ? expandBbox([
          bounds.getSouthWest().lng(),
          bounds.getSouthWest().lat(),
          bounds.getNorthEast().lng(),
          bounds.getNorthEast().lat(),
        ])
      : ([-180, -85, 180, 85] as [number, number, number, number]);
    const clusters = this.clusterIndex.getClusters(bbox, zoom);
    const seen = new Set<string>();

    for (const feature of clusters) {
      const geometry = feature.geometry;
      if (geometry.type !== "Point") continue;
      const [lng, lat] = geometry.coordinates;
      const position = { lat, lng };
      const isCluster = Boolean(
        feature.properties && "cluster" in feature.properties && feature.properties.cluster
      );
      const clusterMeta = isCluster ? clusterMetaOf(feature.properties) : null;
      const id = clusterMeta
        ? `cluster-${clusterMeta.clusterId}`
        : String((feature.properties as { id?: string } | null)?.id ?? "");
      if (!id) continue;
      seen.add(id);
      const existing = this.overlays.get(id);
      if (existing) {
        existing.setPosition(position);
        if (!isCluster) {
          const item = this.model.markers.find((marker) => marker.id === id);
          if (item) applyJobMarkerElement(existing.element, item);
        } else if (clusterMeta) {
          applyClusterMarkerCount(existing.element, clusterMeta.count);
        }
        continue;
      }
      if (clusterMeta) {
        const el = createClusterMarkerElement(clusterMeta.count);
        bindActivate(el, () => this.expandCluster(clusterMeta.clusterId, position));
        const overlay = new this.HtmlOverlay(position, el);
        overlay.setMap(this.map);
        this.overlays.set(id, overlay);
        continue;
      }
      const item = this.model.markers.find((marker) => marker.id === id);
      if (!item) continue;
      const el = createJobMarkerElement(item);
      bindActivate(el, () => this.onSelectJob(item.id));
      el.addEventListener("mouseenter", () => this.showPopup(item, position));
      el.addEventListener("mouseleave", () => this.hidePopup());
      const overlay = new this.HtmlOverlay(position, el);
      overlay.setMap(this.map);
      this.overlays.set(id, overlay);
    }

    for (const [id, overlay] of this.overlays) {
      if (seen.has(id)) continue;
      overlay.setMap(null);
      this.overlays.delete(id);
    }
  }

  private expandCluster(clusterId: number, position: google.maps.LatLngLiteral): void {
    const nextZoom = Math.min(this.clusterIndex.getClusterExpansionZoom(clusterId), GOOGLE_MAX_ZOOM);
    this.map.panTo(position);
    this.map.setZoom(Math.max(nextZoom, (this.map.getZoom() ?? GOOGLE_DEFAULT_ZOOM) + 1));
  }

  private syncPolylines(): void {
    for (const line of this.polylines) line.setMap(null);
    this.polylines = [];
    for (const link of this.model.candidateLinks) {
      this.polylines.push(
        this.line([toLatLngLiteral(link.from), toLatLngLiteral(link.to)], candidatePolylineStyle(link.rank))
      );
    }
    const preview = this.model.insertionPreview;
    if (preview?.existing.length && preview.existing.length >= 2) {
      this.polylines.push(this.line(schematicPath(preview.existing), insertionExistingStyle()));
    }
    if (preview?.proposed.length && preview.proposed.length >= 2) {
      this.polylines.push(this.line(schematicPath(preview.proposed), insertionProposedStyle()));
    }
    const weekly = this.model.weeklyPath;
    if (weekly && weekly.points.length >= 2) {
      this.polylines.push(this.line(schematicPath(weekly.points), weeklyPathStyle(weekly.colour)));
    }
  }

  private line(path: google.maps.LatLngLiteral[], style: SchematicLineStyle): google.maps.Polyline {
    return new this.maps.Polyline({
      map: this.map,
      path,
      geodesic: false,
      clickable: false,
      strokeColor: style.strokeColor,
      strokeOpacity: style.strokeOpacity,
      strokeWeight: style.strokeWeight,
      zIndex: style.zIndex,
      icons: style.icons as google.maps.IconSequence[] | undefined,
    });
  }

  private showPopup(item: MapMarkerModel, position: google.maps.LatLngLiteral): void {
    this.popupEl.innerHTML = markerPopupHtml(item);
    if (!this.popup) {
      this.popup = new this.HtmlOverlay(position, this.popupEl, "floatPane");
      this.popup.setMap(this.map);
    } else {
      this.popup.setPosition({ lat: position.lat - 0.00001, lng: position.lng });
      this.popup.setPosition(position);
    }
    this.popupEl.style.transform = "translate(-50%, calc(-100% - 10px))";
  }

  private hidePopup(): void {
    this.popup?.setMap(null);
    this.popup = null;
  }
}

function expandBbox(
  bbox: [number, number, number, number]
): [number, number, number, number] {
  const [west, south, east, north] = bbox;
  const padX = Math.max((east - west) * 0.12, 0.02);
  const padY = Math.max((north - south) * 0.12, 0.02);
  return [west - padX, south - padY, east + padX, north + padY];
}

function clusterMetaOf(
  properties: GeoJSON.GeoJsonProperties | null | undefined
): { clusterId: number; count: number } | null {
  if (!properties || properties.cluster !== true) return null;
  return {
    clusterId: Number(properties.cluster_id),
    count: Number(properties.point_count ?? 0),
  };
}
