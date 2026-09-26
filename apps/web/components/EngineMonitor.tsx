"use client";

import { useEffect, useState } from "react";
import type { User } from "../lib/session";

type Showing = {
  id: string;
  unitId: string;
  state: string;
  outcome: string | null;
  version: number;
  updatedAt: string;
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

export function EngineMonitor({ user }: { user: User }) {
  const [showings, setShowings] = useState<Showing[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/showings");
      if (res.ok) {
        const data = await res.json();
        setShowings(data.showings);
      }
    }
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Showing Engine Monitor</h2>
      {showings.length === 0 ? (
        <p className="text-sm text-slate-500">No active showings.</p>
      ) : (
        <div className="space-y-2">
          {showings.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-slate-700">Unit {s.unitId}</p>
                <p className="text-xs text-slate-500">v{s.version}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATE_COLORS[s.state] ?? "bg-slate-100 text-slate-600"}`}
              >
                {s.state.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
