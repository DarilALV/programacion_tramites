"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { formatDate, plannerUsers, technicians, useTramitesStore } from "@/lib/tramites-store";

export default function ReportesPage() {
  const { entries, groupEntriesByCreator, groupEntriesByTechnician, groupEntriesByDateAndCreator, groupEntriesByDateAndTechnician } =
    useTramitesStore();

  const creatorSummary = groupEntriesByCreator();
  const technicianSummary = groupEntriesByTechnician();
  const dailySummary = groupEntriesByDateAndCreator();
  const dailySummaryTechnicians = groupEntriesByDateAndTechnician();

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = useMemo(
    () => entries.filter((entry) => entry.registrationDate === today).length,
    [entries, today],
  );

  return (
    <AppShell
      title="Reporte de control"
      description="Control detallado para supervisor: cuántos registros hacen Wayra y Jaqueline por día, y cómo se distribuyen por técnico."
      eyebrow="Reportes"
    >
      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <h2 className="font-serif text-3xl text-[#1a140d]">Resumen diario</h2>
          <p className="mt-2 text-sm leading-6 text-black/70">
            Registros de hoy: <strong>{todayCount}</strong>
          </p>

          <div className="mt-6 space-y-3">
            {dailySummary.map((row) => (
              <div key={row.date} className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-[#151515]">{formatDate(row.date)}</div>
                  <div className="text-sm text-black/70">Total: <strong>{row.total}</strong></div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-black/70">
                  {plannerUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between gap-3">
                      <span>{user.name}</span>
                      <span>{row.byUser[user.id] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-4xl border border-black/10 bg-[#151515] p-6 text-white shadow-[0_16px_40px_rgba(17,17,17,0.16)]">
          <h2 className="font-serif text-3xl text-white">Producción por usuaria</h2>
          <div className="mt-6 space-y-3">
            {creatorSummary.map((item) => (
              <div key={item.user.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{item.user.name}</span>
                  <span>{item.total} registros</span>
                </div>
              </div>
            ))}
          </div>

          <h3 className="mt-8 font-serif text-2xl text-white">Producción por técnico</h3>
          <div className="mt-4 space-y-3">
            {technicianSummary.map((item) => (
              <div key={item.technician.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{item.technician.name}</div>
                    <div className="text-sm text-white/60">{item.technician.areaLabel}</div>
                  </div>
                  <span>{item.total}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
  <h2 className="font-serif text-3xl text-[#1a140d]">Resumen diario por técnico</h2>
  <p className="mt-2 text-sm leading-6 text-black/70">
    Registros de hoy: <strong>{todayCount}</strong>
  </p>

  <div className="mt-6 space-y-3">
    {dailySummaryTechnicians.map((row) => (
      <div key={row.date} className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="font-semibold text-[#151515]">{formatDate(row.date)}</div>
          <div className="text-sm text-black/70">Total: <strong>{row.total}</strong></div>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-black/70">
          {technicians.map((tech) => (
            <div key={tech.id} className="flex items-center justify-between gap-3">
              <span>{tech.name}</span>
              <span>{row.byTechnician[tech.id] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
</article>
      </section>
    </AppShell>
  );
}
