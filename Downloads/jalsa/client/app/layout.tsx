import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JALSA — Crowd Intelligence",
  description: "Crowd-intensity forecasts for urban places.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
