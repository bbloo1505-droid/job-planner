import { cn } from "@/lib/utils";

/** The stacked chevron mark from the Prensa logo. */
export function PrensaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("size-6", className)}
      aria-hidden="true"
      fill="none"
      strokeWidth="13"
      strokeLinecap="butt"
      strokeLinejoin="miter"
    >
      <polyline points="16,42 50,10 84,42" stroke="#35a8e0" />
      <polyline points="16,67 50,35 84,67" stroke="#7ac143" />
      <polyline points="16,92 50,60 84,92" stroke="#f7941e" />
    </svg>
  );
}
