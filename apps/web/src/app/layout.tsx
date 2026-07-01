import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FleetVolt Route — Stack Status",
  description: "Local development stack health for FleetVolt Route",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
