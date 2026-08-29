"use client";

import { useDayRouteStore } from "@/lib/store/day-route-store";

export function UnlocatedProperties() {
  const unlocatedJobIds = useDayRouteStore((state) => state.unlocatedJobIds);
  const jobs = useDayRouteStore((state) => state.jobs);
  const retryUnlocatedJob = useDayRouteStore((state) => state.retryUnlocatedJob);
  const changeJobAddress = useDayRouteStore((state) => state.changeJobAddress);
  const confirmGeocodedAddress = useDayRouteStore(
    (state) => state.confirmGeocodedAddress
  );
  const updatePendingJob = useDayRouteStore((state) => state.updatePendingJob);
  const backToPlanning = useDayRouteStore((state) => state.backToPlanning);
  const isPlanning = useDayRouteStore((state) => state.isPlanning);

  const items = unlocatedJobIds
    .map((id) => jobs[id])
    .filter((job) => Boolean(job?.address.trim()));

  if (items.length === 0) return null;

  return (
    <section className="panel" data-testid="unlocated-properties">
      <div className="border-b border-amber-100 bg-amber-50/80 px-5 py-3.5">
        <h2 className="text-[12px] font-semibold tracking-wide text-amber-900 uppercase">
          Could not locate
        </h2>
        <p className="mt-0.5 text-[12px] text-amber-800">
          These properties were left off the route. The planned stops are still
          ready to book.
        </p>
      </div>
      <ul className="space-y-2 p-3">
        {items.map((job) => (
          <li key={job.id} className="soft-card space-y-2 px-3.5 py-3">
            <p className="text-[13px] font-medium text-slate-800">{job.address}</p>
            {job.geocodingStatus === "needs_confirmation" ? (
              <p className="text-[11.5px] text-amber-800">Needs confirmation</p>
            ) : null}
            {job.geocodeCandidates && job.geocodeCandidates.length > 0 ? (
              <ul className="space-y-1">
                {job.geocodeCandidates.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => confirmGeocodedAddress(job.id, result)}
                      className="w-full rounded-xl border border-hairline px-2.5 py-2 text-left text-[12px] text-slate-700 hover:border-brand hover:text-brand"
                    >
                      {result.displayAddress}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPlanning}
                onClick={() => void retryUnlocatedJob(job.id)}
                className="h-8 rounded-lg border border-hairline bg-white px-2.5 text-[12px] font-medium text-slate-700 hover:border-brand hover:text-brand disabled:opacity-50"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => {
                  changeJobAddress(job.id);
                  updatePendingJob(job.id, job.enteredAddress ?? job.address);
                  backToPlanning();
                }}
                className="h-8 rounded-lg border border-hairline bg-white px-2.5 text-[12px] font-medium text-slate-700 hover:border-brand hover:text-brand"
              >
                Edit address
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
