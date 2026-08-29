"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, ChartColumn, FlaskConical, LayoutGrid, Map } from "lucide-react";
import { PrensaMark } from "@/components/brand/PrensaMark";
import { GEOCODING_PRIVACY_NOTICE } from "@/lib/geocoding/provider";
import { cn } from "@/lib/utils";

const LINKS = [
  {
    href: "/",
    label: "Day Route Planner",
    icon: CalendarClock,
    match: (path: string) => path === "/",
  },
  {
    href: "/team",
    label: "Team Planner",
    icon: LayoutGrid,
    match: (path: string) => path === "/team",
  },
  {
    href: "/team/map",
    label: "Planner Map",
    icon: Map,
    match: (path: string) => path === "/team/map" || path.startsWith("/team/map/"),
  },
  {
    href: "/reports",
    label: "Reports",
    icon: ChartColumn,
    match: (path: string) => path === "/reports" || path.startsWith("/reports/"),
  },
] as const;

export function Sidebar({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className={cn("flex w-[min(248px,100vw)] shrink-0 flex-col overflow-y-auto bg-navy text-white", className)}>
      <div className="flex items-center gap-3 px-5 pt-7 pb-6">
        <PrensaMark className="size-10" />
        <span className="min-w-0 leading-none">
          <span className="block text-[22px] font-semibold tracking-tight">prensa</span>
          <span className="mt-1.5 block text-[9.5px] font-medium tracking-[0.16em] text-white/45 uppercase">
            Field Allocation
          </span>
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {LINKS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              data-nav={item.href}
              onClick={onNavigate}
              className={cn(
                "relative flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[13.5px] transition-colors",
                active
                  ? "bg-brand font-medium text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full bg-[#7ec8ea]"
                />
              ) : null}
              <Icon className="size-[18px] shrink-0" strokeWidth={1.7} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        className="px-4 pt-2 pb-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-medium text-white/70">
          <FlaskConical className="size-3.5" strokeWidth={1.75} />
          Prototype
        </span>
        <p className="mt-2.5 text-[10.5px] leading-4 text-white/40">
          {GEOCODING_PRIVACY_NOTICE}
        </p>
      </div>
    </aside>
  );
}
