"use client";

import { useRef, useState } from "react";
import {
  AddressSearchError,
  searchAddressFromBrowser,
  type AddressSearchStatus,
} from "@/lib/geocoding/client";
import { GEOCODING_OSM_NOTICE } from "@/lib/geocoding/provider";
import type { GeocodingResult } from "@/lib/types";

export function AddressSearchField({
  query,
  onQueryChange,
  onPick,
  onNotFound,
  inputAriaLabel,
  placeholder = "18 Railway Pde, Darra QLD 4076",
  findLabel = "Find address",
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onPick: (result: GeocodingResult) => void;
  onNotFound?: () => void;
  inputAriaLabel: string;
  placeholder?: string;
  findLabel?: string;
}) {
  const [status, setStatus] = useState<AddressSearchStatus>("idle");
  const [candidates, setCandidates] = useState<GeocodingResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const searching = status === "waiting" || status === "finding";

  async function findAddress() {
    const trimmed = query.trim();
    if (!trimmed || pendingRef.current) return;
    pendingRef.current = true;
    setError(null);
    setStatus("waiting");
    const finding = window.setTimeout(() => {
      if (pendingRef.current) setStatus("finding");
    }, 350);
    try {
      const { results, cached } = await searchAddressFromBrowser(trimmed);
      window.clearTimeout(finding);
      if (cached && results.length > 0) {
        setCandidates(results);
        setStatus("found");
        return;
      }
      if (results.length === 0) {
        onNotFound?.();
        setCandidates([]);
        setStatus("not_found");
        return;
      }
      setCandidates(results);
      setStatus("found");
    } catch (cause) {
      window.clearTimeout(finding);
      setCandidates([]);
      if (cause instanceof AddressSearchError && cause.code === "timeout") {
        setStatus("timeout");
        setError("Address search timed out. Try again.");
        return;
      }
      setStatus("error");
      setError("Address service unavailable. Try again shortly.");
    } finally {
      pendingRef.current = false;
    }
  }

  return (
    <div className="space-y-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void findAddress();
        }}
        className="flex flex-wrap items-center gap-1.5"
      >
        <input
          value={query}
          placeholder={placeholder}
          aria-label={inputAriaLabel}
          onKeyDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            setCandidates([]);
            setStatus("idle");
            setError(null);
            onQueryChange(event.target.value);
          }}
          className="h-8 min-w-[220px] flex-1 rounded-md border border-hairline bg-white px-2 text-[13px] text-slate-700 outline-none hover:border-slate-300 focus:border-brand focus:text-slate-900 focus:ring-3 focus:ring-brand/15"
        />
        <button
          type="submit"
          disabled={!query.trim() || searching}
          className="h-8 shrink-0 rounded-md border border-hairline bg-white px-2 text-[12px] font-medium text-slate-700 hover:border-brand hover:text-brand disabled:opacity-50"
        >
          {findLabel}
        </button>
      </form>

      {status === "waiting" ? (
        <p className="text-[11.5px] text-slate-500">Waiting to search…</p>
      ) : null}
      {status === "finding" ? (
        <p className="text-[11.5px] text-slate-500">Finding address…</p>
      ) : null}
      {status === "found" && candidates.length === 0 ? (
        <p className="text-[11.5px] text-prensa-green-ink">Address found</p>
      ) : null}
      {status === "not_found" ? (
        <p className="text-[11.5px] text-amber-700">
          Address not found. Edit and retry, keep it unresolved, or remove it.
        </p>
      ) : null}
      {error ? <p className="text-[11.5px] text-amber-700">{error}</p> : null}

      {candidates.length > 0 ? (
        <ul className="divide-y divide-hairline rounded-md border border-hairline">
          {candidates.map((result) => (
            <li
              key={result.id}
              className="flex items-start justify-between gap-2 px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-slate-800">
                  {result.displayAddress}
                </p>
                <p className="text-[11px] text-slate-400">
                  {[result.suburb, result.state, result.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onPick(result);
                  setCandidates([]);
                  setStatus("found");
                }}
                className="shrink-0 rounded-md border border-brand/30 bg-brand/[0.06] px-2 py-1 text-[11px] font-medium text-brand-strong hover:bg-brand/10"
              >
                Use this address
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {candidates.length > 0 ? (
        <p className="text-[10.5px] text-slate-400">{GEOCODING_OSM_NOTICE}</p>
      ) : null}
    </div>
  );
}
