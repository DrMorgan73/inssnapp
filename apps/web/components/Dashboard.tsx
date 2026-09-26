"use client";

import { useEffect, useState, useCallback } from "react";
import type { User } from "../lib/session";
import { StatCard } from "./StatCard";
import { ShowingCard } from "./ShowingCard";
import { UnitsPanel } from "./UnitsPanel";
import { PropertiesPanel } from "./PropertiesPanel";

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

export function Dashboard({ user }: { user: User }) {
  const [showings, setShowings] = useState<Showing[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/showings");
    if (res.ok) {
      const data = await res.json();
      setShowings(data.showings);
    }
    const unitsRes = await fetch("/api/units");
    if (unitsRes.ok) {
      const data = await unitsRes.json();
      setUnits(data.units);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000); // live monitor poll
    return () => clearInterval(interval);
  }, [load]);

  const active = showings.filter((s) => s.state !== "OUTCOME");
  const completed = showings.filter((s) => s.state === "OUTCOME");
  const eligibleUnits = units.filter((u) => u.eligible);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {user.role === "resident"
            ? "My Residence"
            : user.role === "prospect"
            ? "Find a Home"
            : user.role === "broker"
            ? "Broker Assignments"
            : "Portfolio Overview"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {user.role === "management" || user.role === "inssnapp_admin"
            ? "Live showing operations across your organization."
            : "Real-time showing coordination."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Showings" value={active.length} accent="text-indigo-600" />
        <StatCard label="Completed" value={completed.length} accent="text-emerald-600" />
        <StatCard label="Eligible Units" value={eligibleUnits.length} accent="text-blue-600" />
        <StatCard
          label="Broker-Gated"
          value={showings.filter((s) => s.state === "BROKER_GATE").length}
          accent="text-purple-600"
        />
      </div>

      {/* Live showings */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Live Showings</h2>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : showings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">No showings yet.</p>
            <p className="mt-1 text-xs text-slate-400">
              Showings appear here as prospects request eligible units.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {showings.map((s) => (
              <ShowingCard key={s.id} showing={s} units={units} user={user} onChanged={load} />
            ))}
          </div>
        )}
      </section>

      {/* Management-only panels */}
      {(user.role === "management" || user.role === "inssnapp_admin") && (
        <div className="grid gap-6 lg:grid-cols-2">
          <PropertiesPanel user={user} />
          <UnitsPanel user={user} />
        </div>
      )}
    </div>
  );
}
