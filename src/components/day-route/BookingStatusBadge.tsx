import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/lib/types";

const STATUS_LABEL: Record<BookingStatus, string> = {
  uncontacted: "Uncontacted",
  contact_attempted: "Attempted",
  tentatively_booked: "Tentative",
  confirmed: "Confirmed",
  unable_to_contact: "Unavailable",
  complete: "Complete",
};

const PILL_CLASS: Record<BookingStatus, string> = {
  uncontacted: "border-slate-200 bg-slate-50 text-slate-600",
  contact_attempted: "border-amber-200 bg-amber-50 text-amber-800",
  tentatively_booked: "border-brand/30 bg-brand/[0.07] text-brand-strong",
  confirmed: "border-prensa-green/45 bg-prensa-green/10 text-prensa-green-ink",
  unable_to_contact: "border-rose-200 bg-rose-50 text-rose-700",
  complete: "border-slate-200 bg-slate-100 text-slate-500",
};

const TEXT_CLASS: Record<BookingStatus, string> = {
  uncontacted: "text-slate-400",
  contact_attempted: "text-amber-700",
  tentatively_booked: "text-brand-strong",
  confirmed: "text-prensa-green-ink font-medium",
  unable_to_contact: "text-rose-700",
  complete: "text-slate-400",
};

const DOT_CLASS: Record<BookingStatus, string> = {
  uncontacted: "bg-slate-300",
  contact_attempted: "bg-amber-500",
  tentatively_booked: "bg-brand",
  confirmed: "bg-prensa-green",
  unable_to_contact: "bg-rose-500",
  complete: "bg-slate-400",
};

export function BookingStatusBadge({
  status,
  className,
}: {
  status: BookingStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[19px] items-center gap-1.5 rounded border px-1.5 text-[10.5px] font-medium",
        PILL_CLASS[status],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT_CLASS[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Borderless variant for dense rows where a pill would be too loud. */
export function BookingStatusText({
  status,
  className,
}: {
  status: BookingStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px]",
        TEXT_CLASS[status],
        className
      )}
    >
      {status === "confirmed" ? (
        <Check className="size-3 shrink-0" strokeWidth={2.75} />
      ) : (
        <span className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASS[status])} />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

export { STATUS_LABEL, DOT_CLASS };
