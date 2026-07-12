import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { AppShell } from "@/components/nav/app-shell";

// Phase 16 / Wave 1: NavHeader is deprecated — replaced by AppShell.
// The old nav-header.tsx file is kept but no longer imported.

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const arcline = localFont({
  src: [
    { path: "./fonts/Arcline-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/Arcline-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Arcline-Bold.ttf", weight: "700 900", style: "normal" },
  ],
  variable: "--font-arcline",
  display: "swap",
  fallback: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
});

const brokline = localFont({
  src: "./fonts/Brokline-Regular.otf",
  weight: "400",
  style: "normal",
  variable: "--font-brokline",
  display: "swap",
  fallback: ["Arcline", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "FleetVolt Route — EV Freight Modeler",
  description:
    "Physics-based EV drayage route planning, charging simulation, and fleet electrification for Class 8 trucks operating out of California ports.",
  icons: {
    icon: "/fleetvolt-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${arcline.variable} ${brokline.variable}`}
      suppressHydrationWarning
    >
      {/* Extensions (Grammarly, Dashlane, etc.) inject attrs on body before hydrate. */}
      <body
        className="min-w-0 antialiased"
        suppressHydrationWarning
      >
        <ConvexClientProvider>
          <AppShell>{children}</AppShell>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
