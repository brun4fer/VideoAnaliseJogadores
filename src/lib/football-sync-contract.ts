export const footballOutfieldStatKeys = [
  "shortPassSuccess", "shortPassFail", "longPassSuccess", "longPassFail",
  "crossSuccess", "crossFail", "dribbleSuccess", "dribbleFail",
  "throwSuccess", "throwFail", "shotsOnTarget", "shotsOffTarget",
  "aerialDuelSuccess", "aerialDuelFail", "defensiveDuelSuccess", "defensiveDuelFail",
  "defensivePositioningToCorrect", "throughPasses", "runsInBehind",
  "setPieceCrossSuccess", "setPieceCrossFail", "interceptedCrosses", "goals",
  "assists", "foulsSuffered", "foulsCommitted", "recoveries", "interceptions",
  "offsides", "possessionLosses", "responsibilityGoal", "yellowCards", "redCards",
] as const;

export const footballGoalkeeperStatKeys = ["saves", "incompleteSaves", "shotsConceded", "goalsConceded"] as const;

export const footballStatLabels: Record<string, string> = {
  shortPassSuccess: "Successful short passes", shortPassFail: "Unsuccessful short passes",
  longPassSuccess: "Successful long passes", longPassFail: "Unsuccessful long passes",
  crossSuccess: "Successful crosses", crossFail: "Unsuccessful crosses",
  dribbleSuccess: "Successful individual actions", dribbleFail: "Unsuccessful individual actions",
  throwSuccess: "Successful throw-ins", throwFail: "Unsuccessful throw-ins",
  shotsOnTarget: "Shots on target", shotsOffTarget: "Shots off target",
  aerialDuelSuccess: "Aerial duels won", aerialDuelFail: "Aerial duels lost",
  defensiveDuelSuccess: "Defensive duels won", defensiveDuelFail: "Defensive duels lost",
  defensivePositioningToCorrect: "Defensive positioning to correct", throughPasses: "Through passes",
  runsInBehind: "Runs in behind", setPieceCrossSuccess: "Successful set-piece crosses",
  setPieceCrossFail: "Unsuccessful set-piece crosses", interceptedCrosses: "Intercepted crosses",
  goals: "Goals", assists: "Assists", foulsSuffered: "Fouls won", foulsCommitted: "Fouls committed",
  recoveries: "Recoveries", interceptions: "Interceptions", offsides: "Offsides",
  possessionLosses: "Other possession losses", responsibilityGoal: "Errors leading to goals",
  yellowCards: "Yellow cards", redCards: "Red cards", saves: "Saves",
  incompleteSaves: "Incomplete saves", shotsConceded: "Shots faced", goalsConceded: "Goals conceded",
};

export type FootballSyncKind = "season" | "competition" | "team" | "player" | "match";
export type FootballPlayerSummary = {
  id: string;
  name: string;
  position: string | null;
  isGoalkeeper: boolean;
  lineupGroup: string | null;
  minutesPlayed: number | null;
  totalActions: number;
  stats: Record<string, number>;
  goalkeeperStats: Record<string, number>;
};

export type FootballSyncPreview = {
  configured: boolean;
  match: {
    id: string;
    date: string | null;
    roundName: string | null;
    homeAway: "HOME" | "AWAY";
    syncedAt: string | null;
  };
  season: { id: string; name: string; syncedAt: string | null };
  competition: { id: string; name: string; syncedAt: string | null };
  team: { id: string; name: string; syncedAt: string | null; playerCount: number };
  opponent: { id: string; name: string };
  players: FootballPlayerSummary[];
  totalActions: number;
  unclassifiedOccurrences: number;
};
