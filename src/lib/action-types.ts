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

// Chaves equivalentes aos campos usados pelo FootballOurPlayers.
export const outfieldActionTypes: ActionType[] = [
  { key: "shortPassSuccess", name: "Passe curto certo", group: "Passe", color: green, outcome: "positive" },
  { key: "shortPassFail", name: "Passe curto errado", group: "Passe", color: red, outcome: "negative" },
  { key: "longPassSuccess", name: "Passe longo certo", group: "Passe", color: green, outcome: "positive" },
  { key: "longPassFail", name: "Passe longo errado", group: "Passe", color: red, outcome: "negative" },
  { key: "crossSuccess", name: "Cruzamento certo", group: "Passe", color: green, outcome: "positive" },
  { key: "crossFail", name: "Cruzamento errado", group: "Passe", color: red, outcome: "negative" },
  { key: "dribbleSuccess", name: "Ação individual certa", group: "Ataque", color: green, outcome: "positive" },
  { key: "dribbleFail", name: "Ação individual errada", group: "Ataque", color: red, outcome: "negative" },
  { key: "throwSuccess", name: "Lançamento lateral certo", group: "Bola parada", color: green, outcome: "positive" },
  { key: "throwFail", name: "Lançamento lateral errado", group: "Bola parada", color: red, outcome: "negative" },
  { key: "shotsOnTarget", name: "Remate enquadrado", group: "Finalização", color: amber, outcome: "positive" },
  { key: "shotsOffTarget", name: "Remate desenquadrado", group: "Finalização", color: red, outcome: "negative" },
  { key: "aerialDuelSuccess", name: "Duelo aéreo ganho", group: "Duelos", color: green, outcome: "positive" },
  { key: "aerialDuelFail", name: "Duelo aéreo perdido", group: "Duelos", color: red, outcome: "negative" },
  { key: "defensiveDuelSuccess", name: "Duelo defensivo ganho", group: "Defesa", color: green, outcome: "positive" },
  { key: "defensiveDuelFail", name: "Duelo defensivo perdido", group: "Defesa", color: red, outcome: "negative" },
  { key: "defensivePositioningToCorrect", name: "Posicionamento defensivo a corrigir", group: "Defesa", color: red, outcome: "negative" },
  { key: "throughPasses", name: "Passe de rutura", group: "Ataque", color: blue, outcome: "positive" },
  { key: "runsInBehind", name: "Movimento em profundidade", group: "Ataque", color: blue, outcome: "positive" },
  { key: "setPieceCrossSuccess", name: "Cruzamento de bola parada certo", group: "Bola parada", color: green, outcome: "positive" },
  { key: "setPieceCrossFail", name: "Cruzamento de bola parada errado", group: "Bola parada", color: red, outcome: "negative" },
  { key: "interceptedCrosses", name: "Cruzamento intercetado", group: "Defesa", color: blue, outcome: "positive" },
  { key: "goals", name: "Golo", group: "Finalização", color: amber, outcome: "positive" },
  { key: "assists", name: "Assistência", group: "Ataque", color: amber, outcome: "positive" },
  { key: "foulsSuffered", name: "Falta sofrida", group: "Disciplina", color: blue, outcome: "positive" },
  { key: "foulsCommitted", name: "Falta cometida", group: "Disciplina", color: red, outcome: "negative" },
  { key: "recoveries", name: "Recuperação", group: "Defesa", color: green, outcome: "positive" },
  { key: "interceptions", name: "Interceção", group: "Defesa", color: green, outcome: "positive" },
  { key: "offsides", name: "Fora de jogo", group: "Ataque", color: red, outcome: "negative" },
  { key: "possessionLosses", name: "Perda de posse", group: "Ataque", color: red, outcome: "negative" },
  { key: "responsibilityGoal", name: "Erro que origina golo", group: "Defesa", color: red, outcome: "negative" },
  { key: "yellowCards", name: "Cartão amarelo", group: "Disciplina", color: amber, outcome: "neutral" },
  { key: "redCards", name: "Cartão vermelho", group: "Disciplina", color: red, outcome: "negative" },
];

export const goalkeeperActionTypes: ActionType[] = [
  { key: "saves", name: "Defesa", group: "Guarda-redes", color: green, goalkeeper: true, outcome: "positive" },
  { key: "incompleteSaves", name: "Defesa incompleta", group: "Guarda-redes", color: amber, goalkeeper: true, outcome: "negative" },
  { key: "shotsConceded", name: "Remate sofrido", group: "Guarda-redes", color: blue, goalkeeper: true, outcome: "neutral" },
  { key: "goalsConceded", name: "Golo sofrido", group: "Guarda-redes", color: red, goalkeeper: true, outcome: "negative" },
];

export const allActionTypes = [...outfieldActionTypes, ...goalkeeperActionTypes];
export const actionTypeByKey = new Map(allActionTypes.map((action) => [action.key, action]));

export function actionsForPlayer(isGoalkeeper: boolean) {
  return isGoalkeeper ? goalkeeperActionTypes : outfieldActionTypes;
}
