export function roundTime(value: number) {
  return Math.round(value * 10) / 10;
}

export function formatTime(seconds: number) {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const total = Math.floor(safe);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function actionWindow(eventTime: number, duration?: number) {
  return {
    startTimeSeconds: roundTime(Math.max(0, eventTime - 4)),
    endTimeSeconds: roundTime(Math.min(duration || Number.POSITIVE_INFINITY, eventTime + 6)),
  };
}
