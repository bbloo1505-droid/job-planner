import { Sidebar } from "@/components/layout/Sidebar";
import { PrototypeBanner } from "@/components/layout/PrototypeBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <PrototypeBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
