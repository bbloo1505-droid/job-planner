"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, LayoutGrid } from "lucide-react";
import { PrensaMark } from "@/components/brand/PrensaMark";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const plannerActive = pathname === "/";
  const teamActive = pathname.startsWith("/team");

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
        <Link
          href="/"
          aria-current={plannerActive ? "page" : undefined}
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
            plannerActive
              ? "bg-brand font-medium text-white"
              : "text-white/65 hover:bg-white/5 hover:text-white"
          )}
        >
          <CalendarClock className="size-[17px] shrink-0" strokeWidth={1.75} />
          Day Route Planner
        </Link>

        <Link
          href="/team"
          aria-current={teamActive ? "page" : undefined}
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
            teamActive
              ? "bg-brand font-medium text-white"
              : "text-white/65 hover:bg-white/5 hover:text-white"
          )}
        >
          <LayoutGrid className="size-[17px] shrink-0" strokeWidth={1.75} />
          Team Planner
        </Link>
      </nav>

      <div className="shrink-0 border-t border-navy-line px-5 py-3.5">
        <p className="text-[11px] leading-4 text-white/35">Local prototype</p>
      </div>
    </aside>
  );
}
