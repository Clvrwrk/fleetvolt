import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { NavHeader } from "@/components/design/nav-header";

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
          <NavHeader />
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
