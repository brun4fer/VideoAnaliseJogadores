export const accessAreas = ["matches", "newMatch", "maps", "reports", "squad", "analysis"] as const;

export type AccessArea = typeof accessAreas[number];

export const accessAreaDetails: Record<AccessArea, { label: string; defaultPassword: string }> = {
  matches: { label: "Matches", defaultPassword: "matches" },
  newMatch: { label: "New match", defaultPassword: "newmatch" },
  maps: { label: "Maps", defaultPassword: "maps" },
  reports: { label: "Reports", defaultPassword: "reports" },
  squad: { label: "Squad", defaultPassword: "squad" },
  analysis: { label: "Analysis", defaultPassword: "analysis" },
};

export const globalAccessDefaultPassword = "global";

// Temporarily disabled: keep the complete area-password feature ready to reactivate.
export const areaPasswordsEnabled = false;

export function isAccessArea(value: unknown): value is AccessArea {
  return typeof value === "string" && accessAreas.includes(value as AccessArea);
}

export function accessAreaForPath(pathname: string): AccessArea | null {
  if (pathname === "/") return "matches";
  if (pathname === "/matches/new" || pathname.startsWith("/matches/new/")) return "newMatch";
  if (pathname.startsWith("/maps")) return "maps";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/structure")) return "squad";
  if (pathname.startsWith("/analysis")) return "analysis";
  return null;
}
