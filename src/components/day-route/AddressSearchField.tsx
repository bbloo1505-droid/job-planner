"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  AddressSearchError,
  searchAddressFromBrowser,
  type AddressSearchStatus,
} from "@/lib/geocoding/client";
import { GEOCODING_OSM_NOTICE } from "@/lib/geocoding/provider";
import {
  ADDRESS_SUGGEST_DEBOUNCE_MS,
  addressSuggestQuery,
} from "@/lib/geocoding/suggest";
import type { GeocodingResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AddressSearchField({
  query,
  onQueryChange,
  onPick,
  onNotFound,
  inputAriaLabel,
  placeholder = "12 Example St, Indooroopilly QLD",
  findLabel = "Find address",
  showFindButton = false,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onPick: (result: GeocodingResult) => void;
  onNotFound?: () => void;
  inputAriaLabel: string;
  placeholder?: string;
  findLabel?: string;
  showFindButton?: boolean;
}) {
  const listId = useId();
  const [status, setStatus] = useState<AddressSearchStatus>("idle");
  const [candidates, setCandidates] = useState<GeocodingResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const pendingRef = useRef(false);

  const searching = status === "waiting" || status === "finding";
  const suggestQuery = addressSuggestQuery(query);
  const showList = open && (candidates.length > 0 || searching || status === "not_found");

  useEffect(() => {
    if (!suggestQuery) {
      setCandidates([]);
      setStatus("idle");
      setError(null);
      setOpen(false);
      return;
    }

    let cancelled = false;
    setStatus("waiting");
    setError(null);
    setOpen(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        setStatus("finding");
        try {
          const { results } = await searchAddressFromBrowser(suggestQuery);
          if (cancelled) return;
          setCandidates(results);
          setActiveIndex(0);
          setOpen(true);
          setStatus(results.length > 0 ? "found" : "not_found");
        } catch (cause) {
          if (cancelled) return;
          setCandidates([]);
          if (cause instanceof AddressSearchError && cause.code === "timeout") {
            setStatus("timeout");
            setError("Address search timed out. Keep typing or try again.");
            return;
          }
          setStatus("error");
          setError("Address service unavailable. Try again shortly.");
        }
      })();
    }, ADDRESS_SUGGEST_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [suggestQuery]);

  async function findAddress() {
    const trimmed = query.trim();
    if (!trimmed || pendingRef.current) return;
    pendingRef.current = true;
    setError(null);
    setOpen(true);
    setStatus("waiting");
    const finding = window.setTimeout(() => {
      if (pendingRef.current) setStatus("finding");
    }, 350);
    try {
      const { results } = await searchAddressFromBrowser(trimmed);
      window.clearTimeout(finding);
      setCandidates(results);
      setActiveIndex(0);
      if (results.length === 0) {
        onNotFound?.();
        setStatus("not_found");
        return;
      }
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

  function pick(result: GeocodingResult) {
    onPick(result);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    event.stopPropagation();
    if (!showList) {
      if (event.key === "Enter" && showFindButton) {
        event.preventDefault();
        void findAddress();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        candidates.length === 0 ? 0 : (index + 1) % candidates.length
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        candidates.length === 0
          ? 0
          : (index - 1 + candidates.length) % candidates.length
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = candidates[activeIndex] ?? candidates[0];
      if (selected) pick(selected);
      else if (showFindButton) void findAddress();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const selected = candidates[activeIndex] ?? candidates[0];
          if (selected) {
            pick(selected);
            return;
          }
          if (showFindButton) void findAddress();
        }}
        className="flex flex-wrap items-center gap-1.5"
      >
        <div className="min-w-0 flex-1">
          <input
            value={query}
            placeholder={placeholder}
            aria-label={inputAriaLabel}
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={listId}
            aria-activedescendant={
              showList && candidates[activeIndex]
                ? `${listId}-${candidates[activeIndex].id}`
                : undefined
            }
            role="combobox"
            onKeyDown={onKeyDown}
            onFocus={() => {
              if (candidates.length > 0 || searching) setOpen(true);
            }}
            onChange={(event) => {
              setError(null);
              onQueryChange(event.target.value);
            }}
            className="h-8 w-full min-w-0 rounded-md border border-hairline bg-white px-2 text-[13px] text-slate-700 outline-none hover:border-slate-300 focus:border-brand focus:text-slate-900 focus:ring-3 focus:ring-brand/15"
          />
          {showList ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Address suggestions"
              data-testid="address-suggestions"
              className="mt-1 max-h-56 overflow-auto rounded-xl border border-hairline bg-white py-1 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.22)]"
            >
              {searching && candidates.length === 0 ? (
                <li className="px-3 py-2 text-[12.5px] text-slate-500">
                  {status === "waiting" ? "Searching…" : "Finding address…"}
                </li>
              ) : null}
              {status === "not_found" && candidates.length === 0 && !searching ? (
                <li className="px-3 py-2 text-[12.5px] text-slate-500">
                  No matching addresses. Keep typing or plan the day to resolve it.
                </li>
              ) : null}
              {candidates.map((result, index) => (
                <li key={result.id} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-${result.id}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => pick(result)}
                    className={cn(
                      "flex w-full flex-col px-3 py-2 text-left",
                      index === activeIndex ? "bg-brand/[0.08]" : "hover:bg-slate-50"
                    )}
                  >
                    <span className="text-[12.5px] font-medium text-slate-800">
                      {result.displayAddress}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {[result.suburb, result.state, result.country]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {showFindButton ? (
          <button
            type="submit"
            disabled={!query.trim() || searching}
            className="h-8 shrink-0 rounded-md border border-hairline bg-white px-2 text-[12px] font-medium text-slate-700 hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {findLabel}
          </button>
        ) : null}
      </form>

      {error ? <p className="text-[11.5px] text-amber-700">{error}</p> : null}
      {candidates.length > 0 ? (
        <p className="text-[10.5px] text-slate-400">{GEOCODING_OSM_NOTICE}</p>
      ) : null}
    </div>
  );
}
