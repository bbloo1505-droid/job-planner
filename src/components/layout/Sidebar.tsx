"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, LayoutGrid, Map } from "lucide-react";
import { PrensaMark } from "@/components/brand/PrensaMark";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Day Route Planner", icon: CalendarClock, match: (path: string) => path === "/" },
  { href: "/team", label: "Team Planner", icon: LayoutGrid, match: (path: string) => path === "/team" },
  {
    href: "/team/map",
    label: "Planner Map",
    icon: Map,
    match: (path: string) => path === "/team/map" || path.startsWith("/team/map/"),
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[228px] shrink-0 flex-col bg-navy text-white">
      <div className="flex h-[60px] items-center gap-2.5 border-b border-navy-line px-5">
        <PrensaMark className="size-[22px]" />
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-tight">
            prensa
          </span>
          <span className="block text-[9.5px] tracking-[0.12em] text-white/45 uppercase">
            Field Allocation
          </span>
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3">
        {LINKS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              data-nav={item.href}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-xl px-3 text-[13px] transition-colors",
                active
                  ? "bg-brand font-medium text-white"
                  : "text-white/65 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="size-[17px] shrink-0" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-navy-line px-5 py-3.5">
        <p className="text-[11px] leading-4 text-white/35">Local prototype</p>
      </div>
    </aside>
  );
}
