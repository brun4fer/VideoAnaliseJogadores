import type { MatchDetail, MatchScoreEventRecord } from "@/lib/domain";

export type BroadcastState = { homeScore: number; awayScore: number; homeRedCards: number; awayRedCards: number };

export function scoreAtTime(events: MatchScoreEventRecord[], timeSeconds: number): BroadcastState {
  const ordered = [...events].sort((a, b) => a.timeSeconds - b.timeSeconds || a.createdAt.localeCompare(b.createdAt));
  let score: BroadcastState = { homeScore: 0, awayScore: 0, homeRedCards: 0, awayRedCards: 0 };
  for (const event of ordered) { if (event.timeSeconds > timeSeconds + .05) break; score = { homeScore: event.homeScore, awayScore: event.awayScore, homeRedCards: event.homeRedCards, awayRedCards: event.awayRedCards }; }
  return score;
}

export function matchClockSeconds(match: Pick<MatchDetail, "firstHalfStartSeconds" | "firstHalfEndSeconds" | "secondHalfStartSeconds" | "secondHalfEndSeconds">, time: number) {
  const { firstHalfStartSeconds: first, firstHalfEndSeconds: firstEnd, secondHalfStartSeconds: second, secondHalfEndSeconds: secondEnd } = match;
  if (first === null || time < first) return 0;
  if (second !== null && time >= second) return 2700 + Math.max(0, Math.min(time, secondEnd ?? time) - second);
  return Math.max(0, Math.min(time, firstEnd ?? time) - first);
}

export function formatMatchClock(seconds: number) { const value = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }

export function validateScoreEvent(input: Record<string, unknown>, duration?: number) {
  const timeSeconds = input.timeSeconds;
  if (typeof timeSeconds !== "number" || !Number.isFinite(timeSeconds) || timeSeconds < 0 || (duration && timeSeconds > duration)) throw new Error("Invalid scoreboard time.");
  const score: BroadcastState = { homeScore: 0, awayScore: 0, homeRedCards: 0, awayRedCards: 0 };
  for (const key of ["homeScore", "awayScore", "homeRedCards", "awayRedCards"] as const) { const value = input[key]; if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > (key.endsWith("RedCards") ? 11 : 99)) throw new Error("Invalid score or red cards."); score[key] = value; }
  return { timeSeconds, ...score };
}

export function validateScoreboardSettings(input: Record<string, unknown>) {
  const result: Partial<Pick<MatchDetail, "scoreboardEnabled" | "homeClubName" | "awayClubName" | "homeClubShortName" | "awayClubShortName" | "homeTeamColor" | "awayTeamColor">> = {};
  if (input.scoreboardEnabled !== undefined) { if (typeof input.scoreboardEnabled !== "boolean") throw new Error("Invalid scoreboard option."); result.scoreboardEnabled = input.scoreboardEnabled; }
  for (const key of ["homeClubName", "awayClubName", "homeClubShortName", "awayClubShortName"] as const) { if (input[key] === undefined) continue; if (input[key] !== null && typeof input[key] !== "string") throw new Error("Invalid club name."); const value = (input[key] as string | null)?.trim() || null; if (value && value.length > (key.includes("Short") ? 4 : 100)) throw new Error("Club name is too long."); result[key] = value; }
  for (const key of ["homeTeamColor", "awayTeamColor"] as const) { if (input[key] === undefined) continue; if (typeof input[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(input[key])) throw new Error("Invalid team color."); result[key] = input[key]; }
  return result;
}
