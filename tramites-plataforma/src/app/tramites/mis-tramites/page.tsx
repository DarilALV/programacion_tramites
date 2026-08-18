"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { formatDate, getStatusTone, useTramitesStore } from "@/lib/tramites-store";

export default function MisTramitesPage() {
  const { currentUser, myEntries, removeEntry } = useTramitesStore();
  const [message, setMessage] = useState("");

  return (
    <AppShell
      title="Mis registros"
      description="Aquí cada usuaria ve sus registros ya guardados directamente en el sistema."
      eyebrow="Seguimiento personal"
    >
      <section className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-4xl border border-black/10 bg-[#fffaf1] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <h2 className="font-serif text-3xl text-[#1a140d]">Usuaria activa</h2>
          <p className="mt-2 text-sm leading-6 text-black/70">
            Esta vista muestra solamente el trabajo de {currentUser.name}.
          </p>

          <div className="mt-6 rounded-3xl border border-black/10 bg-white p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-black/45">Perfil</div>
            <div className="mt-2 text-xl font-semibold">Registradora</div>
            <div className="text-sm text-black/60">Programación de trámites</div>
          </div>

          <div className="mt-4 rounded-3xl border border-black/10 bg-white p-4 text-sm text-black/70">
            Total de registros propios: <strong className="text-black">{myEntries.length}</strong>
          </div>

          <Link
            href="/tramites/nuevo"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#151515] px-5 py-3 text-sm font-semibold text-white"
          >
            Crear nuevo registro
          </Link>
        </aside>

        <article className="rounded-4xl border border-black/10 bg-[#151515] p-6 text-white shadow-[0_16px_40px_rgba(17,17,17,0.16)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl text-white">Listado personal</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Todos los registros aquí ya están visibles para supervisión de forma automática.
              </p>
            </div>
            <div className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/75">
              {currentUser.name}
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {myEntries.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/70">
                Aún no tienes registros.
              </div>
            ) : (
              myEntries.map((entry) => (
                <div key={entry.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{entry.registrationNumber}</div>
                      <div className="text-sm text-white/65">
                        {entry.tramiteCode} · {entry.technicianName}
                      </div>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(entry.status)}`}>
                      {entry.status}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/75">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {entry.technicianArea}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Programación: {formatDate(entry.scheduleDate)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Registro: {formatDate(entry.registrationDate)}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-white/70">{entry.observations}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        removeEntry(entry.id);
                        setMessage(`El trámite ${entry.registrationNumber} fue eliminado.`);
                      }}
                      className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {message ? (
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
              {message}
            </div>
          ) : null}
        </article>
      </section>
    </AppShell>
  );
}
