export type ActionType = {
  key: string;
  name: string;
  group: string;
  color: string;
  goalkeeper?: boolean;
  outcome?: "positive" | "negative" | "neutral";
};

const green = "#34d399";
const red = "#fb7185";
const blue = "#22d3ee";
const amber = "#fbbf24";

export const outfieldActionTypes: ActionType[] = [
  { key: "shortPassSuccess", name: "Successful short pass", group: "Passing", color: green, outcome: "positive" },
  { key: "shortPassFail", name: "Unsuccessful short pass", group: "Passing", color: red, outcome: "negative" },
  { key: "longPassSuccess", name: "Successful long pass", group: "Passing", color: green, outcome: "positive" },
  { key: "longPassFail", name: "Unsuccessful long pass", group: "Passing", color: red, outcome: "negative" },
  { key: "crossSuccess", name: "Successful cross", group: "Passing", color: green, outcome: "positive" },
  { key: "crossFail", name: "Unsuccessful cross", group: "Passing", color: red, outcome: "negative" },
  { key: "dribbleSuccess", name: "Successful individual action", group: "Attacking", color: green, outcome: "positive" },
  { key: "dribbleFail", name: "Unsuccessful individual action", group: "Attacking", color: red, outcome: "negative" },
  { key: "throwSuccess", name: "Successful throw-in", group: "Set pieces", color: green, outcome: "positive" },
  { key: "throwFail", name: "Unsuccessful throw-in", group: "Set pieces", color: red, outcome: "negative" },
  { key: "shotsOnTarget", name: "Shot on target", group: "Finishing", color: amber, outcome: "positive" },
  { key: "shotsOffTarget", name: "Shot off target", group: "Finishing", color: red, outcome: "negative" },
  { key: "aerialDuelSuccess", name: "Aerial duel won", group: "Duels", color: green, outcome: "positive" },
  { key: "aerialDuelFail", name: "Aerial duel lost", group: "Duels", color: red, outcome: "negative" },
  { key: "defensiveDuelSuccess", name: "Defensive duel won", group: "Defending", color: green, outcome: "positive" },
  { key: "defensiveDuelFail", name: "Defensive duel lost", group: "Defending", color: red, outcome: "negative" },
  { key: "defensivePositioningToCorrect", name: "Defensive positioning to correct", group: "Defending", color: red, outcome: "negative" },
  { key: "throughPasses", name: "Through pass", group: "Attacking", color: blue, outcome: "positive" },
  { key: "runsInBehind", name: "Run in behind", group: "Attacking", color: blue, outcome: "positive" },
  { key: "setPieceCrossSuccess", name: "Successful set-piece cross", group: "Set pieces", color: green, outcome: "positive" },
  { key: "setPieceCrossFail", name: "Unsuccessful set-piece cross", group: "Set pieces", color: red, outcome: "negative" },
  { key: "interceptedCrosses", name: "Intercepted cross", group: "Defending", color: blue, outcome: "positive" },
  { key: "goals", name: "Goal", group: "Finishing", color: amber, outcome: "positive" },
  { key: "assists", name: "Assist", group: "Attacking", color: amber, outcome: "positive" },
  { key: "foulsSuffered", name: "Foul won", group: "Discipline", color: blue, outcome: "positive" },
  { key: "foulsCommitted", name: "Foul committed", group: "Discipline", color: red, outcome: "negative" },
  { key: "recoveries", name: "Recovery", group: "Defending", color: green, outcome: "positive" },
  { key: "interceptions", name: "Interception", group: "Defending", color: green, outcome: "positive" },
  { key: "offsides", name: "Offside", group: "Attacking", color: red, outcome: "negative" },
  { key: "possessionLosses", name: "Possession loss", group: "Attacking", color: red, outcome: "negative" },
  { key: "responsibilityGoal", name: "Error leading to goal", group: "Defending", color: red, outcome: "negative" },
  { key: "yellowCards", name: "Yellow card", group: "Discipline", color: amber, outcome: "neutral" },
  { key: "redCards", name: "Red card", group: "Discipline", color: red, outcome: "negative" },
];

export const goalkeeperActionTypes: ActionType[] = [
  { key: "saves", name: "Save", group: "Goalkeeping", color: green, goalkeeper: true, outcome: "positive" },
  { key: "incompleteSaves", name: "Incomplete save", group: "Goalkeeping", color: amber, goalkeeper: true, outcome: "negative" },
  { key: "shotsConceded", name: "Shot faced", group: "Goalkeeping", color: blue, goalkeeper: true, outcome: "neutral" },
  { key: "goalsConceded", name: "Goal conceded", group: "Goalkeeping", color: red, goalkeeper: true, outcome: "negative" },
];

export const allActionTypes = [...outfieldActionTypes, ...goalkeeperActionTypes];
export const actionTypeByKey = new Map(allActionTypes.map((action) => [action.key, action]));

export type ActionFilterGroup = {
  key: string;
  name: string;
  actionKeys: string[];
};

export const actionFilterGroups: ActionFilterGroup[] = [
  { key: "group:shortPass", name: "Short pass", actionKeys: ["shortPassSuccess", "shortPassFail"] },
  { key: "group:longPass", name: "Long pass", actionKeys: ["longPassSuccess", "longPassFail"] },
  { key: "group:cross", name: "Cross", actionKeys: ["crossSuccess", "crossFail"] },
  { key: "group:individualAction", name: "Individual action", actionKeys: ["dribbleSuccess", "dribbleFail"] },
  { key: "group:throwIn", name: "Throw-in", actionKeys: ["throwSuccess", "throwFail"] },
  { key: "group:shot", name: "Shot", actionKeys: ["shotsOnTarget", "shotsOffTarget"] },
  { key: "group:aerialDuel", name: "Aerial duel", actionKeys: ["aerialDuelSuccess", "aerialDuelFail"] },
  { key: "group:defensiveDuel", name: "Defensive duel", actionKeys: ["defensiveDuelSuccess", "defensiveDuelFail"] },
  { key: "group:setPieceCross", name: "Set-piece cross", actionKeys: ["setPieceCrossSuccess", "setPieceCrossFail"] },
  { key: "group:foul", name: "Foul", actionKeys: ["foulsSuffered", "foulsCommitted"] },
  { key: "group:save", name: "Goalkeeper save", actionKeys: ["saves", "incompleteSaves"] },
];

const actionFilterGroupByKey = new Map(actionFilterGroups.map((group) => [group.key, group]));
const groupedActionKeys = new Set(actionFilterGroups.flatMap((group) => group.actionKeys));
export const standaloneActionTypes = allActionTypes.filter((action) => !groupedActionKeys.has(action.key));

export function actionMatchesFilter(actionKey: string, filterKey: string) {
  if (filterKey === "all") return true;
  return actionFilterGroupByKey.get(filterKey)?.actionKeys.includes(actionKey) ?? actionKey === filterKey;
}

export function actionFilterName(filterKey: string) {
  if (filterKey === "all") return "All actions";
  return actionFilterGroupByKey.get(filterKey)?.name || actionTypeByKey.get(filterKey)?.name || "All actions";
}

export function actionsForPlayer(isGoalkeeper: boolean) { return isGoalkeeper ? [...goalkeeperActionTypes, ...outfieldActionTypes] : outfieldActionTypes; }
export function actionResultColor(outcome?: string | null) {
  return outcome === "positive" ? green : outcome === "negative" ? red : outcome === "neutral" ? amber : "#64748b";
}
