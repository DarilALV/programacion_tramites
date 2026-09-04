"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { technicians, useTramitesStore } from "@/lib/tramites-store";
import { getServerNow } from "@/lib/server-time";

type FollowUpStatus = "esperando" | "en-revision" | "llamado" | "no-escucho" | "regreso" | "atendiendo" | "completado";

function minDiff(from: string, to?: string) {
  const [fh, fm] = from.split(":").map(Number);
  if (to) { const [th, tm] = to.split(":").map(Number); return (th * 60 + tm) - (fh * 60 + fm); }
  const n = new Date(); return (n.getHours() * 60 + n.getMinutes()) - (fh * 60 + fm);
}
function fmtMin(m: number) {
  if (m <= 0) return "< 1 min"; if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function weekRange(date: string) {
  const d = new Date(date + "T00:00:00");
  const day = d.getDay(); const diff = day === 0 ? 6 : day - 1;
  const mon = new Date(d); mon.setDate(d.getDate() - diff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
}
function monthRange(date: string) {
  const [y, m] = date.split("-");
  const last = new Date(Number(y), Number(m), 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(last).padStart(2, "0")}` };
}

function notifyBrowser(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}

const STATUS_LABEL: Record<FollowUpStatus, string> = {
  "esperando":    "⏳ Esperando",
  "en-revision":  "📋 En revisión",
  "llamado":      "📣 Llamado",
  "no-escucho":   "🔇 No escuchó",
  "regreso":      "↩️ Regresó",
  "atendiendo":   "👤 Atendiendo",
  "completado":   "✅ Completado",
};

export default function AgendaTecnicoPage() {
  const { entries, updateEntry, currentTechnicianId, loginTechnician, logoutTechnician } = useTramitesStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [reportePeriodo, setReportePeriodo] = useState<"dia" | "semana" | "mes">("dia");
  const [notifAllowed, setNotifAllowed] = useState(false);

  const currentTechnician = technicians.find((t) => t.id === currentTechnicianId);
  const today = new Date().toISOString().slice(0, 10);

  // Si no hay técnico logged in, mostrar login modal
  const showLoginModal = !currentTechnicianId;

  function handlePinDigit(digit: string) {
    if (pinInput.length >= 4) return;
    const next = pinInput + digit;
    setPinInput(next);
  }

  function handleLogin() {
    if (!selectedTechnicianId || pinInput.length !== 4) return;
    if (pinInput === "0000") { // PIN maestro para demo
      loginTechnician(selectedTechnicianId);
      setPinInput("");
      setSelectedTechnicianId("");
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  }

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const checkAndRequest = async () => {
      if (Notification.permission === "granted") { setNotifAllowed(true); return; }
      if (Notification.permission !== "denied") {
        const p = await Notification.requestPermission();
        setNotifAllowed(p === "granted");
      }
    };
    void checkAndRequest();
  }, []);

  // Track known follow-up IDs to detect new arrivals
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentTechnicianId) return;
    const techEntries = entries.filter((e) => {
      const isThisTech = e.technicianId === currentTechnicianId || e.followUp?.actualTechnicianId === currentTechnicianId;
      const isToday = e.scheduleDate === today || e.followUp?.createdAt?.startsWith(today);
      return isThisTech && isToday && e.followUp;
    });
    techEntries.forEach((e) => {
      const key = `${e.id}-arrived`;
      if (!knownIdsRef.current.has(key) && e.followUp?.arrivalTime) {
        if (knownIdsRef.current.size > 0) {
          notifyBrowser("🚶 Cliente llegó", `Trámite ${e.tramiteCode} — ${e.followUp.clientName ?? "sin nombre"} llegó a las ${e.followUp.arrivalTime}`);
        }
        knownIdsRef.current.add(key);
      }
      const keyReg = `${e.id}-regreso`;
      if (!knownIdsRef.current.has(keyReg) && e.followUp?.followUpStatus === "regreso") {
        if (knownIdsRef.current.size > 0) {
          notifyBrowser("↩️ Cliente regresó", `Trámite ${e.tramiteCode} — ${e.followUp.clientName ?? "sin nombre"} regresó`);
        }
        knownIdsRef.current.add(keyReg);
      }
    });
    if (knownIdsRef.current.size === 0) {
      techEntries.forEach((e) => {
        if (e.followUp?.arrivalTime) knownIdsRef.current.add(`${e.id}-arrived`);
        if (e.followUp?.followUpStatus === "regreso") knownIdsRef.current.add(`${e.id}-regreso`);
      });
    }
  }, [entries, currentTechnicianId, today]);

  const agendaHoy = useMemo(() => {
    if (!currentTechnicianId) return [];
    return entries
      .filter((e) => {
        const isThisDate = e.scheduleDate === selectedDate;
        const isThisTech = e.technicianId === currentTechnicianId;
        const isActualTech = e.followUp?.actualTechnicianId === currentTechnicianId && e.followUp?.createdAt?.startsWith(selectedDate);
        return (isThisDate && isThisTech) || isActualTech;
      })
      .sort((a, b) => {
        const ta = a.scheduledTime ?? a.followUp?.arrivalTime ?? "00:00";
        const tb = b.scheduledTime ?? b.followUp?.arrivalTime ?? "00:00";
        return ta.localeCompare(tb);
      });
  }, [entries, selectedDate, currentTechnicianId]);

  // Report data
  const reportEntries = useMemo(() => {
    if (!currentTechnicianId) return [];
    let from: string, to: string;
    if (reportePeriodo === "dia") { from = to = selectedDate; }
    else if (reportePeriodo === "semana") { const r = weekRange(selectedDate); from = r.from; to = r.to; }
    else { const r = monthRange(selectedDate); from = r.from; to = r.to; }

    return entries.filter((e) => {
      const isThisTech = e.technicianId === currentTechnicianId || e.followUp?.actualTechnicianId === currentTechnicianId;
      const d = e.scheduleDate ?? e.followUp?.createdAt?.slice(0, 10) ?? "";
      return isThisTech && d >= from && d <= to && e.followUp;
    });
  }, [entries, currentTechnicianId, selectedDate, reportePeriodo]);

  const reportStats = useMemo(() => {
    const completados = reportEntries.filter((e) => e.followUp?.completedTime);
    const waitTimes = completados
      .map((e) => e.followUp?.arrivalTime && e.followUp?.attendedTime ? minDiff(e.followUp.arrivalTime, e.followUp.attendedTime) : null)
      .filter((v): v is number => v !== null && v >= 0);
    const attnTimes = completados
      .map((e) => e.followUp?.attendedTime && e.followUp?.completedTime ? minDiff(e.followUp.attendedTime, e.followUp.completedTime) : null)
      .filter((v): v is number => v !== null && v >= 0);
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    return {
      total: reportEntries.length,
      completados: completados.length,
      noEscucho: reportEntries.filter((e) => e.followUp?.followUpStatus === "no-escucho").length,
      avgEspera: avg(waitTimes),
      avgAtencion: avg(attnTimes),
    };
  }, [reportEntries]);

  async function marcarRevisando(entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry?.followUp) return;
    updateEntry(entryId, { ...entry, followUp: { ...entry.followUp, followUpStatus: "en-revision" } });
  }

  async function marcarSaliALlamar(entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry?.followUp) return;
    const { time } = await getServerNow();
    updateEntry(entryId, { ...entry, followUp: { ...entry.followUp, followUpStatus: "llamado", calledTime: time } });
  }

  async function marcarLeAtendi(entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry?.followUp) return;
    const { time } = await getServerNow();
    updateEntry(entryId, {
      ...entry,
      followUp: {
        ...entry.followUp,
        followUpStatus: "completado",
        attendedTime: entry.followUp.calledTime ?? entry.followUp.returnedTime ?? time,
        completedTime: time,
      },
    });
  }

  async function marcarNoRespondio(entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry?.followUp) return;
    updateEntry(entryId, { ...entry, followUp: { ...entry.followUp, followUpStatus: "no-escucho" } });
  }

  async function marcarTermineDeAtender(entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry?.followUp) return;
    const { time } = await getServerNow();
    updateEntry(entryId, {
      ...entry,
      followUp: {
        ...entry.followUp,
        followUpStatus: "completado",
        attendedTime: entry.followUp.returnedTime ?? time,
        completedTime: time,
      },
    });
  }

  async function exportarReporte() {
    const XLSX = await import("xlsx");
    const rows = reportEntries.map((e) => {
      const fu = e.followUp!;
      const wait = fu.arrivalTime && fu.attendedTime ? minDiff(fu.arrivalTime, fu.attendedTime) : "";
      const attn = fu.attendedTime && fu.completedTime ? minDiff(fu.attendedTime, fu.completedTime) : "";
      return {
        Fecha: e.scheduleDate, Técnico: currentTechnician?.name ?? "",
        "Trámite": e.tramiteCode, "Registro": e.registrationNumber,
        "Sin programación": fu.isUnscheduled ? "Sí" : "No",
        "Cliente": fu.clientName ?? "", "Llegó": fu.arrivalTime ?? "",
        "Estado": fu.followUpStatus ?? "", "Llamado": fu.calledTime ?? "",
        "Regresó": fu.returnedTime ?? "", "Atendiendo": fu.attendedTime ?? "",
        "Completado": fu.completedTime ?? "",
        "Espera (min)": wait, "Atención (min)": attn,
        "Obs.": fu.observations ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `reporte-${currentTechnician?.name.replace(/\s/g, "_")}-${reportePeriodo}-${selectedDate}.xlsx`);
  }

  const arrivedNow = agendaHoy.filter((e) => {
    const st = e.followUp?.followUpStatus as FollowUpStatus | undefined;
    return st && ["esperando", "en-revision", "regreso"].includes(st);
  });

  if (showLoginModal) {
    return (
      <AppShell title="Mi Agenda de Atención" description="Acceso técnico" eyebrow="TÉCNICO">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm mx-4 space-y-6">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Ingreso</p>
              <h3 className="text-2xl font-bold mt-1">Técnico</h3>
              <p className="text-sm text-gray-500 mt-1">Selecciona tu nombre e ingresa tu PIN</p>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-700">Tu nombre</span>
              <select
                value={selectedTechnicianId}
                onChange={(e) => {
                  setSelectedTechnicianId(e.target.value);
                  setPinError(false);
                }}
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none bg-white font-semibold"
              >
                <option value="">— Selecciona tu nombre —</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            {selectedTechnicianId && (
              <>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-gray-700">PIN de 4 dígitos</span>
                  {/* Indicador de puntos */}
                  <div className="flex justify-center gap-4 mb-3">
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
                    <p className="text-center text-sm text-red-600 font-semibold animate-pulse mb-2">
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
                </label>

                <button
                  onClick={handleLogin}
                  disabled={pinInput.length !== 4}
                  className={`w-full px-4 py-3 rounded-lg font-bold text-white transition ${
                    pinInput.length === 4
                      ? "bg-pink-600 hover:bg-pink-700 cursor-pointer"
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
                >
                  🔓 Acceder
                </button>

                <p className="text-xs text-gray-400 text-center">PIN demo: 0000</p>
              </>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Mi Agenda de Atención" description="Ver trámites programados y gestionar el workflow de atención" eyebrow="TÉCNICO">
      <div className="space-y-6">

        {/* ── HEADER CON LOGOUT ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">Bienvenido, {currentTechnician?.name}</h2>
            <p className="text-sm text-gray-500">{currentTechnician?.areaLabel}</p>
          </div>
          <button
            onClick={() => logoutTechnician()}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg cursor-pointer"
          >
            🚪 Cerrar sesión
          </button>
        </div>

        {/* ── FILTROS ── */}
        <section className="rounded-4xl border-2 border-pink-200 bg-pink-50 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-lg font-bold text-gray-800">Mi Agenda</h3>
            {!notifAllowed && "Notification" in (typeof window !== "undefined" ? window : {}) && (
              <button onClick={() => Notification.requestPermission().then((p) => setNotifAllowed(p === "granted"))}
                className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-amber-200">
                🔔 Activar notificaciones
              </button>
            )}
            {notifAllowed && <span className="text-xs text-green-700 font-semibold">🔔 Notificaciones activas</span>}
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-700">Fecha</span>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none w-full md:w-48" />
          </label>
        </section>

        {/* ── ALERTA: CLIENTES QUE ESPERAN ── */}
        {arrivedNow.length > 0 && (
          <section className="rounded-4xl border-4 border-red-400 bg-gradient-to-r from-red-50 to-orange-50 p-6">
            <p className="text-sm font-semibold text-red-700 uppercase mb-3">⚠️ {arrivedNow.length} cliente{arrivedNow.length > 1 ? "s" : ""} esperando atención</p>
            <div className="space-y-2">
              {arrivedNow.map((e) => {
                const fu = e.followUp!;
                const st = (fu.followUpStatus ?? "esperando") as FollowUpStatus;
                return (
                  <div key={e.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-red-200 flex-wrap gap-2">
                    <div className="flex gap-4 text-sm">
                      <span className="font-mono font-bold">{e.tramiteCode}</span>
                      <span className="font-semibold">{fu.clientName ?? "—"}</span>
                      <span className="text-pink-700 font-bold">Llegó: {fu.arrivalTime}</span>
                      <span className="text-gray-500">{STATUS_LABEL[st]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── AGENDA ── */}
        <section className="rounded-4xl border-2 border-pink-200 overflow-hidden">
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-2xl font-bold">Agenda — {selectedDate}</h2>
            <div className="flex items-center gap-3 text-sm">
              <span>📋 {agendaHoy.length} trámites</span>
              <span>✅ {agendaHoy.filter((e) => e.followUp?.followUpStatus === "completado").length} completados</span>
            </div>
          </div>

          {agendaHoy.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500">No hay trámites para esta fecha.</div>
          ) : (
            <div className="divide-y-2 divide-pink-100">
              {agendaHoy.map((entry) => {
                const fu = entry.followUp;
                const st = (fu?.followUpStatus ?? (fu ? "esperando" : undefined)) as FollowUpStatus | undefined;

                const rowBg =
                  st === "completado"   ? "bg-green-50 border-green-400" :
                  st === "llamado"      ? "bg-purple-50 border-purple-400" :
                  st === "regreso"      ? "bg-yellow-50 border-yellow-400" :
                  st === "no-escucho"   ? "bg-orange-50 border-orange-300" :
                  st === "en-revision"  ? "bg-indigo-50 border-indigo-300" :
                  st === "esperando"    ? "bg-red-50 border-red-400" :
                  "bg-white border-gray-200";

                const esperaMinutos = fu?.arrivalTime ? minDiff(fu.arrivalTime, fu.completedTime) : null;
                const atencionMinutos = fu?.attendedTime && fu?.completedTime ? minDiff(fu.attendedTime, fu.completedTime) : null;
                const llamadoHaceMin = st === "llamado" && fu?.calledTime ? minDiff(fu.calledTime) : null;

                return (
                  <div key={entry.id} className={`p-5 border-l-4 ${rowBg}`}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">

                      {/* Trámite */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Trámite</p>
                        <p className="font-mono font-bold text-base">{entry.tramiteCode}</p>
                        <p className="text-xs text-gray-400">{entry.registrationNumber}</p>
                        {entry.scheduledTime && (
                          <p className="text-xs text-blue-700 mt-1">{entry.scheduledTime}{entry.scheduledEndTime ? ` – ${entry.scheduledEndTime}` : ""}</p>
                        )}
                        {fu?.isUnscheduled && <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded mt-1 inline-block">sin prog.</span>}
                      </div>

                      {/* Cliente + tiempos */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Cliente</p>
                        <p className="font-semibold">{fu?.clientName ?? "—"}</p>
                        {fu?.arrivalTime && <p className="text-xs text-pink-700 font-semibold mt-1">📍 Llegó: {fu.arrivalTime}</p>}
                        {fu?.calledTime && <p className="text-xs text-purple-700">📣 Salí: {fu.calledTime}</p>}
                        {fu?.returnedTime && <p className="text-xs text-yellow-700">↩️ Regresé: {fu.returnedTime}</p>}
                        {fu?.attendedTime && <p className="text-xs text-blue-700">👤 Atendido: {fu.attendedTime}</p>}
                        {fu?.completedTime && <p className="text-xs text-green-700 font-semibold">✅ Terminé: {fu.completedTime}</p>}
                      </div>

                      {/* Estado + métricas */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Estado</p>
                        <p className="font-bold">{st ? STATUS_LABEL[st] : "🕐 Sin llegada"}</p>
                        {llamadoHaceMin !== null && llamadoHaceMin >= 0 && (
                          <p className={`text-xs mt-1 font-semibold ${llamadoHaceMin > 10 ? "text-red-600" : "text-purple-700"}`}>
                            Salí hace {fmtMin(llamadoHaceMin)}
                          </p>
                        )}
                        {st === "completado" && esperaMinutos !== null && (
                          <div className="mt-1 space-y-0.5">
                            <p className="text-xs text-gray-500">Espera: <strong>{fmtMin(esperaMinutos)}</strong></p>
                            {atencionMinutos !== null && <p className="text-xs text-gray-500">Atención: <strong>{fmtMin(atencionMinutos)}</strong></p>}
                          </div>
                        )}
                      </div>

                      {/* ── ACCIONES ── */}
                      <div className="flex flex-col gap-2">
                        {!fu && (
                          <p className="text-xs text-gray-400 italic">Sin llegada registrada</p>
                        )}

                        {(st === "esperando" || st === "en-revision") && (
                          <>
                            {st === "esperando" && (
                              <button onClick={() => marcarRevisando(entry.id)}
                                className="px-3 py-2 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-lg hover:bg-indigo-200 cursor-pointer border border-indigo-300">
                                📋 Revisando
                              </button>
                            )}
                            <button onClick={() => marcarSaliALlamar(entry.id)}
                              className="px-3 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 cursor-pointer shadow">
                              🚶 Salgo a llamar
                            </button>
                          </>
                        )}

                        {st === "llamado" && (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500 font-semibold">Al regresar:</p>
                            <button onClick={() => marcarLeAtendi(entry.id)}
                              className="w-full px-3 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 cursor-pointer shadow">
                              ✅ Lo atendí
                            </button>
                            <button onClick={() => marcarNoRespondio(entry.id)}
                              className="w-full px-3 py-2 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 cursor-pointer shadow">
                              ↩️ No respondió
                            </button>
                          </div>
                        )}

                        {st === "no-escucho" && (
                          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                            <p className="text-xs text-orange-800 font-semibold">⏳ Esperando regreso</p>
                          </div>
                        )}

                        {st === "regreso" && (
                          <div className="space-y-2">
                            <div className="rounded-lg bg-yellow-50 border border-yellow-300 p-2">
                              <p className="text-xs text-yellow-800 font-semibold">↩️ Regresó</p>
                            </div>
                            <button onClick={() => marcarTermineDeAtender(entry.id)}
                              className="w-full px-3 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 cursor-pointer shadow">
                              ✅ Terminé
                            </button>
                          </div>
                        )}

                        {st === "completado" && (
                          <span className="text-sm text-green-700 font-bold">✓ Finalizado</span>
                        )}
                      </div>
                    </div>

                    {entry.observations && (
                      <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-100">📌 {entry.observations}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── REPORTES ── */}
        <section className="rounded-4xl border-2 border-pink-200 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-2xl font-bold">Mis Reportes</h2>
            <div className="flex gap-2 flex-wrap">
              {(["dia", "semana", "mes"] as const).map((p) => (
                <button key={p} onClick={() => setReportePeriodo(p)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold cursor-pointer transition ${reportePeriodo === p ? "bg-pink-600 text-white" : "bg-pink-100 text-pink-700 hover:bg-pink-200"}`}>
                  {p === "dia" ? "Hoy" : p === "semana" ? "Semana" : "Mes"}
                </button>
              ))}
              {reportEntries.length > 0 && (
                <button onClick={exportarReporte}
                  className="px-4 py-1.5 rounded-full text-sm font-semibold bg-green-600 text-white hover:bg-green-700 cursor-pointer transition">
                  📥 Excel
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total", value: reportStats.total, color: "blue" },
              { label: "Completados", value: reportStats.completados, color: "green" },
              { label: "No escucharon", value: reportStats.noEscucho, color: "orange" },
              { label: "Espera promedio", value: reportStats.avgEspera !== null ? fmtMin(reportStats.avgEspera) : "—", color: "purple" },
              { label: "Atención promedio", value: reportStats.avgAtencion !== null ? fmtMin(reportStats.avgAtencion) : "—", color: "pink" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl border-2 border-${color}-200 bg-${color}-50 p-4`}>
                <p className="text-xs text-gray-600 uppercase leading-tight">{label}</p>
                <p className={`text-2xl font-bold text-${color}-900 mt-1`}>{value}</p>
              </div>
            ))}
          </div>

          {reportEntries.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">Sin seguimientos en el periodo.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
