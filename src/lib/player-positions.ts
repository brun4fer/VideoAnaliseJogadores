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
