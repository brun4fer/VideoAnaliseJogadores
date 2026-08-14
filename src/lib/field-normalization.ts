export type FieldPoint = { x: number; y: number };

export function attacksRightInPeriod(firstHalfAttacksRight: boolean, period: number | null) {
  if (period === null) return null;
  return period === 1 ? firstHalfAttacksRight : !firstHalfAttacksRight;
}

export function normalizeFieldPoint(point: FieldPoint, period: number | null, firstHalfAttacksRight: boolean): FieldPoint {
  if (attacksRightInPeriod(firstHalfAttacksRight, period) !== false) return point;
  return { x: 100 - point.x, y: 100 - point.y };
}

export function attackDirectionLabel(firstHalfAttacksRight: boolean, period: number | null) {
  const attacksRight = attacksRightInPeriod(firstHalfAttacksRight, period);
  if (attacksRight === null) return "Awaiting period markers";
  return attacksRight ? "Left to right" : "Right to left";
}
