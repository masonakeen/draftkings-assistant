import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DK Best Ball Portfolio Analyzer",
  description: "Local analytics for DraftKings best ball drafts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
