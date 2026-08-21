import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Player Analysis",
  description: "Individual player video analysis",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Player Analysis" },
  icons: { icon: "/app-icon.svg", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#061111" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppShell>{children}</AppShell></body></html>;
}
