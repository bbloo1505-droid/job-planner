"use client";

import { useState } from "react";
import {
  DEFAULT_SAMPLING_MINUTES,
  MAX_SAMPLING_MINUTES,
  MIN_SAMPLING_MINUTES,
  SAMPLING_PRESETS,
  clampSamplingMinutes,
} from "@/lib/routing/sampling";
import { cn } from "@/lib/utils";

export function SamplingDurationField({
  minutes,
  onChange,
  compact = false,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
  compact?: boolean;
}) {
  const preset = SAMPLING_PRESETS.includes(
    minutes as (typeof SAMPLING_PRESETS)[number]
  );
  const [customOpen, setCustomOpen] = useState(!preset);
  const [customValue, setCustomValue] = useState(String(minutes));

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <span className="field-label">Sampling duration</span>
      <div className="flex flex-wrap items-center gap-1">
        {SAMPLING_PRESETS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setCustomOpen(false);
              onChange(value);
            }}
            className={cn(
              "h-6 rounded-md border px-1.5 text-[11px] font-medium tabular-nums transition-colors",
              minutes === value && !customOpen
                ? "border-brand bg-brand/[0.08] text-brand-strong"
                : "border-hairline bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
            )}
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setCustomOpen(true);
            setCustomValue(String(minutes));
          }}
          className={cn(
            "h-6 rounded-md border px-1.5 text-[11px] font-medium transition-colors",
            customOpen
              ? "border-brand bg-brand/[0.08] text-brand-strong"
              : "border-hairline bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
          )}
        >
          Custom
        </button>
        {customOpen ? (
          <label className="flex items-center gap-1 text-[11px] text-slate-500">
            <input
              type="number"
              min={MIN_SAMPLING_MINUTES}
              max={MAX_SAMPLING_MINUTES}
              step={1}
              value={customValue}
              aria-label="Custom sampling duration"
              onChange={(event) => setCustomValue(event.target.value)}
              onBlur={() => {
                const next = clampSamplingMinutes(
                  Number(customValue) || DEFAULT_SAMPLING_MINUTES
                );
                setCustomValue(String(next));
                onChange(next);
              }}
              className="h-6 w-14 rounded-md border border-hairline px-1.5 text-[11px] text-slate-800 tabular-nums outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
            />
            min
          </label>
        ) : null}
      </div>
    </div>
  );
}
