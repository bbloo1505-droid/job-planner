import type { MapMarkerModel } from "@/lib/map/allocation-map-model";

/** MapLibre/Google-managed root. Do not put transform/left/top/position on this node. */
export const MARKER_ANCHOR_CLASS = "prensa-map-marker-anchor";
export const MARKER_VISUAL_CLASS = "prensa-map-marker";
export const CLUSTER_VISUAL_CLASS = "prensa-map-cluster";

export function jobMarkerLngLat(item: Pick<MapMarkerModel, "lng" | "lat">): [number, number] {
  return [item.lng, item.lat];
}

export function createJobMarkerElement(item: MapMarkerModel): HTMLDivElement {
  const root = document.createElement("div");
  root.className = MARKER_ANCHOR_CLASS;
  applyJobMarkerElement(root, item);
  return root;
}

export function applyJobMarkerElement(el: HTMLElement, item: MapMarkerModel): void {
  el.classList.add(MARKER_ANCHOR_CLASS);
  el.dataset.markerId = item.id;
  el.dataset.markerKind = item.kind;
  if (item.matchRank != null) el.dataset.matchRank = String(item.matchRank);
  else delete el.dataset.matchRank;
  el.style.zIndex = item.selected ? "24" : item.kind === "unassigned" ? "12" : "16";
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  el.setAttribute(
    "aria-label",
    item.kind === "unassigned" ? `Unassigned job ${item.label}` : `${item.consultantName}, ${item.label}`
  );

  const visual = ensureChild(el, MARKER_VISUAL_CLASS);
  const unassigned = item.kind === "unassigned";
  visual.className = [
    MARKER_VISUAL_CLASS,
    unassigned ? "is-unassigned" : "is-scheduled",
    item.selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
  visual.style.setProperty("--marker-colour", item.colour);
  visual.style.opacity = String(item.opacity);
  visual.dataset.initials = item.initials;

  const pin = ensureChild(visual, "prensa-map-marker-pin");
  pin.className = "prensa-map-marker-pin";
  const dot = ensureChild(pin, "prensa-map-marker-dot");
  dot.className = "prensa-map-marker-dot";
  removeChild(visual, "prensa-map-marker-initials");

  if (item.dayLabel) {
    const day = ensureChild(visual, "prensa-map-marker-day", "span");
    day.textContent = item.dayLabel;
  } else {
    removeChild(visual, "prensa-map-marker-day");
  }

  if (item.matchRank != null) {
    const rank = ensureChild(visual, "prensa-map-marker-rank", "span");
    rank.textContent = String(item.matchRank);
  } else {
    removeChild(visual, "prensa-map-marker-rank");
  }
}

export function createClusterMarkerElement(count: number): HTMLDivElement {
  const root = document.createElement("div");
  root.className = MARKER_ANCHOR_CLASS;
  applyClusterMarkerCount(root, count);
  root.setAttribute("role", "button");
  root.tabIndex = 0;
  root.setAttribute("aria-label", `Cluster of ${count} jobs`);
  return root;
}

export function applyClusterMarkerCount(el: HTMLElement, count: number): void {
  el.classList.add(MARKER_ANCHOR_CLASS);
  const visual = ensureChild(el, CLUSTER_VISUAL_CLASS);
  visual.className = CLUSTER_VISUAL_CLASS;
  visual.dataset.testid = "map-cluster";
  visual.textContent = String(count);
  el.setAttribute("aria-label", `Cluster of ${count} jobs`);
}

export function markerPopupHtml(item: MapMarkerModel): string {
  return `<div class="prensa-map-pop-card">
<p class="pop-title">${escapeHtml(item.label)}</p>
<p class="pop-line">${escapeHtml(item.consultantName)}</p>
<p class="pop-muted">${escapeHtml(item.title ?? "Job")}</p>
</div>`;
}

export function bindActivate(el: HTMLElement, activate: () => void): void {
  el.addEventListener("click", (event) => {
    event.stopPropagation();
    activate();
  });
  el.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    activate();
  });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ensureChild(parent: HTMLElement, className: string, tag = "div"): HTMLElement {
  const existing = parent.querySelector(`:scope > .${className}`);
  if (existing instanceof HTMLElement) return existing;
  const child = document.createElement(tag);
  child.className = className;
  parent.append(child);
  return child;
}

function removeChild(parent: HTMLElement, className: string): void {
  parent.querySelector(`:scope > .${className}`)?.remove();
}
