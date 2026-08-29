"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { PrensaMark } from "@/components/brand/PrensaMark";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <header
        className="relative z-[60] flex shrink-0 items-center gap-2.5 bg-navy px-3 text-white md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-12 items-center gap-2.5">
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            data-testid="open-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex size-11 items-center justify-center rounded-xl text-white hover:bg-white/10"
          >
            <Menu className="size-5" strokeWidth={1.75} />
          </button>
          <PrensaMark className="size-7" />
          <span className="text-[17px] font-semibold tracking-tight">prensa</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar className="hidden md:flex" />

        <div
          className={cn(
            "fixed inset-0 z-50 md:hidden",
            menuOpen ? "pointer-events-auto" : "pointer-events-none"
          )}
          aria-hidden={!menuOpen}
          {...(menuOpen ? {} : { inert: true })}
          data-testid="mobile-drawer"
        >
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={menuOpen ? 0 : -1}
            onClick={() => setMenuOpen(false)}
            className={cn(
              "absolute inset-0 bg-navy/45 transition-opacity",
              menuOpen ? "opacity-100" : "opacity-0"
            )}
          />
          <div
            className={cn(
              "absolute inset-y-0 left-0 flex items-stretch transition-transform duration-200 ease-out",
              menuOpen ? "translate-x-0" : "-translate-x-full"
            )}
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <Sidebar
              className="h-full shadow-[8px_0_32px_-12px_rgb(0_0_0_/_0.45)]"
              onNavigate={() => setMenuOpen(false)}
            />
            <button
              type="button"
              aria-label="Close menu"
              data-testid="close-menu"
              onClick={() => setMenuOpen(false)}
              className="mt-3 ml-2 inline-flex size-10 shrink-0 self-start items-center justify-center rounded-full bg-navy/80 text-white shadow-md hover:bg-navy"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
