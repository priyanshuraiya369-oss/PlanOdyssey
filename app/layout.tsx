import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "PlanOdyssey | Event command center",
  description: "A calm, intelligent command center for weddings, birthdays and every celebration worth planning well.",
  openGraph: {
    title: "PlanOdyssey",
    description: "Budget, guests, vendors and timeline for your celebration, orchestrated in one place.",
    type: "website"
  }
};

export const viewport: Viewport = {
  themeColor: "#1b1630",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
