"use client";

import { useEffect } from "react";
import { useDayRouteStore } from "@/lib/store/day-route-store";

export function useKeyboardShortcuts(onEscape: () => void) {
  const undo = useDayRouteStore((state) => state.undo);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        onEscape();
        return;
      }

      const undoPressed =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey;
      if (undoPressed && !isEditing) {
        event.preventDefault();
        undo();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onEscape, undo]);
}
