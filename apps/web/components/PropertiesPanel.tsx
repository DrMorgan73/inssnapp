"use client";

import type { User } from "../lib/session";

export function PropertiesPanel({ user }: { user: User }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Properties</h2>
      <div className="space-y-2">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-sm font-medium text-slate-700">The Alder</p>
          <p className="text-xs text-slate-500">120 Alder St, Seattle, WA · 2 units</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-sm font-medium text-slate-700">Maple Court</p>
          <p className="text-xs text-slate-500">88 Maple Ave, Bellevue, WA · 1 unit</p>
        </div>
      </div>
    </section>
  );
}
