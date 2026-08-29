import { ShieldAlert } from "lucide-react";

export function PrototypeBanner() {
  return (
    <div className="border-prensa-orange/40 bg-prensa-orange/10 flex h-8 shrink-0 items-center justify-center gap-2 border-b text-[#8a4f06]">
      <ShieldAlert className="text-prensa-orange size-3.5" />
      <p className="text-[10.5px] font-semibold tracking-[0.11em] uppercase">
        Prototype — synthetic data only — not connected to Prensa systems
      </p>
    </div>
  );
}
