export type PlayerRecord = {
  id: string; name: string; shirtNumber: number | null; photoUrl: string | null;
  position: string | null; isGoalkeeper: boolean; active: boolean; clubId: string;
};

export type SubActionRecord = {
  id: string; playerActionId: string; actionKey: string; actionName: string;
  eventTimeSeconds: number; fieldX: number | null; fieldY: number | null;
  notes: string | null; outcome: string | null;
};

export type ActionRecord = {
  id: string; matchId: string; playerId: string; actionKey: string; actionName: string;
  eventTimeSeconds: number; startTimeSeconds: number; endTimeSeconds: number; period: number | null;
  createdAt: string;
  fieldX: number | null; fieldY: number | null; notes: string | null; outcome: string | null;
  player: PlayerRecord; subActions: SubActionRecord[];
};

export type MatchDetail = {
  id: string; matchDate: string | null; roundName: string | null; firstHalfAttacksRight: boolean;
  firstHalfStartSeconds: number | null; firstHalfEndSeconds: number | null;
  secondHalfStartSeconds: number | null; secondHalfEndSeconds: number | null;
  venue: string | null; notes: string | null; clubId: string; opponentClubId: string; competitionId: string;
  club: { id: string; name: string; players: PlayerRecord[] };
  squad: Array<{ playerId: string; sortOrder: number; player: PlayerRecord }>;
  opponentClub: { id: string; name: string };
  competition: { id: string; name: string; season: { id: string; name: string } };
  video: { fileName: string; fileSize: string; durationSeconds: number; mimeType: string; storageStatus: "LOCAL" | "UPLOADING" | "READY" | "FAILED"; uploadedAt: string | null } | null;
  playerActions: ActionRecord[];
};

export function matchLabel(match: { club: { name: string }; opponentClub: { name: string }; roundName?: string | null }) {
  return `${match.club.name} vs ${match.opponentClub.name}${match.roundName ? ` · ${match.roundName}` : ""}`;
}
