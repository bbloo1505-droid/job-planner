import type { BookingStatus } from "@/lib/types";
import {
  MARKER_ANCHOR_CLASS,
  bindActivate,
  escapeHtml,
} from "@/lib/map/marker-element";
import type {
  DayRouteCandidateMarker,
  DayRouteOfficeMarker,
  DayRouteStopMarker,
} from "@/lib/map/day-route-map-model";
import { formatDisplayTime } from "@/lib/routing/round-time";

const BOOKING_LABEL: Record<BookingStatus, string> = {
  uncontacted: "Uncontacted",
  contact_attempted: "Attempted",
  tentatively_booked: "Tentative",
  confirmed: "Confirmed",
  unable_to_contact: "Unavailable",
  complete: "Complete",
};

export function createOfficeMarkerElement(item: DayRouteOfficeMarker): HTMLDivElement {
  const root = document.createElement("div");
  root.className = MARKER_ANCHOR_CLASS;
  applyOfficeMarkerElement(root, item);
  return root;
}

export function applyOfficeMarkerElement(
  el: HTMLElement,
  item: DayRouteOfficeMarker
): void {
  el.classList.add(MARKER_ANCHOR_CLASS);
  el.dataset.markerId = item.id;
  el.dataset.markerKind = "office";
  el.style.zIndex = "14";
  el.setAttribute("aria-label", officeAriaLabel(item));

  const stack = ensureChild(el, "prensa-day-route-office-stack");
  stack.className = "prensa-day-route-office-stack";
  const visual = ensureChild(stack, "prensa-day-route-office");
  visual.className = "prensa-day-route-office";
  visual.textContent = officeGlyph(item.role);
  const caption = ensureChild(stack, "prensa-day-route-office-label");
  caption.className = "prensa-day-route-office-label";
  caption.textContent = officeCaption(item.role);
}

export function createStopMarkerElement(item: DayRouteStopMarker): HTMLDivElement {
  const root = document.createElement("div");
  root.className = MARKER_ANCHOR_CLASS;
  applyStopMarkerElement(root, item);
  return root;
}

export function applyStopMarkerElement(el: HTMLElement, item: DayRouteStopMarker): void {
  el.classList.add(MARKER_ANCHOR_CLASS);
  el.dataset.markerId = item.id;
  el.dataset.markerKind = "stop";
  el.dataset.jobId = item.jobId;
  el.style.zIndex = item.selected ? "26" : "18";
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  el.setAttribute("aria-label", `Stop ${item.order}, ${item.suburb}`);
  el.setAttribute("aria-pressed", item.selected ? "true" : "false");

  const visual = ensureChild(el, "prensa-day-route-stop");
  visual.className = [
    "prensa-day-route-stop",
    item.selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
  visual.textContent = "";
  const pin = ensureChild(visual, "prensa-day-route-stop-pin");
  pin.className = "prensa-day-route-stop-pin";
  const num = ensureChild(visual, "prensa-day-route-stop-num");
  num.className = "prensa-day-route-stop-num";
  num.textContent = String(item.order);
}

export function createCandidateMarkerElement(
  item: DayRouteCandidateMarker
): HTMLDivElement {
  const root = document.createElement("div");
  root.className = MARKER_ANCHOR_CLASS;
  applyCandidateMarkerElement(root, item);
  return root;
}

export function applyCandidateMarkerElement(
  el: HTMLElement,
  item: DayRouteCandidateMarker
): void {
  el.classList.add(MARKER_ANCHOR_CLASS);
  el.dataset.markerId = item.id;
  el.dataset.markerKind = "candidate";
  el.style.zIndex = "20";
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  el.setAttribute("aria-label", `Nearby opportunity, ${item.suburb}`);

  const visual = ensureChild(el, "prensa-day-route-candidate");
  visual.className = "prensa-day-route-candidate";
}

export function stopPopupHtml(item: DayRouteStopMarker): string {
  const time = item.appointmentTime
    ? formatDisplayTime(item.appointmentTime)
    : "";
  return `<div class="prensa-map-pop-card">
<p class="pop-title">${escapeHtml(String(item.order))} · ${escapeHtml(item.suburb)}</p>
<p class="pop-line">${escapeHtml(item.address)}</p>
${time ? `<p class="pop-muted">${escapeHtml(time)}</p>` : ""}
<p class="pop-muted">${escapeHtml(BOOKING_LABEL[item.bookingStatus])}</p>
</div>`;
}

export { bindActivate };

function officeAriaLabel(item: DayRouteOfficeMarker): string {
  if (item.role === "start-finish") return `Start and finish, ${item.label}`;
  if (item.role === "start") return `Start, ${item.label}`;
  return `Finish, ${item.label}`;
}

function officeGlyph(role: DayRouteOfficeMarker["role"]): string {
  if (role === "start-finish") return "S/F";
  if (role === "start") return "S";
  return "F";
}

function officeCaption(role: DayRouteOfficeMarker["role"]): string {
  if (role === "start-finish") return "Start / Finish";
  if (role === "start") return "START";
  return "FINISH";
}

function ensureChild(parent: HTMLElement, className: string): HTMLElement {
  const existing = parent.querySelector(`:scope > .${className}`);
  if (existing instanceof HTMLElement) return existing;
  const child = document.createElement("div");
  child.className = className;
  parent.append(child);
  return child;
}
