import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className={`${inter.className} min-w-[1024px] antialiased`}>
        <ConvexClientProvider>
          <AppShell>{children}</AppShell>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
