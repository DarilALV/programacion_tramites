"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { technicians, useTramitesStore, type Entry } from "@/lib/tramites-store";
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
  const { entries, updateEntry } = useTramitesStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(technicians[0].id);
  const [reportePeriodo, setReportePeriodo] = useState<"dia" | "semana" | "mes">("dia");
  const [notifAllowed, setNotifAllowed] = useState(false);

  const selectedTechnician = technicians.find((t) => t.id === selectedTechnicianId) ?? technicians[0];
  const today = new Date().toISOString().slice(0, 10);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") { setNotifAllowed(true); return; }
    if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => setNotifAllowed(p === "granted"));
    }
  }, []);

  // Track known follow-up IDs to detect new arrivals
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const techEntries = entries.filter((e) => {
      const isThisTech = e.technicianId === selectedTechnicianId || e.followUp?.actualTechnicianId === selectedTechnicianId;
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
    // seed on first load
    if (knownIdsRef.current.size === 0) {
      techEntries.forEach((e) => {
        if (e.followUp?.arrivalTime) knownIdsRef.current.add(`${e.id}-arrived`);
        if (e.followUp?.followUpStatus === "regreso") knownIdsRef.current.add(`${e.id}-regreso`);
      });
    }
  }, [entries, selectedTechnicianId, today]);

  const agendaHoy = useMemo(() => entries
    .filter((e) => {
      const isThisDate = e.scheduleDate === selectedDate;
      const isThisTech = e.technicianId === selectedTechnicianId;
      const isActualTech = e.followUp?.actualTechnicianId === selectedTechnicianId && e.followUp?.createdAt?.startsWith(selectedDate);
      return (isThisDate && isThisTech) || isActualTech;
    })
    .sort((a, b) => {
      const ta = a.scheduledTime ?? a.followUp?.arrivalTime ?? "00:00";
      const tb = b.scheduledTime ?? b.followUp?.arrivalTime ?? "00:00";
      return ta.localeCompare(tb);
    }),
    [entries, selectedDate, selectedTechnicianId]);

  // Report data — entries for selected tech across date range
  const reportEntries = useMemo(() => {
    let from: string, to: string;
    if (reportePeriodo === "dia") { from = to = selectedDate; }
    else if (reportePeriodo === "semana") { const r = weekRange(selectedDate); from = r.from; to = r.to; }
    else { const r = monthRange(selectedDate); from = r.from; to = r.to; }

    return entries.filter((e) => {
      const isThisTech = e.technicianId === selectedTechnicianId || e.followUp?.actualTechnicianId === selectedTechnicianId;
      const d = e.scheduleDate ?? e.followUp?.createdAt?.slice(0, 10) ?? "";
      return isThisTech && d >= from && d <= to && e.followUp;
    });
  }, [entries, selectedTechnicianId, selectedDate, reportePeriodo]);

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

  async function transition(entryId: string, newStatus: FollowUpStatus, timeField?: "calledTime" | "attendedTime" | "completedTime" | "returnedTime") {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry?.followUp) return;
    const { time } = await getServerNow();
    updateEntry(entryId, {
      ...entry,
      followUp: {
        ...entry.followUp,
        followUpStatus: newStatus,
        ...(timeField ? { [timeField]: time } : {}),
        ...(newStatus === "atendiendo" && !entry.followUp.attendedTime ? { attendedTime: time } : {}),
        ...(newStatus === "completado" && !entry.followUp.completedTime ? { completedTime: time } : {}),
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
        Fecha: e.scheduleDate, Técnico: selectedTechnician.name,
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
    XLSX.writeFile(wb, `reporte-${selectedTechnician.name.replace(/\s/g, "_")}-${reportePeriodo}-${selectedDate}.xlsx`);
  }

  const arrivedNow = agendaHoy.filter((e) => {
    const st = e.followUp?.followUpStatus as FollowUpStatus | undefined;
    return st && ["esperando", "en-revision", "regreso"].includes(st);
  });

  return (
    <AppShell title="Mi Agenda de Atención" description="Ver trámites programados y gestionar el workflow de atención" eyebrow="TÉCNICO">
      <div className="space-y-6">

        {/* ── FILTROS ── */}
        <section className="rounded-4xl border-2 border-pink-200 bg-pink-50 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-lg font-bold text-gray-800">Filtros</h3>
            {!notifAllowed && "Notification" in (typeof window !== "undefined" ? window : {}) && (
              <button onClick={() => Notification.requestPermission().then((p) => setNotifAllowed(p === "granted"))}
                className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-amber-200">
                🔔 Activar notificaciones de escritorio
              </button>
            )}
            {notifAllowed && <span className="text-xs text-green-700 font-semibold">🔔 Notificaciones activas</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-700">Técnico</span>
              <select value={selectedTechnicianId} onChange={(e) => setSelectedTechnicianId(e.target.value)}
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none bg-white font-semibold">
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>{tech.name} · {tech.areaLabel}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-700">Fecha</span>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none" />
            </label>
          </div>
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
            <h2 className="text-2xl font-bold">Agenda — {selectedTechnician.name}</h2>
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
                  st === "completado" ? "bg-green-50 border-green-400" :
                  st === "atendiendo" ? "bg-blue-50 border-blue-400" :
                  st === "regreso" ? "bg-yellow-50 border-yellow-400" :
                  st === "no-escucho" ? "bg-orange-50 border-orange-300" :
                  st === "llamado" ? "bg-purple-50 border-purple-300" :
                  st === "en-revision" ? "bg-indigo-50 border-indigo-300" :
                  st === "esperando" ? "bg-red-50 border-red-300" :
                  "bg-white border-gray-200";

                const waitMins = fu?.arrivalTime ? minDiff(fu.arrivalTime, fu.attendedTime) : null;
                const attnMins = fu?.attendedTime && fu?.completedTime ? minDiff(fu.attendedTime, fu.completedTime) : null;

                return (
                  <div key={entry.id} className={`p-5 border-l-4 ${rowBg}`}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {/* Trámite / horario */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Trámite</p>
                        <p className="font-mono font-bold text-base">{entry.tramiteCode}</p>
                        <p className="text-xs text-gray-400">{entry.registrationNumber}</p>
                        {entry.scheduledTime && <p className="text-xs text-blue-700 mt-0.5">{entry.scheduledTime}{entry.scheduledEndTime ? ` – ${entry.scheduledEndTime}` : ""}</p>}
                        {fu?.isUnscheduled && <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded">sin prog.</span>}
                      </div>
                      {/* Cliente */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Cliente</p>
                        <p className="font-semibold">{fu?.clientName ?? "—"}</p>
                        {fu?.arrivalTime && <p className="text-xs text-pink-700 font-semibold mt-1">Llegó: {fu.arrivalTime}</p>}
                        {fu?.calledTime && <p className="text-xs text-purple-700">Llamado: {fu.calledTime}</p>}
                        {fu?.returnedTime && <p className="text-xs text-yellow-700">Regresó: {fu.returnedTime}</p>}
                        {fu?.attendedTime && <p className="text-xs text-blue-700">Atendiendo: {fu.attendedTime}{waitMins !== null ? ` (espera: ${fmtMin(waitMins)})` : ""}</p>}
                        {fu?.completedTime && <p className="text-xs text-green-700">Completado: {fu.completedTime}{attnMins !== null ? ` (atención: ${fmtMin(attnMins)})` : ""}</p>}
                      </div>
                      {/* Estado */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Estado</p>
                        <p className="font-bold mt-1">{st ? STATUS_LABEL[st] : "🕐 Sin llegada"}</p>
                      </div>
                      {/* Acciones */}
                      <div className="flex flex-col gap-2">
                        {!fu && <p className="text-xs text-gray-400 italic">Esperando llegada en seguimientos</p>}
                        {st === "esperando" && (
                          <>
                            <button onClick={() => transition(entry.id, "en-revision")}
                              className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-bold rounded hover:bg-indigo-600 cursor-pointer">
                              📋 En Revisión
                            </button>
                            <button onClick={() => transition(entry.id, "llamado", "calledTime")}
                              className="px-3 py-1.5 bg-purple-500 text-white text-xs font-bold rounded hover:bg-purple-600 cursor-pointer">
                              📣 Llamar
                            </button>
                          </>
                        )}
                        {st === "en-revision" && (
                          <>
                            <button onClick={() => transition(entry.id, "llamado", "calledTime")}
                              className="px-3 py-1.5 bg-purple-500 text-white text-xs font-bold rounded hover:bg-purple-600 cursor-pointer">
                              📣 Llamar
                            </button>
                            <button onClick={() => transition(entry.id, "completado")}
                              className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 cursor-pointer">
                              ✅ Completado
                            </button>
                          </>
                        )}
                        {st === "llamado" && (
                          <>
                            <button onClick={() => transition(entry.id, "no-escucho")}
                              className="px-3 py-1.5 bg-orange-500 text-white text-xs font-bold rounded hover:bg-orange-600 cursor-pointer">
                              🔇 No escuchó
                            </button>
                            <button onClick={() => transition(entry.id, "atendiendo", "attendedTime")}
                              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 cursor-pointer">
                              👤 Atendiendo
                            </button>
                          </>
                        )}
                        {st === "no-escucho" && (
                          <p className="text-xs text-orange-700 font-semibold italic">Esperando que el cliente regrese…</p>
                        )}
                        {st === "regreso" && (
                          <button onClick={() => transition(entry.id, "atendiendo", "attendedTime")}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 cursor-pointer">
                            👤 Atendiendo
                          </button>
                        )}
                        {st === "atendiendo" && (
                          <button onClick={() => transition(entry.id, "completado")}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 cursor-pointer">
                            ✅ Completado
                          </button>
                        )}
                        {st === "completado" && <span className="text-xs text-green-700 font-bold">✓ Listo</span>}
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
            <h2 className="text-2xl font-bold">Reportes</h2>
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

          {reportePeriodo !== "dia" && (
            <p className="text-xs text-gray-500">
              {reportePeriodo === "semana" ? (() => { const r = weekRange(selectedDate); return `Semana: ${r.from} — ${r.to}`; })() : (() => { const r = monthRange(selectedDate); return `Mes: ${r.from} — ${r.to}`; })()}
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total seguimientos", value: reportStats.total, color: "blue" },
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
            <p className="text-gray-500 text-sm text-center py-4">Sin seguimientos en el periodo seleccionado.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
