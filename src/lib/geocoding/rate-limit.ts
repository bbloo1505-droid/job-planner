import { normalizeGeocodeQuery } from "@/lib/geocoding/provider";

export const NOMINATIM_MIN_INTERVAL_MS = 1000;
export const NOMINATIM_TIMEOUT_MS = 8000;

export class NominatimTimeoutError extends Error {
  readonly code = "timeout" as const;

  constructor(timeoutMs = NOMINATIM_TIMEOUT_MS) {
    super(`Nominatim timed out after ${timeoutMs}ms`);
    this.name = "NominatimTimeoutError";
  }
}

export type NominatimQueueOptions = {
  minIntervalMs?: number;
  timeoutMs?: number;
  now?: () => number;
  delay?: (ms: number) => Promise<void>;
};

type QueueState = {
  chain: Promise<void>;
  lastStartedAt: number;
  inflight: Map<string, Promise<unknown>>;
  minIntervalMs: number;
  timeoutMs: number;
  now: () => number;
  delay: (ms: number) => Promise<void>;
};

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createState(options: NominatimQueueOptions = {}): QueueState {
  return {
    chain: Promise.resolve(),
    lastStartedAt: Number.NEGATIVE_INFINITY,
    inflight: new Map(),
    minIntervalMs: options.minIntervalMs ?? NOMINATIM_MIN_INTERVAL_MS,
    timeoutMs: options.timeoutMs ?? NOMINATIM_TIMEOUT_MS,
    now: options.now ?? (() => Date.now()),
    delay: options.delay ?? defaultDelay,
  };
}

let state = createState();

export function nominatimMinIntervalMs(): number {
  return state.minIntervalMs;
}

export function nominatimTimeoutMs(): number {
  return state.timeoutMs;
}

export function resetNominatimQueue(options: NominatimQueueOptions = {}): void {
  state = createState(options);
}

/**
 * Serialize Nominatim work at 1 request/second.
 * Each slot has a hard timeout. Rejected/aborted/timed-out tasks still release the chain.
 */
export function enqueueNominatim<T>(
  task: (signal: AbortSignal) => Promise<T>,
  key?: string
): Promise<T> {
  const lookup = key ? normalizeGeocodeQuery(key) : "";
  if (lookup) {
    const existing = state.inflight.get(lookup);
    if (existing) return existing as Promise<T>;
  }

  const run = runQueued(task);

  if (lookup) {
    state.inflight.set(lookup, run);
    // `.finally()` re-rejects; swallow so a handled failure is not also unhandled.
    run
      .finally(() => {
        if (state.inflight.get(lookup) === run) state.inflight.delete(lookup);
      })
      .catch(() => undefined);
  }

  return run;
}

async function runQueued<T>(
  task: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  let release: () => void = () => {};
  const previous = state.chain;
  state.chain = new Promise<void>((resolve) => {
    release = resolve;
  });

  const queuedAt = state.now();
  try {
    await previous;
    const wait = Math.max(
      0,
      state.minIntervalMs - (state.now() - state.lastStartedAt)
    );
    if (wait > 0) await state.delay(wait);
    logDev(`queued ${Math.round(state.now() - queuedAt)}ms`);
    state.lastStartedAt = state.now();
    return await runWithTimeout(task);
  } finally {
    release();
  }
}

function runWithTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const timeoutMs = state.timeoutMs;
  const controller = new AbortController();
  const started = state.now();

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      settle(() => {
        controller.abort();
        logDev(`provider timeout after ${timeoutMs}ms`);
        reject(new NominatimTimeoutError(timeoutMs));
      });
    }, timeoutMs);

    Promise.resolve()
      .then(() => task(controller.signal))
      .then((value) => {
        settle(() => {
          logDev(`provider ${Math.round(state.now() - started)}ms`);
          resolve(value);
        });
      }, (error: unknown) => {
        settle(() => {
          if (
            controller.signal.aborted ||
            error instanceof NominatimTimeoutError ||
            isAbortError(error)
          ) {
            reject(
              error instanceof NominatimTimeoutError
                ? error
                : new NominatimTimeoutError(timeoutMs)
            );
            return;
          }
          reject(error);
        });
      });
  });
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "AbortError"
  );
}

function logDev(message: string): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[geocode] ${message}`);
}
