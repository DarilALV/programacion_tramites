"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { plannerUsers, useTramitesStore } from "@/lib/tramites-store";

export default function IngresoPage() {
  const { currentUserId, setCurrentUserId, currentUser, resetDemo } = useTramitesStore();
  const [message, setMessage] = useState("");

  return (
    <AppShell
      title="Ingreso de usuarias registradoras"
      description="Solo Wayra y Jaqueline registran programaciones. Desde aquí se elige la usuaria que está trabajando."
      eyebrow="Acceso"
    >
      <section className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="rounded-4xl border border-black/10 bg-[#fffaf1] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <h2 className="font-serif text-3xl text-[#1a140d]">Sesión activa</h2>
          <p className="mt-2 text-sm leading-6 text-black/70">
            Selecciona la usuaria que va a registrar trámites.
          </p>

          <div className="mt-6 grid gap-3">
            {plannerUsers.map((user) => {
              const active = user.id === currentUserId;

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setCurrentUserId(user.id);
                    localStorage.setItem('currentUserId', user.id);
                    setMessage(`Sesión cambiada a ${user.name}.`);
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 ${
                    active
                      ? "border-[#151515] bg-[#151515] text-white"
                      : "border-black/10 bg-white text-[#151515]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{user.name}</span>
                    <span className={`text-xs uppercase tracking-[0.2em] ${active ? "text-white/75" : "text-black/45"}`}>
                      Activa
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4 text-sm leading-6 text-black/70">
            <strong className="block text-black">Usuaria actual</strong>
            {currentUser.name}
          </div>

          <button
            type="button"
            onClick={() => {
              resetDemo();
              setMessage("La demo fue reiniciada.");
            }}
            className="mt-4 w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:-translate-y-0.5"
          >
            Reiniciar demo
          </button>
        </aside>

        <article className="rounded-4xl border border-black/10 bg-[#151515] p-6 text-white shadow-[0_16px_40px_rgba(17,17,17,0.16)]">
          <h2 className="font-serif text-3xl text-white">Flujo simplificado</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/75">
            <li>Wayra o Jaqueline ingresan y registran el trámite.</li>
            <li>El registro se guarda directamente, sin borrador.</li>
            <li>Se ve de inmediato en Mis trámites, Supervisión y Reportes.</li>
          </ul>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/70">
            {message || "Este acceso está orientado a las usuarias que programan."}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/tramites/nuevo"
              className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
            >
              Ir a registrar
            </Link>
            <Link
              href="/supervision"
              className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
            >
              Ir a supervisión
            </Link>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
