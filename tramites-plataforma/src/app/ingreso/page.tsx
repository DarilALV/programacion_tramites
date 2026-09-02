"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { plannerUsers, useTramitesStore, type PlannerUser } from "@/lib/tramites-store";

export default function IngresoPage() {
  const { currentUserId, setCurrentUserId, currentUser, resetDemo } = useTramitesStore();

  // PIN modal
  const [pinTarget, setPinTarget] = useState<PlannerUser | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  // Reset demo protection
  const [resetPhase, setResetPhase] = useState<"idle" | "confirm">("idle");
  const [resetInput, setResetInput] = useState("");

  const [statusMsg, setStatusMsg] = useState("");

  function handleUserClick(user: PlannerUser) {
    if (user.id === currentUserId) return;
    setPinTarget(user);
    setPinInput("");
    setPinError(false);
  }

  function handlePinDigit(digit: string) {
    if (pinInput.length >= 4) return;
    const next = pinInput + digit;
    setPinInput(next);
    if (next.length === 4) {
      setTimeout(() => verifyPin(next), 80);
    }
  }

  function verifyPin(pin: string) {
    if (!pinTarget) return;
    if (pin === pinTarget.pin) {
      setCurrentUserId(pinTarget.id);
      localStorage.setItem("currentUserId", pinTarget.id);
      setStatusMsg(`Sesión cambiada a ${pinTarget.name}.`);
      setPinTarget(null);
      setPinInput("");
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  }

  function handleResetConfirm() {
    if (resetInput.trim().toUpperCase() !== "REINICIAR") return;
    resetDemo();
    setResetPhase("idle");
    setResetInput("");
    setStatusMsg("La demo fue reiniciada.");
  }

  return (
    <AppShell
      title="Ingreso de usuarias registradoras"
      description="Wayra, Jaqueline y Tunari registran programaciones y seguimientos. Selecciona tu nombre e ingresa tu PIN."
      eyebrow="Acceso"
    >
      <section className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="rounded-4xl border border-black/10 bg-[#fffaf1] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <h2 className="font-serif text-3xl text-[#1a140d]">Sesión activa</h2>
          <p className="mt-2 text-sm leading-6 text-black/70">
            Selecciona tu nombre e ingresa tu PIN de 4 dígitos.
          </p>

          <div className="mt-6 grid gap-3">
            {plannerUsers.map((user) => {
              const active = user.id === currentUserId;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleUserClick(user)}
                  className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 cursor-pointer ${
                    active
                      ? "border-[#151515] bg-[#151515] text-white"
                      : "border-black/10 bg-white text-[#151515] hover:border-pink-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{user.name}</span>
                    <span className={`text-xs uppercase tracking-[0.2em] ${active ? "text-white/75" : "text-black/45"}`}>
                      {active ? "✓ Activa" : "Ingresar"}
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

          {/* Reset demo — protegido con texto de confirmación */}
          {resetPhase === "idle" ? (
            <button
              type="button"
              onClick={() => setResetPhase("confirm")}
              className="mt-4 w-full rounded-full border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:-translate-y-0.5 cursor-pointer"
            >
              Reiniciar demo
            </button>
          ) : (
            <div className="mt-4 rounded-2xl border-2 border-red-300 bg-red-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-800">
                ⚠️ Esto borra todos los registros. Escribe <strong>REINICIAR</strong> para confirmar:
              </p>
              <input
                type="text" value={resetInput}
                onChange={(e) => setResetInput(e.target.value)}
                placeholder="REINICIAR"
                autoFocus
                className="w-full rounded-lg border-2 border-red-300 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-red-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleResetConfirm}
                  disabled={resetInput.trim().toUpperCase() !== "REINICIAR"}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white transition ${
                    resetInput.trim().toUpperCase() === "REINICIAR"
                      ? "bg-red-600 hover:bg-red-700 cursor-pointer"
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
                >
                  Confirmar
                </button>
                <button
                  onClick={() => { setResetPhase("idle"); setResetInput(""); }}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </aside>

        <article className="rounded-4xl border border-black/10 bg-[#151515] p-6 text-white shadow-[0_16px_40px_rgba(17,17,17,0.16)]">
          <h2 className="font-serif text-3xl text-white">Flujo simplificado</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/75">
            <li>Wayra, Jaqueline o Tunari ingresan con su PIN y registran el trámite.</li>
            <li>El registro se guarda directamente en Firebase, sin borrador.</li>
            <li>Se ve de inmediato en Mis trámites, Supervisión y Reportes.</li>
            <li>Los técnicos acceden a <strong className="text-white">Agenda Técnico</strong> para gestionar las atenciones del día.</li>
          </ul>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60 space-y-1">
            <p className="font-semibold text-white/80">PINs por defecto</p>
            <p>WAYRA → <span className="font-mono tracking-widest">1111</span></p>
            <p>JAQUELINE → <span className="font-mono tracking-widest">2222</span></p>
            <p>TUNARI → <span className="font-mono tracking-widest">3333</span></p>
            <p className="text-xs text-white/40 mt-2">Para cambiar los PINs: editar <code>plannerUsers</code> en <code>tramites-store.ts</code></p>
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/70 min-h-[48px]">
            {statusMsg || "Selecciona una usuaria para comenzar."}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/tramites/nuevo" className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition">
              Ir a registrar
            </Link>
            <Link href="/supervision" className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition">
              Ir a supervisión
            </Link>
          </div>
        </article>
      </section>

      {/* ── MODAL PIN ── */}
      {pinTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm mx-4 space-y-6">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Ingreso</p>
              <h3 className="text-2xl font-bold mt-1">{pinTarget.name}</h3>
              <p className="text-sm text-gray-500 mt-1">Ingresa tu PIN de 4 dígitos</p>
            </div>

            {/* Indicador de puntos */}
            <div className="flex justify-center gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-5 h-5 rounded-full transition-all duration-150 ${
                    pinInput.length > i
                      ? pinError ? "bg-red-500 scale-110" : "bg-pink-600 scale-110"
                      : "bg-gray-200"
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-center text-sm text-red-600 font-semibold animate-pulse">
                PIN incorrecto — inténtalo de nuevo
              </p>
            )}

            {/* Teclado numérico */}
            <div className="grid grid-cols-3 gap-3">
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={!d}
                  onClick={() => {
                    if (d === "⌫") { setPinInput((p) => p.slice(0, -1)); setPinError(false); }
                    else if (d) handlePinDigit(d);
                  }}
                  className={`h-14 rounded-xl text-xl font-bold transition select-none ${
                    !d ? "pointer-events-none" :
                    d === "⌫"
                      ? "bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer"
                      : "bg-pink-50 hover:bg-pink-100 active:bg-pink-200 text-pink-900 cursor-pointer"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <button
              onClick={() => { setPinTarget(null); setPinInput(""); setPinError(false); }}
              className="w-full text-sm text-gray-400 hover:text-gray-600 cursor-pointer py-1 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
