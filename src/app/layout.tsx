import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = { title: "Player Analysis", description: "Análise individual de jogadores em vídeo" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt"><body><AppShell>{children}</AppShell></body></html>; }
