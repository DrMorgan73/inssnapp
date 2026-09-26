"use client";

const INTEGRATIONS = [
  { name: "Yardi PMS", status: "sandbox", detail: "Adapter configured · sandbox mode" },
  { name: "Entrata PMS", status: "sandbox", detail: "Adapter configured · sandbox mode" },
  { name: "Checkr Screening", status: "sandbox", detail: "Sandbox · not processing consumer reports" },
  { name: "Notifications", status: "connected", detail: "Email + push via adapter" },
];

const STATUS_STYLES: Record<string, string> = {
  connected: "bg-emerald-100 text-emerald-800",
  sandbox: "bg-amber-100 text-amber-800",
  error: "bg-red-100 text-red-800",
};

export function IntegrationStatus() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Integration Status</h2>
      <div className="space-y-2">
        {INTEGRATIONS.map((i) => (
          <div
            key={i.name}
            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-slate-700">{i.name}</p>
              <p className="text-xs text-slate-500">{i.detail}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[i.status]}`}
            >
              {i.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
