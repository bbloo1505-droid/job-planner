"use client";

import { Suspense, useCallback } from "react";
import { PlanDayForm } from "@/components/day-route/PlanDayForm";
import { OptimisedWorkspace } from "@/components/day-route/OptimisedWorkspace";
import { ScenarioLoader } from "@/components/day-route/ScenarioLoader";
import { AppShell } from "@/components/layout/AppShell";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDayRouteStore } from "@/lib/store/day-route-store";

export function DayRouteApp() {
  const hasOptimised = useDayRouteStore((state) => state.hasOptimised);
  const selectJob = useDayRouteStore((state) => state.selectJob);
  const onEscape = useCallback(() => selectJob(null), [selectJob]);
  useKeyboardShortcuts(onEscape);

  return (
    <AppShell>
      <Suspense fallback={null}>
        <ScenarioLoader />
      </Suspense>
      {hasOptimised ? <OptimisedWorkspace /> : <PlanDayForm />}
    </AppShell>
  );
}
