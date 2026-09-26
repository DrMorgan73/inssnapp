"use client";

import { useState } from "react";
import type { User } from "../lib/session";

type Showing = {
  id: string;
  unitId: string;
  state: string;
  outcome: string | null;
  brokerRequired: boolean;
  version: number;
  updatedAt: string;
};

type Unit = {
  id: string;
  propertyId: string;
  label: string;
  eligible: boolean;
  residentAvailable: boolean;
};

const STATE_COLORS: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  REQUESTED: "bg-amber-100 text-amber-800",
  RESIDENT_ACCEPTED: "bg-blue-100 text-blue-800",
  BROKER_GATE: "bg-purple-100 text-purple-800",
  CONFIRMED: "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-cyan-100 text-cyan-800",
  COMPLETED: "bg-teal-100 text-teal-800",
  OUTCOME: "bg-slate-200 text-slate-800",
};

const NEXT_ACTIONS: Record<string, { label: string; transition: string; roles: string[] }[]> = {
  AVAILABLE: [{ label: "Request Showing", transition: "PROSPECT_REQUEST", roles: ["prospect"] }],
  REQUESTED: [
    { label: "Accept", transition: "RESIDENT_ACCEPT", roles: ["resident"] },
    { label: "Decline", transition: "RESIDENT_DECLINE", roles: ["resident"] },
  ],
  RESIDENT_ACCEPTED: [
    { label: "Confirm", transition: "CONFIRM", roles: ["management", "inssnapp_admin"] },
    { label: "Assign Broker", transition: "BROKER_ASSIGN", roles: ["management", "inssnapp_admin"] },
  ],
  BROKER_GATE: [
    { label: "Accept", transition: "BROKER_ACCEPT", roles: ["broker"] },
    { label: "Decline", transition: "BROKER_DECLINE", roles: ["broker"] },
  ],
  CONFIRMED: [{ label: "Check In", transition: "CHECK_IN", roles: ["broker", "resident"] }],
  IN_PROGRESS: [{ label: "Complete", transition: "COMPLETE", roles: ["broker", "resident"] }],
  COMPLETED: [
    { label: "Apply", transition: "RECORD_OUTCOME", roles: ["prospect"] },
    { label: "Watch", transition: "RECORD_OUTCOME", roles: ["prospect"] },
    { label: "Decline", transition: "RECORD_OUTCOME", roles: ["prospect"] },
  ],
  OUTCOME: [],
};

export function ShowingCard({
  showing,
  units,
  user,
  onChanged,
}: {
  showing: Showing;
  units: Unit[];
  user: User;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unit = units.find((u) => u.id === showing.unitId);

  async function doAction(transition: string, outcome?: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/showings/${showing.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transition, outcome, idempotencyKey: `${showing.id}-${transition}` }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Action failed");
      return;
    }
    onChanged();
  }

  const actions = (NEXT_ACTIONS[showing.state] ?? []).filter((a) => a.roles.includes(user.role));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-900">Unit {unit?.label ?? showing.unitId}</p>
          <p className="text-xs text-slate-500">v{showing.version}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATE_COLORS[showing.state] ?? "bg-slate-100 text-slate-600"}`}
        >
          {showing.state.replace(/_/g, " ")}
        </span>
      </div>

      {showing.outcome && (
        <p className="mb-2 text-sm text-slate-600">
          Outcome: <span className="font-medium">{showing.outcome}</span>
        </p>
      )}

      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
      )}

      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              disabled={busy}
              onClick={() => doAction(a.transition, a.label.toLowerCase())}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
