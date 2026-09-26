"use client";

import type { User } from "../lib/session";

type Unit = {
  id: string;
  propertyId: string;
  label: string;
  eligible: boolean;
  residentAvailable: boolean;
};

export function UnitsPanel({ user }: { user: User }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Units</h2>
      <p className="text-sm text-slate-500">
        Unit eligibility and resident availability are managed here and synced from your PMS.
      </p>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="font-medium text-slate-700">4B — The Alder</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            Eligible · Available
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="font-medium text-slate-700">2A — The Alder</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            Eligible · Available
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="font-medium text-slate-700">1C — Maple Court</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Eligible · Unavailable
          </span>
        </div>
      </div>
    </section>
  );
}
