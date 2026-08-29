"use client";

import { useState } from "react";
import {
  ACCESS_BUFFER_PRESETS,
  isAccessBufferPreset,
} from "@/lib/routing/access-buffer";
import { useDayRouteStore } from "@/lib/store/day-route-store";
import { cn } from "@/lib/utils";

export function DayTimingSettings({ compact = false }: { compact?: boolean }) {
  const travelBufferMinutes = useDayRouteStore(
    (state) => state.plan.settings.travelBufferMinutes
  );
  const roundToMinutes = useDayRouteStore(
    (state) => state.plan.settings.roundToMinutes
  );
  const updateSettings = useDayRouteStore((state) => state.updateSettings);
  const [customOpen, setCustomOpen] = useState(
    () => !isAccessBufferPreset(travelBufferMinutes)
  );
  const [draft, setDraft] = useState<string | null>(null);
  const customMode = customOpen || !isAccessBufferPreset(travelBufferMinutes);

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        compact
          ? "sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-6"
          : "sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-8"
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <p className="field-label">Parking / access buffer</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {ACCESS_BUFFER_PRESETS.map((minutes) => {
            const selected = !customMode && travelBufferMinutes === minutes;
            return (
              <button
                key={minutes}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setCustomOpen(false);
                  setDraft(null);
                  updateSettings({ travelBufferMinutes: minutes });
                }}
                className={segmentClass(selected)}
              >
                {minutes} min
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={customMode}
            onClick={() => setCustomOpen(true)}
            className={segmentClass(customMode)}
          >
            Custom
          </button>
          {customMode ? (
            <label className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={120}
                step={1}
                className="field-input h-8 w-[4.5rem] px-2 text-[13px]"
                aria-label="Custom parking / access buffer in minutes"
                value={draft ?? String(travelBufferMinutes)}
                onChange={(event) => {
                  const raw = event.target.value;
                  setDraft(raw);
                  if (raw.trim() === "") return;
                  const parsed = Number(raw);
                  if (Number.isFinite(parsed)) {
                    updateSettings({ travelBufferMinutes: parsed });
                  }
                }}
                onBlur={() => setDraft(null)}
              />
              <span className="text-[12px] text-slate-500">min</span>
            </label>
          ) : null}
        </div>
        <p className="max-w-[28rem] text-[11px] leading-relaxed text-slate-400">
          Added between properties to allow for parking, access and minor delays.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="field-label">Booking interval</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {([15, 30] as const).map((interval) => {
            const selected = roundToMinutes === interval;
            return (
              <button
                key={interval}
                type="button"
                aria-pressed={selected}
                onClick={() => updateSettings({ roundToMinutes: interval })}
                className={segmentClass(selected)}
              >
                {interval} min
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function segmentClass(selected: boolean): string {
  return cn(
    "h-8 rounded-lg px-2.5 text-[12px] font-medium transition-colors",
    selected
      ? "bg-navy text-white"
      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
  );
}
