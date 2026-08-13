export type PlayerRecord = {
  id: string; name: string; shirtNumber: number | null; photoUrl: string | null;
  position: string | null; isGoalkeeper: boolean; active: boolean; clubId: string;
};

export type ActionRecord = {
  id: string; matchId: string; playerId: string; actionKey: string; actionName: string;
  eventTimeSeconds: number; startTimeSeconds: number; endTimeSeconds: number;
  fieldX: number | null; fieldY: number | null; notes: string | null; outcome: string | null;
  player: PlayerRecord;
};

export type MatchDetail = {
  id: string; matchDate: string | null; roundName: string | null;
  venue: string | null; notes: string | null; clubId: string; opponentClubId: string; competitionId: string;
  club: { id: string; name: string; players: PlayerRecord[] };
  opponentClub: { id: string; name: string };
  competition: { id: string; name: string; season: { id: string; name: string } };
  video: { fileName: string; fileSize: string; durationSeconds: number; mimeType: string } | null;
  playerActions: ActionRecord[];
};

export function matchLabel(match: { club: { name: string }; opponentClub: { name: string }; roundName?: string | null }) {
  return `${match.club.name} vs ${match.opponentClub.name}${match.roundName ? ` · ${match.roundName}` : ""}`;
}
