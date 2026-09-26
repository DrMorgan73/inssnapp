"use client";

import { useEffect, useState } from "react";
import type { User } from "../lib/session";

type AuditEvent = {
  id: string;
  showingId: string;
  actorRole: string;
  transition: string;
  fromState: string;
  toState: string;
  idempotencyKey: string;
  at: string;
};

export function AuditLog({ user }: { user: User }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
      }
    }
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Audit Log</h2>
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">No events yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Transition</th>
                <th className="pb-2 pr-4">From → To</th>
                <th className="pb-2 pr-4">Actor Role</th>
                <th className="pb-2">Idempotency Key</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-500">
                    {new Date(e.at).toLocaleTimeString()}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-700">{e.transition}</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">
                    {e.fromState} → {e.toState}
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-600">{e.actorRole}</td>
                  <td className="py-2 font-mono text-xs text-slate-400">
                    {e.idempotencyKey.slice(0, 20)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
