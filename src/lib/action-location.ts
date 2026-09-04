export type FieldLocation = {
  fieldX: number | null;
  fieldY: number | null;
};

type TimedFieldLocation = FieldLocation & {
  eventTimeSeconds?: number;
};

export function resolveFieldLocation(current: FieldLocation, fallbacks: TimedFieldLocation[], eventTimeSeconds: number): FieldLocation {
  if (hasFieldLocation(current)) return current;

  const nearest = fallbacks
    .filter(hasFieldLocation)
    .sort((left, right) => distanceFrom(left, eventTimeSeconds) - distanceFrom(right, eventTimeSeconds))[0];

  return nearest ? { fieldX: nearest.fieldX, fieldY: nearest.fieldY } : { fieldX: null, fieldY: null };
}

function hasFieldLocation(location: TimedFieldLocation): location is TimedFieldLocation & { fieldX: number; fieldY: number } {
  return Number.isFinite(location.fieldX) && Number.isFinite(location.fieldY);
}

function distanceFrom(location: TimedFieldLocation, eventTimeSeconds: number) {
  return location.eventTimeSeconds === undefined ? Number.POSITIVE_INFINITY : Math.abs(location.eventTimeSeconds - eventTimeSeconds);
}
