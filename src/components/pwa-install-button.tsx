"use client";

import { useEffect, useState } from "react";
import { Download, MonitorDown, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaInstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const finish = () => { setInstalled(true); setPrompt(null); setShowHelp(false); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", finish);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", finish);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (!prompt) return setShowHelp(true);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  return <div className="relative">
    <button type="button" aria-label="Install app" title="Install app" onClick={() => void install()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-cyan-300/10 hover:text-cyan-200"><Download size={16}/></button>
    {showHelp ? <div className="fixed right-3 top-16 z-[80] w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-cyan-300/25 bg-pitch-950 p-4 shadow-2xl">
      <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cyan-300/10 text-cyan-200"><MonitorDown size={18}/></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">Install Player Analysis</p><p className="mt-1 text-xs leading-relaxed text-slate-400">In Chrome or Edge, open the browser menu and choose <strong className="text-slate-200">Install Player Analysis</strong>. On Safari, use <strong className="text-slate-200">Add to Home Screen</strong>.</p></div><button type="button" aria-label="Close installation help" onClick={() => setShowHelp(false)} className="text-slate-500 hover:text-white"><X size={15}/></button></div>
    </div> : null}
  </div>;
}
