"use client";

import { useState } from "react";
import { actionTypeByKey } from "@/lib/action-types";
import { apiFetch } from "@/lib/http";
import { OutcomeButtons } from "@/components/outcome-buttons";
import { Button, Input, Label, Panel, Select } from "@/components/ui";

export type EditableAnalyticsAction = {
  id: string;
  parentActionId: string;
  sourceType: "subaction" | "occurrence";
  actionKey: string;
  actionName: string;
  outcome?: string | null;
  eventTimeSeconds: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  fieldX?: number | null;
  fieldY?: number | null;
  notes?: string | null;
};

type Draft = {
  actionKey: string;
  outcome: "positive" | "negative" | null;
  eventTimeSeconds: number | "";
  startTimeSeconds: number | "";
  endTimeSeconds: number | "";
  fieldX: number | "";
  fieldY: number | "";
  notes: string;
};

export function ActionEditDialog({ action, onSaved, onClose }: {
  action: EditableAnalyticsAction;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    actionKey: action.actionKey,
    outcome: action.outcome === "positive" || action.outcome === "negative" ? action.outcome : null,
    eventTimeSeconds: action.eventTimeSeconds,
    startTimeSeconds: action.startTimeSeconds,
    endTimeSeconds: action.endTimeSeconds,
    fieldX: action.fieldX ?? "",
    fieldY: action.fieldY ?? "",
    notes: action.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const endpoint = action.sourceType === "subaction" ? `/api/subactions/${action.id}` : `/api/actions/${action.parentActionId}`;
      const body = action.sourceType === "subaction" ? {
        actionKey: draft.actionKey,
        outcome: draft.outcome,
        eventTimeSeconds: Number(draft.eventTimeSeconds),
        fieldX: draft.fieldX === "" ? null : Number(draft.fieldX),
        fieldY: draft.fieldY === "" ? null : Number(draft.fieldY),
        notes: draft.notes,
      } : {
        outcome: draft.outcome,
        eventTimeSeconds: Number(draft.eventTimeSeconds),
        startTimeSeconds: Number(draft.startTimeSeconds),
        endTimeSeconds: Number(draft.endTimeSeconds),
        notes: draft.notes,
      };
      await apiFetch(endpoint, { method: "PATCH", body: JSON.stringify(body) });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the action.");
    } finally {
      setSaving(false);
    }
  }

  function setOutcome(outcome: "positive" | "negative") {
    setDraft((current) => ({ ...current, outcome: current.outcome === outcome ? null : outcome }));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
      <Panel className="w-full max-w-lg p-5">
        <h2 className="text-lg font-bold text-white">Edit analysed action</h2>
        <p className="mt-1 text-xs text-slate-500">Changes are saved directly without leaving Maps or Reports.</p>
        <form onSubmit={save} className="mt-4 grid gap-3">
          {action.sourceType === "subaction" ? (
            <label>
              <Label>Submoment / action</Label>
              <Select className="mt-1" value={draft.actionKey} onChange={(event) => setDraft({ ...draft, actionKey: event.target.value })}>
                {[...actionTypeByKey.values()].map((type) => <option key={type.key} value={type.key}>{type.name}</option>)}
              </Select>
            </label>
          ) : null}
          <div>
            <Label>Result</Label>
            <div className="mt-2"><OutcomeButtons value={draft.outcome} onChange={setOutcome}/></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberField label="Event" value={draft.eventTimeSeconds} onChange={(value) => setDraft({ ...draft, eventTimeSeconds: value })}/>
            {action.sourceType === "occurrence" ? (
              <>
                <NumberField label="Clip start" value={draft.startTimeSeconds} onChange={(value) => setDraft({ ...draft, startTimeSeconds: value })}/>
                <NumberField label="Clip end" value={draft.endTimeSeconds} onChange={(value) => setDraft({ ...draft, endTimeSeconds: value })}/>
              </>
            ) : null}
          </div>
          {action.sourceType === "subaction" ? (
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Pitch X (0–100)" value={draft.fieldX} onChange={(value) => setDraft({ ...draft, fieldX: value })}/>
              <NumberField label="Pitch Y (0–100)" value={draft.fieldY} onChange={(value) => setDraft({ ...draft, fieldY: value })}/>
            </div>
          ) : null}
          <label>
            <Label>Notes</Label>
            <textarea className="mt-1 min-h-24 w-full rounded-md border border-white/10 bg-pitch-950 p-2 text-sm" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })}/>
          </label>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

function NumberField({ label, value, onChange }: {
  label: string;
  value: string | number;
  onChange: (value: number | "") => void;
}) {
  return (
    <label>
      <Label>{label}</Label>
      <Input className="mt-1" type="number" min={0} step={0.1} value={value} onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}/>
    </label>
  );
}
