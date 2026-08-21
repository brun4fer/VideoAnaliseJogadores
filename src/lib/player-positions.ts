const positionLabels: Record<string, string> = {
  "Guarda-Redes": "Goalkeeper",
  "Defesa Direito": "Right-Back",
  "Defesa Esquerdo": "Left-Back",
  "Defesa Central": "Centre-Back",
  "Lateral Direito": "Right Wing-Back",
  "Lateral Esquerdo": "Left Wing-Back",
  "Médio Defensivo": "Defensive Midfielder",
  "Médio Centro": "Central Midfielder",
  "Médio Ofensivo": "Attacking Midfielder",
  "Extremo Direito": "Right Winger",
  "Extremo Esquerdo": "Left Winger",
  "Avançado": "Forward",
  "Ponta de Lança": "Striker",
};

export function playerPositionLabel(position: string | null | undefined) {
  return position ? positionLabels[position] || position : "No position";
}

const positionOrder = [
  ["Goalkeeper", "Guarda-Redes"],
  ["Right-Back", "Defesa Direito", "Right Wing-Back", "Lateral Direito"],
  ["Centre-Back", "Defesa Central"],
  ["Left-Back", "Defesa Esquerdo", "Left Wing-Back", "Lateral Esquerdo"],
  ["Defensive Midfielder", "Médio Defensivo"],
  ["Central Midfielder", "Médio Centro"],
  ["Attacking Midfielder", "Médio Ofensivo"],
  ["Right Winger", "Extremo Direito"],
  ["Left Winger", "Extremo Esquerdo"],
  ["Forward", "Avançado"],
  ["Striker", "Ponta de Lança"],
];

export function playerPositionRank(player: { position?: string | null; isGoalkeeper?: boolean }) {
  if (player.isGoalkeeper) return 0;
  const index = positionOrder.findIndex((positions) => player.position && positions.includes(player.position));
  return index < 0 ? positionOrder.length : index;
}

export function sortPlayersByPosition<T extends { name: string; shirtNumber?: number | null; position?: string | null; isGoalkeeper?: boolean }>(players: T[]) {
  return [...players].sort((a, b) => playerPositionRank(a) - playerPositionRank(b) || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999) || a.name.localeCompare(b.name));
}

export type PlayerPositionGroup = "goalkeepers" | "defenders" | "midfielders" | "forwards";

export function playerPositionGroup(player: { position?: string | null; isGoalkeeper?: boolean }): PlayerPositionGroup {
  if (player.isGoalkeeper) return "goalkeepers";
  const position = (player.position || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (position.includes("goalkeeper") || position.includes("guarda-redes")) return "goalkeepers";
  if (position.includes("back") || position.includes("defesa") || position.includes("lateral")) return "defenders";
  if (position.includes("midfielder") || position.includes("medio")) return "midfielders";
  return "forwards";
}
