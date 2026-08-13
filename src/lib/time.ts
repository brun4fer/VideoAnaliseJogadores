export function roundTime(value: number) {
  return Math.round(value * 10) / 10;
}

export function formatTime(seconds: number) {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}.${tenths}`;
}

export function actionWindow(eventTime: number, duration?: number) {
  return {
    startTimeSeconds: roundTime(Math.max(0, eventTime - 4)),
    endTimeSeconds: roundTime(Math.min(duration || Number.POSITIVE_INFINITY, eventTime + 6)),
  };
}
