"use client";

import { cn } from "@/lib/cn";
export type Coordinate = { x: number; y: number };
export type PitchPoint = Coordinate & { id: string; color?: string; label?: string; details?: string[]; active?: boolean };

export function Pitch({ points = [], value, onChange, onPointSelect, compact = false, className }: { points?: PitchPoint[]; value?: Coordinate | null; onChange?: (coordinate: Coordinate) => void; onPointSelect?: (id: string) => void; compact?: boolean; className?: string }) {
  function select(event: React.MouseEvent<HTMLButtonElement>) {
    if (!onChange) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onChange({ x: Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 10, y: Math.round(((event.clientY - rect.top) / rect.height) * 1000) / 10 });
  }
  const markers = value ? [...points, { id: "selected", ...value, active: true, color: "#22d3ee" }] : points;
  return <button type="button" onClick={select} className={cn("relative block w-full overflow-hidden border-2 border-white/25 bg-[#167641] text-left shadow-inner", compact ? "aspect-[1.9/1] rounded-md" : "aspect-[1.55/1] rounded-xl", onChange ? "cursor-crosshair" : "cursor-default", className)}>
    <svg viewBox="0 0 105 68" className="absolute inset-0 h-full w-full" aria-hidden="true"><rect x="1" y="1" width="103" height="66" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth=".7"/><line x1="52.5" y1="1" x2="52.5" y2="67" stroke="rgba(255,255,255,.85)" strokeWidth=".7"/><circle cx="52.5" cy="34" r="9.15" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth=".7"/><circle cx="52.5" cy="34" r=".8" fill="white"/><rect x="1" y="13.84" width="16.5" height="40.32" fill="none" stroke="white" strokeOpacity=".8" strokeWidth=".7"/><rect x="87.5" y="13.84" width="16.5" height="40.32" fill="none" stroke="white" strokeOpacity=".8" strokeWidth=".7"/><rect x="1" y="24.84" width="5.5" height="18.32" fill="none" stroke="white" strokeOpacity=".8" strokeWidth=".7"/><rect x="98.5" y="24.84" width="5.5" height="18.32" fill="none" stroke="white" strokeOpacity=".8" strokeWidth=".7"/></svg>
    {markers.map((point) => <span key={point.id} onClick={(event) => { event.stopPropagation(); onPointSelect?.(point.id); }} className={cn("group absolute z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg hover:z-30", onPointSelect && "cursor-pointer", point.active && "h-5 w-5 ring-4 ring-white/25")} style={{ left: `${point.x}%`, top: `${point.y}%`, backgroundColor: point.color || "#22d3ee" }}>{point.label ? <span className={cn("pointer-events-none absolute z-40 w-56 rounded-lg border border-white/15 bg-slate-950/95 px-3 py-2 text-left opacity-0 shadow-2xl transition-opacity group-hover:opacity-100", point.y < 30 ? "top-full mt-2" : "bottom-full mb-2", point.x < 25 ? "left-0" : point.x > 75 ? "right-0" : "left-1/2 -translate-x-1/2")}><strong className="block text-xs text-white">{point.label}</strong>{point.details?.map((detail, index) => <span key={`${point.id}-${index}`} className="mt-1 block text-[11px] text-slate-300">{detail}</span>)}</span> : null}</span>)}
  </button>;
}
