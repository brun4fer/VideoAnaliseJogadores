export type MatchPeriod = 1 | 2;

export type MatchPeriodMarkers = {
  firstHalfStartSeconds?: number | null;
  firstHalfEndSeconds?: number | null;
  secondHalfStartSeconds?: number | null;
  secondHalfEndSeconds?: number | null;
};

export type PeriodMarkerKey = keyof MatchPeriodMarkers;

export const periodMarkers: Array<[PeriodMarkerKey, string]> = [
  ["firstHalfStartSeconds", "Start 1st half"],
  ["firstHalfEndSeconds", "End 1st half"],
  ["secondHalfStartSeconds", "Start 2nd half"],
  ["secondHalfEndSeconds", "End 2nd half"],
];

export function getMatchPeriodAtTime(match: MatchPeriodMarkers, seconds: number): MatchPeriod | null {
  if (match.firstHalfStartSeconds != null && match.firstHalfEndSeconds != null && seconds >= match.firstHalfStartSeconds && seconds <= match.firstHalfEndSeconds) return 1;
  if (match.secondHalfStartSeconds != null && match.secondHalfEndSeconds != null && seconds >= match.secondHalfStartSeconds && seconds <= match.secondHalfEndSeconds) return 2;
  return null;
}

export function matchPeriodLabel(period: number | null) {
  if (period === 1) return "1st half";
  if (period === 2) return "2nd half";
  return "Unassigned";
}

export function validatePeriodMarkers(markers: Required<MatchPeriodMarkers>) {
  const ordered = periodMarkers.map(([key, label]) => [markers[key], label] as const);
  for (const [seconds, label] of ordered) if (seconds !== null && seconds < 0) throw new Error(`${label} cannot be negative.`);
  let previous: number | null = null;
  for (const [seconds] of ordered) {
    if (seconds === null) continue;
    if (previous !== null && seconds < previous) throw new Error("Match period markers must be saved in chronological order.");
    previous = seconds;
  }
}
