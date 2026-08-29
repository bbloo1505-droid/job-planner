"use client";

export function MapViewportControls({
  onZoomIn,
  onZoomOut,
  onFitJobs,
  fitLabel = "Fit jobs",
  fitTestId = "fit-jobs",
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitJobs: () => void;
  fitLabel?: string;
  fitTestId?: string;
}) {
  return (
    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
      <button
        type="button"
        data-testid="map-zoom-in"
        aria-label="Zoom in"
        onClick={onZoomIn}
        className="flex size-7 items-center justify-center rounded border border-hairline bg-white text-[15px] font-semibold text-slate-700 hover:bg-slate-50"
      >
        +
      </button>
      <button
        type="button"
        data-testid="map-zoom-out"
        aria-label="Zoom out"
        onClick={onZoomOut}
        className="flex size-7 items-center justify-center rounded border border-hairline bg-white text-[15px] font-semibold text-slate-700 hover:bg-slate-50"
      >
        −
      </button>
      <button
        type="button"
        data-testid={fitTestId}
        onClick={onFitJobs}
        className="h-7 rounded border border-hairline bg-white px-2 text-[10.5px] font-semibold tracking-wide text-slate-700 hover:bg-slate-50"
      >
        {fitLabel}
      </button>
    </div>
  );
}
