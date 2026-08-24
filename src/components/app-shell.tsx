"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, Home, LockKeyhole, LogOut, Map, Plus, UsersRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { apiFetch } from "@/lib/http";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { ManagementAccessDialog } from "@/components/management-access-dialog";
import { Button, Label, Panel } from "@/components/ui";

const links = [
  { href: "/", label: "Matches", icon: Home, protected: true },
  { href: "/matches/new", label: "New match", icon: Plus, protected: true },
  { href: "/maps", label: "Maps", icon: Map, protected: false },
  { href: "/reports", label: "Reports", icon: BarChart3, protected: false },
  { href: "/structure", label: "Squad", icon: UsersRound, protected: true },
];

type Account = { name: string; teamName: string | null; managementAccess: { configured: boolean; unlocked: boolean } };
type Presence = { activeElsewhere: boolean; otherActiveSessions: number };
function isManagementPath(pathname: string) { return pathname === "/" || pathname.startsWith("/matches") || pathname.startsWith("/structure") || pathname.startsWith("/analysis"); }

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [account, setAccount] = useState<Account | null>(null);
  const [showManagementAccess, setShowManagementAccess] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [presenceAcknowledged, setPresenceAcknowledged] = useState(false);
  const isPublic = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (!isPublic) apiFetch<Account>("/api/account").then((next) => {
      setAccount(next);
      if (!next.managementAccess.configured || (isManagementPath(pathname) && !next.managementAccess.unlocked)) setShowManagementAccess(true);
    }).catch(() => undefined);
  }, [isPublic, pathname]);

  useEffect(() => {
    if (isPublic) return;
    let stopped = false;

    async function heartbeat() {
      try {
        const next = await apiFetch<Presence>("/api/presence", { method: "POST" });
        if (stopped) return;
        setPresence(next);
        if (!next.activeElsewhere) setPresenceAcknowledged(false);
      } catch {
        // Authentication failures are already handled by apiFetch. A temporary
        // network failure should not interrupt the user's analysis workspace.
      }
    }

    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 20_000);
    const refreshPresence = () => void heartbeat();
    window.addEventListener("focus", refreshPresence);
    document.addEventListener("visibilitychange", refreshPresence);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshPresence);
      document.removeEventListener("visibilitychange", refreshPresence);
    };
  }, [isPublic]);

  if (isPublic) return <main className="min-h-screen">{children}</main>;

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return <div className="min-h-screen">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-pitch-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-2 px-2 py-2 sm:px-4">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-glow"><UsersRound size={20} /></span>
          <span className="min-w-0"><span className="block truncate text-sm font-semibold text-cyan-100">{account?.teamName?.toUpperCase() || "PLAYER · ANALYSIS"}</span><span className="block truncate text-xs text-slate-400">{account?.name || "Players, video and maps"}</span></span>
        </Link>
        <div className="flex min-w-0 items-center gap-2"><nav className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg border border-white/10 bg-white/[.03] p-1">
          {links.map(({ href, label, icon: Icon, protected: needsManagement }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link key={href} href={href} onClick={(event) => {
              if (needsManagement && account && !account.managementAccess.unlocked) {
                event.preventDefault();
                setPendingHref(href);
                setShowManagementAccess(true);
              }
            }} className={cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-slate-300 transition hover:bg-white/[.08] hover:text-white", active && "bg-cyan-300/10 text-cyan-100 ring-1 ring-cyan-300/20")}><Icon size={16} /><span className="hidden sm:inline">{label}</span>{needsManagement && account && !account.managementAccess.unlocked ? <LockKeyhole size={10} className="text-amber-300" aria-label="Locked"/> : null}</Link>;
          })}
        </nav><PwaInstallButton/><button type="button" aria-label="Sign out" onClick={() => void logout()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white/[.08] hover:text-white"><LogOut size={16}/></button></div>
      </div>
    </header>
    <main className="mx-auto max-w-[1800px] px-2 py-3 sm:px-4">{children}</main>
    {presence?.activeElsewhere && !presenceAcknowledged ? <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" role="alertdialog" aria-modal="true" aria-labelledby="concurrent-access-title" aria-describedby="concurrent-access-description">
      <Panel className="w-full max-w-lg overflow-hidden border-amber-300/30 bg-pitch-950 p-5 shadow-2xl sm:p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-amber-300/30 bg-amber-300/10 text-amber-200"><AlertTriangle size={22}/></div>
        <Label className="mt-4 block text-amber-300/70">Concurrent access detected</Label>
        <h2 id="concurrent-access-title" className="mt-1 text-xl font-bold text-white">Another user is currently active</h2>
        <p id="concurrent-access-description" className="mt-2 text-sm leading-relaxed text-slate-400">This account is already being used in another browser or device. Editing matches at the same time can create conflicting analysis data. Please coordinate with the other user before continuing.</p>
        {presence.otherActiveSessions > 1 ? <p className="mt-2 text-xs text-amber-200">{presence.otherActiveSessions} other active sessions were detected.</p> : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={() => setPresenceAcknowledged(true)}>Continue anyway</Button>
          <Button variant="primary" onClick={() => void logout()}><LogOut size={15}/>Sign out</Button>
        </div>
      </Panel>
    </div> : null}
    {showManagementAccess && account ? <ManagementAccessDialog configured={account.managementAccess.configured} canDismiss={!isManagementPath(pathname)} onDismiss={() => { setShowManagementAccess(false); setPendingHref(null); }} onUnlocked={() => {
      setAccount({ ...account, managementAccess: { configured: true, unlocked: true } });
      setShowManagementAccess(false);
      const target = pendingHref;
      setPendingHref(null);
      if (target && target !== pathname) window.location.href = target;
      else if (isManagementPath(pathname)) window.location.reload();
    }}/>: null}
  </div>;
}
