import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#1a2744",
};

export const metadata: Metadata = {
  title: "Field Allocation Planner — Prototype",
  description:
    "Stage 1 synthetic-data prototype of the Prensa Field Allocation Day Route Planner. Not connected to company systems.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full light`}>
      <body className={`${inter.className} min-h-full bg-[#f3f5f8] text-slate-900 antialiased`}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
