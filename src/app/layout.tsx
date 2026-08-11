import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./elite.css";

export const metadata: Metadata = {
  title: "TRI6 Elite Scanner",
  description: "Professional six-pattern geometric compression scanner with robust structural validation.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#070b14" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
