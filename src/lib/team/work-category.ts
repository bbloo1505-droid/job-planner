import type { WorkCategory } from "@/lib/types";

export const WORK_CATEGORIES: WorkCategory[] = [
  "confirmed_work",
  "proposed_work",
  "reporting",
  "not_available",
  "management_locked",
  "secondary_consultant",
  "meeting",
  "laboratory",
];

export const DEFAULT_WORK_CATEGORY: WorkCategory = "proposed_work";

export interface WorkCategoryMeta {
  id: WorkCategory;
  /** Short label used in menus and cards. */
  label: string;
  /** Exact QLD Planning Board Key wording. */
  keyLabel: string;
  fill: string;
  text: string;
  muted: string;
  onDark: boolean;
}

/**
 * Colours sampled from the live QLD Planning Board Key sheet.
 * Cards use the full cell fill, the same way the spreadsheet does.
 */
export const WORK_CATEGORY_META: Record<WorkCategory, WorkCategoryMeta> = {
  confirmed_work: {
    id: "confirmed_work",
    label: "Confirmed work",
    keyLabel: "Confirmed Work",
    fill: "#7FF25C",
    text: "#111111",
    muted: "#1c3d14",
    onDark: false,
  },
  proposed_work: {
    id: "proposed_work",
    label: "Proposed work",
    keyLabel: "Proposed Work",
    fill: "#FCFE53",
    text: "#111111",
    muted: "#3d3d10",
    onDark: false,
  },
  reporting: {
    id: "reporting",
    label: "Reporting",
    keyLabel: "Reporting",
    fill: "#75FBFE",
    text: "#111111",
    muted: "#0f3d40",
    onDark: false,
  },
  not_available: {
    id: "not_available",
    label: "Not available",
    keyLabel: "Not available for work",
    fill: "#959999",
    text: "#111111",
    muted: "#222222",
    onDark: false,
  },
  management_locked: {
    id: "management_locked",
    label: "Management locked",
    keyLabel: "Do not move without Management Approval",
    fill: "#E23F34",
    text: "#ffffff",
    muted: "#ffe4e0",
    onDark: true,
  },
  secondary_consultant: {
    id: "secondary_consultant",
    label: "Secondary consultant",
    keyLabel: "Secondary consultant on site",
    fill: "#E69736",
    text: "#111111",
    muted: "#3d2508",
    onDark: false,
  },
  meeting: {
    id: "meeting",
    label: "Meetings",
    keyLabel: "Meetings",
    fill: "#E934F6",
    text: "#111111",
    muted: "#3d0a42",
    onDark: false,
  },
  laboratory: {
    id: "laboratory",
    label: "Laboratory",
    keyLabel: "Laboratory work/analysis",
    fill: "#8D1FF0",
    text: "#ffffff",
    muted: "#f0e4ff",
    onDark: true,
  },
};

export function resolveWorkCategory(value?: WorkCategory): WorkCategory {
  return value && value in WORK_CATEGORY_META ? value : DEFAULT_WORK_CATEGORY;
}

export function workCategoryMeta(value?: WorkCategory): WorkCategoryMeta {
  return WORK_CATEGORY_META[resolveWorkCategory(value)];
}
