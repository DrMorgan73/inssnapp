import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INSSNAPP — Resident-Powered Leasing Infrastructure",
  description: "The Missing Tile in real-time occupied-unit showing coordination.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
