import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlanOdyssey | Event command center",
  description: "A calm, intelligent command center for complex celebrations."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
