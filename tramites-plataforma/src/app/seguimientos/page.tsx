"use client";

import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useTramitesStore, type Entry } from "@/lib/tramites-store";
import { getServerNow } from "@/lib/server-time";
import { Search } from "lucide-react";

const LIMITE = 15;

function minutesDiff(from: string, to?: string) {
  const [fh, fm] = from.split(":").map(Number);
  if (to) { const [th, tm] = to.split(":").map(Number); return (th * 60 + tm) - (fh * 60 + fm); }
  const n = new Date(); return (n.getHours() * 60 + n.getMinutes()) - (fh * 60 + fm);
}
function fmtMin(m: number) {
  if (m < 0) return "—"; if (m === 0) return "< 1 min";
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function techColor(count: number): { dot: string; bar: string; label: string } {
  if (count >= LIMITE) return { dot: "🔴", bar: "bg-red-500", label: `⛔ Lleno (${count}/${LIMITE})` };
  if (count >= 12)     return { dot: "🔴", bar: "bg-red-400", label: `${count}/${LIMITE}` };
  if (count >= 7)      return { dot: "🟠", bar: "bg-amber-400", label: `${count}/${LIMITE}` };
  if (count > 0)       return { dot: "🟢", bar: "bg-green-500", label: `${count}/${LIMITE}` };
  return { dot: "⚪", bar: "bg-gray-300", label: `0/${LIMITE}` };
}

type EditState = { clientName: string; technicianId: string; observations: string };

export default function SeguimientosPage() {
  const [tramiteCode, setTramiteCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [observations, setObservations] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [programadosExpanded, setProgramadosExpanded] = useState(false);
  const [searchFollowUps, setSearchFollowUps] = useState("");
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ clientName: "", technicianId: "", observations: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { entries, updateEntry, createEntry, removeEntry, technicians, currentUser, getNextRegistrationNumber } =
    useTramitesStore();

  const today = new Date().toISOString().slice(0, 10);

  const foundEntry = useMemo(() => {
    if (!tramiteCode.trim()) return null;
    return entries.find((e) => e.tramiteCode === tramiteCode.trim()) ?? null;
  }, [tramiteCode, entries]);

  useEffect(() => {
    if (foundEntry) setSelectedTechnicianId(foundEntry.technicianId);
  }, [foundEntry?.id]);

  const effectiveTechnician = technicians.find((t) => t.id === selectedTechnicianId);

  const todayFollowUps = useMemo(() => entries
    .filter((e) => e.followUp?.createdAt?.startsWith(today) || (e.scheduleDate === today && e.followUp))
    .sort((a, b) => (b.followUp?.arrivalTime ?? "").localeCompare(a.followUp?.arrivalTime ?? "")),
    [entries, today]);

  const filteredFollowUps = useMemo(() => {
    if (!searchFollowUps.trim()) return todayFollowUps;
    const q = searchFollowUps.toLowerCase();
    return todayFollowUps.filter((e) =>
      e.tramiteCode.includes(q) ||
      (e.followUp?.clientName ?? "").toLowerCase().includes(q) ||
      e.technicianName.toLowerCase().includes(q)
    );
  }, [todayFollowUps, searchFollowUps]);

  const techCountToday = useMemo(() => {
    const c: Record<string, number> = {};
    todayFollowUps.forEach((e) => {
      const tid = e.followUp?.actualTechnicianId ?? e.technicianId;
      c[tid] = (c[tid] ?? 0) + 1;
    });
    return c;
  }, [todayFollowUps]);

  const programadosHoy = useMemo(() => {
    const m: Record<string, { name: string; area: string; entries: Entry[] }> = {};
    entries.filter((e) => e.scheduleDate === today).forEach((e) => {
      if (!m[e.technicianId]) m[e.technicianId] = { name: e.technicianName, area: e.technicianArea, entries: [] };
      m[e.technicianId].entries.push(e);
    });
    return m;
  }, [entries, today]);

  const technicianLoad = useMemo(() => {
    const load: Record<string, { name: string; programados: number; llegadas: number; atendidos: number; completados: number }> = {};
    entries.filter((e) => e.scheduleDate === today).forEach((e) => {
      if (!load[e.technicianId]) load[e.technicianId] = { name: e.technicianName, programados: 0, llegadas: 0, atendidos: 0, completados: 0 };
      load[e.technicianId].programados++;
    });
    todayFollowUps.forEach((e) => {
      const tid = e.followUp?.actualTechnicianId ?? e.technicianId;
      const tn = e.followUp?.actualTechnicianName ?? e.technicianName;
      if (!load[tid]) load[tid] = { name: tn, programados: 0, llegadas: 0, atendidos: 0, completados: 0 };
      load[tid].llegadas++;
      if (e.followUp?.attendedTime) load[tid].atendidos++;
      if (e.followUp?.completedTime) load[tid].completados++;
    });
    return load;
  }, [entries, todayFollowUps, today]);

  function showMsg(text: string, type: "success" | "error" = "success") {
    setMessage(text); setMessageType(type); setTimeout(() => setMessage(""), 4000);
  }

  // Validación código trámite
  function validateCode(code: string): string | null {
    if (!code.trim()) return "Ingresa el número de trámite";
    if (!/^\d+$/.test(code)) return "Solo se permiten números";
    if (code.length < 6 || code.length > 10) return "Debe tener entre 6 y 10 dígitos";
    if (!code.startsWith("2")) return "Debe empezar con el año (ej: 2026...)";
    return null;
  }

  async function handleRegisterArrival() {
    const codeErr = validateCode(tramiteCode);
    if (codeErr) return showMsg(`⚠️ ${codeErr}`, "error");
    if (!clientName.trim()) return showMsg("⚠️ Ingresa el nombre de la persona", "error");
    if (!selectedTechnicianId) return showMsg("⚠️ Selecciona el técnico", "error");

    const count = techCountToday[selectedTechnicianId] ?? 0;
    if (count >= LIMITE) return showMsg(`⛔ ${effectiveTechnician?.name} ya alcanzó el límite de ${LIMITE} seguimientos hoy`, "error");

    const { time: arrival, iso } = await getServerNow();

    if (foundEntry) {
      const techChanged = selectedTechnicianId !== foundEntry.technicianId;
      updateEntry(foundEntry.id, {
        ...foundEntry,
        followUp: {
          clientName: clientName.trim(),
          arrivalTime: arrival,
          followUpStatus: "esperando",
          actualTechnicianId: techChanged ? selectedTechnicianId : undefined,
          actualTechnicianName: techChanged ? effectiveTechnician?.name : undefined,
          observations: observations.trim() || undefined,
          createdAt: iso,
        },
      });
    } else {
      const newEntry: Entry = {
        id: `unsched-${Date.now()}`,
        createdBy: currentUser.id, createdByName: currentUser.name,
        registrationNumber: getNextRegistrationNumber(),
        tramiteCode: tramiteCode.trim(),
        technicianId: selectedTechnicianId,
        technicianName: effectiveTechnician?.name ?? selectedTechnicianId,
        technicianArea: effectiveTechnician?.areaLabel ?? "",
        scheduleDate: today, registrationDate: today,
        observations: "", status: "Registrado", createdAt: iso,
        followUp: { clientName: clientName.trim(), arrivalTime: arrival, followUpStatus: "esperando", observations: observations.trim() || undefined, createdAt: iso, isUnscheduled: true },
      };
      createEntry(newEntry);
    }
    showMsg(`✅ Llegada registrada a las ${arrival} — ${effectiveTechnician?.name}`, "success");
    setTramiteCode(""); setClientName(""); setSelectedTechnicianId(""); setObservations("");
  }

  async function handleMarkRegreso(entry: Entry) {
    const { time, iso } = await getServerNow();
    updateEntry(entry.id, {
      ...entry,
      followUp: { ...entry.followUp, followUpStatus: "regreso", returnedTime: time, createdAt: entry.followUp?.createdAt ?? iso },
    });
    showMsg(`↩️ Cliente regresó registrado a las ${time}`, "success");
  }

  function handleStartEdit(entry: Entry) {
    setEditingFollowUpId(entry.id);
    setEditState({
      clientName: entry.followUp?.clientName ?? "",
      technicianId: entry.followUp?.actualTechnicianId ?? entry.technicianId,
      observations: entry.followUp?.observations ?? "",
    });
    setConfirmDeleteId(null);
  }

  function handleSaveEdit(entry: Entry) {
    const tech = technicians.find((t) => t.id === editState.technicianId);
    const techChanged = editState.technicianId !== entry.technicianId;
    updateEntry(entry.id, {
      ...entry,
      followUp: {
        ...entry.followUp,
        clientName: editState.clientName.trim(),
        actualTechnicianId: techChanged ? editState.technicianId : undefined,
        actualTechnicianName: techChanged ? tech?.name : undefined,
        observations: editState.observations.trim() || undefined,
      },
    });
    setEditingFollowUpId(null);
    showMsg("✓ Seguimiento actualizado");
  }

  function handleDeleteFollowUp(entry: Entry) {
    if (entry.followUp?.isUnscheduled) {
      removeEntry(entry.id);
    } else {
      const { followUp: _f, ...rest } = entry;
      updateEntry(entry.id, rest as Entry);
    }
    setConfirmDeleteId(null);
    showMsg(`Seguimiento de ${entry.tramiteCode} eliminado`);
  }

  async function exportarReporte() {
    const XLSX = await import("xlsx");
    const rows = todayFollowUps.map((e) => {
      const fu = e.followUp!;
      const tech = fu.actualTechnicianName ?? e.technicianName;
      const wait = fu.arrivalTime && fu.attendedTime ? minutesDiff(fu.arrivalTime, fu.attendedTime) : "";
      const attn = fu.attendedTime && fu.completedTime ? minutesDiff(fu.attendedTime, fu.completedTime) : "";
      return {
        Fecha: today, "Trámite": e.tramiteCode, "Registro": e.registrationNumber,
        "Cliente": fu.clientName ?? "", "Técnico": tech, "Área": e.technicianArea,
        "Sin programación": fu.isUnscheduled ? "Sí" : "No",
        "Llegada": fu.arrivalTime ?? "", "Estado": fu.followUpStatus ?? "",
        "Hora llamado": fu.calledTime ?? "", "Regresó": fu.returnedTime ?? "",
        "Atendido": fu.attendedTime ?? "", "Completado": fu.completedTime ?? "",
        "Espera (min)": wait, "Atención (min)": attn,
        "Obs.": fu.observations ?? "", "Por": e.createdByName,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Seguimientos");
    XLSX.writeFile(wb, `seguimientos-${today}.xlsx`);
  }

  const canSubmit = tramiteCode.trim() && clientName.trim() && selectedTechnicianId;
  const selCount = techCountToday[selectedTechnicianId] ?? 0;
  const selOverLimit = selCount >= LIMITE;
  const selColors = selectedTechnicianId ? techColor(selCount) : null;
  const codeValidationError = tramiteCode.trim() ? validateCode(tramiteCode) : null;

  return (
    <AppShell title="Seguimientos del Día" description="Registra llegadas de clientes y gestiona el estado de cada trámite" eyebrow="SEGUIMIENTOS">
      <div className="space-y-6">

        {/* ── FORMULARIO REGISTRO LLEGADA ── */}
        <section className="rounded-4xl border-2 border-pink-200 bg-pink-50 p-6 space-y-4">
          <h2 className="text-2xl font-bold">Registrar Llegada</h2>

          {message && (
            <div className={`p-4 rounded-lg text-sm font-medium ${messageType === "success" ? "bg-green-100 text-green-800 border border-green-300" : "bg-red-100 text-red-800 border border-red-300"}`}>
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Código trámite */}
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">Número de Trámite *</span>
              <input
                type="text" value={tramiteCode} autoFocus
                onChange={(e) => setTramiteCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onKeyDown={(e) => e.key === "Enter" && handleRegisterArrival()}
                inputMode="numeric" placeholder="Ej: 2026016618"
                className={`rounded-lg border-2 px-4 py-3 text-lg font-semibold focus:outline-none ${codeValidationError ? "border-red-400 bg-red-50" : "border-pink-300 bg-white focus:border-pink-500"}`}
              />
              {codeValidationError && <p className="text-xs text-red-600 font-medium">⚠️ {codeValidationError}</p>}
            </label>

            {/* Trámite encontrado */}
            {tramiteCode.trim() && !codeValidationError && foundEntry && (
              <div className="md:col-span-2 rounded-lg bg-blue-50 border-2 border-blue-200 p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase">✓ Trámite encontrado</p>
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  <div><p className="text-xs text-gray-500">Registro</p><p className="font-bold">{foundEntry.registrationNumber}</p></div>
                  <div><p className="text-xs text-gray-500">Fecha programada</p><p className="font-bold">{foundEntry.scheduleDate}</p></div>
                  <div><p className="text-xs text-gray-500">Técnico asignado</p><p className="font-bold text-blue-900">{foundEntry.technicianName}</p></div>
                  {foundEntry.followUp && <div><p className="text-xs text-orange-600 font-semibold">⚠️ Ya tiene seguimiento</p></div>}
                </div>
              </div>
            )}
            {tramiteCode.trim() && !codeValidationError && !foundEntry && (
              <div className="md:col-span-2 rounded-lg bg-amber-50 border-2 border-amber-200 p-3">
                <p className="text-sm font-semibold text-amber-800">⚠️ Trámite no encontrado — selecciona técnico manualmente</p>
              </div>
            )}

            {/* Nombre */}
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">Nombre de Quién Viene *</span>
              <input type="text" value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRegisterArrival()}
                placeholder="Ej: Juan Pérez"
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none"
              />
            </label>

            {/* Selector técnico con colores */}
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">
                Técnico que Atenderá *
                {foundEntry && <span className="text-xs font-normal text-gray-500 ml-2">(puedes cambiar)</span>}
              </span>
              <select value={selectedTechnicianId} onChange={(e) => setSelectedTechnicianId(e.target.value)}
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none bg-white">
                <option value="">— Selecciona técnico —</option>
                {technicians.map((t) => {
                  const cnt = techCountToday[t.id] ?? 0;
                  const { dot } = techColor(cnt);
                  const full = cnt >= LIMITE;
                  return (
                    <option key={t.id} value={t.id} disabled={full}>
                      {dot} {t.name} — {t.areaLabel}{cnt > 0 ? ` (${cnt}/${LIMITE})` : ""}
                    </option>
                  );
                })}
              </select>

              {/* Barra de capacidad del técnico seleccionado */}
              {selColors && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">{effectiveTechnician?.name}: <strong>{selCount}</strong> de {LIMITE} seguimientos hoy</span>
                    <span className={`font-semibold ${selOverLimit ? "text-red-600" : selCount >= 12 ? "text-red-500" : selCount >= 7 ? "text-amber-600" : "text-green-700"}`}>
                      {selColors.label}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className={`h-3 rounded-full transition-all ${selColors.bar}`}
                      style={{ width: `${Math.min((selCount / LIMITE) * 100, 100)}%` }} />
                  </div>
                  {selOverLimit && <p className="text-xs text-red-600 font-semibold">⛔ Este técnico ya no puede recibir más seguimientos hoy</p>}
                </div>
              )}
            </label>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">Observaciones (opcional)</span>
              <textarea value={observations} onChange={(e) => setObservations(e.target.value)}
                placeholder="Ej: cliente pidió urgencia, documento incompleto…" rows={2}
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none" />
            </label>
          </div>

          <button onClick={handleRegisterArrival} disabled={!canSubmit || selOverLimit || !!codeValidationError}
            className={`w-full rounded-lg px-6 py-3 font-semibold text-white text-lg transition shadow-md ${canSubmit && !selOverLimit && !codeValidationError ? "bg-pink-600 hover:bg-pink-700 cursor-pointer" : "bg-gray-400 cursor-not-allowed"}`}>
            ✅ Registrar Llegada — Hora Automática del Servidor
          </button>
        </section>

        {/* ── PROGRAMADOS DE HOY ── */}
        <section className="rounded-4xl border-2 border-purple-200 overflow-hidden">
          <button onClick={() => setProgramadosExpanded(!programadosExpanded)}
            className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white cursor-pointer">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">Programaciones de Hoy</h2>
              <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">
                {Object.values(programadosHoy).reduce((s, v) => s + v.entries.length, 0)} trámites
              </span>
            </div>
            <span className="text-sm">{programadosExpanded ? "▲ Ocultar" : "▼ Ver lista"}</span>
          </button>
          {programadosExpanded && (
            <div className="p-6 space-y-4">
              {Object.keys(programadosHoy).length === 0 ? (
                <p className="text-gray-500">No hay programaciones para hoy.</p>
              ) : (
                Object.entries(programadosHoy).map(([tid, data]) => {
                  const cnt = techCountToday[tid] ?? 0;
                  const { dot, bar } = techColor(cnt);
                  return (
                    <div key={tid} className="rounded-xl border-2 border-purple-100 bg-purple-50 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-purple-900">{data.name}</p>
                          <p className="text-xs text-purple-600">{data.area}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">{data.entries.length} programados</p>
                          <div className="flex items-center gap-1 text-xs mt-1">
                            <span>{dot}</span>
                            <span>{cnt} seguimientos</span>
                            <div className="w-16 bg-gray-200 rounded-full h-1.5 ml-1">
                              <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${Math.min((cnt / LIMITE) * 100, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-1">
                        {data.entries.sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? "")).map((e) => (
                          <div key={e.id} className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-lg ${e.followUp ? "bg-green-100 text-green-800" : "bg-white text-gray-700 border border-gray-200"}`}>
                            <span className="font-mono font-semibold">{e.tramiteCode}</span>
                            <span>{e.scheduledTime ?? "--:--"}</span>
                            <span>{e.followUp ? `✓ ${e.followUp.clientName ?? "llegó"}` : "⏳ pendiente"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>

        {/* ── SEGUIMIENTOS DE HOY ── */}
        <section className="rounded-4xl border-2 border-pink-200 overflow-hidden">
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-2xl font-bold">
              Seguimientos de Hoy
              <span className="text-sm font-normal ml-2">({todayFollowUps.length})</span>
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm">🟢 {todayFollowUps.filter((e) => !e.followUp?.attendedTime).length} en espera</span>
              <span className="text-sm">✅ {todayFollowUps.filter((e) => e.followUp?.completedTime).length} completados</span>
              {todayFollowUps.length > 0 && (
                <button onClick={exportarReporte} className="bg-white text-pink-700 font-semibold text-sm px-4 py-1.5 rounded-lg hover:bg-pink-50 transition cursor-pointer">
                  📥 Exportar Excel
                </button>
              )}
            </div>
          </div>

          {/* Buscador en la lista */}
          <div className="px-6 py-3 border-b border-pink-100 bg-pink-50">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-3 text-gray-400" />
              <input type="text" value={searchFollowUps} onChange={(e) => setSearchFollowUps(e.target.value)}
                placeholder="Buscar por trámite, nombre o técnico…"
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-pink-200 bg-white text-sm focus:outline-none focus:border-pink-400"
              />
            </div>
          </div>

          {filteredFollowUps.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              {searchFollowUps ? "Sin resultados para esa búsqueda." : "Aún no hay seguimientos registrados hoy."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-pink-100 border-b-2 border-pink-200">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold">Trámite</th>
                    <th className="px-3 py-3 text-left font-semibold">Cliente</th>
                    <th className="px-3 py-3 text-left font-semibold">Técnico</th>
                    <th className="px-3 py-3 text-left font-semibold">Llegó</th>
                    <th className="px-3 py-3 text-left font-semibold">Estado</th>
                    <th className="px-3 py-3 text-left font-semibold">Espera</th>
                    <th className="px-3 py-3 text-left font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFollowUps.map((entry, idx) => {
                    const fu = entry.followUp!;
                    const tech = fu.actualTechnicianName ?? entry.technicianName;
                    const wait = fu.arrivalTime ? minutesDiff(fu.arrivalTime, fu.attendedTime) : null;
                    const st = fu.followUpStatus ?? "esperando";

                    const rowBg =
                      st === "completado" ? "bg-green-50" :
                      st === "atendiendo" ? "bg-blue-50" :
                      st === "regreso" ? "bg-yellow-50" :
                      st === "no-escucho" ? "bg-orange-50" :
                      st === "llamado" ? "bg-purple-50" :
                      idx % 2 === 0 ? "bg-pink-50" : "bg-white";

                    const statusLabel: Record<string, string> = {
                      "esperando": "⏳ Esperando",
                      "en-revision": "📋 En revisión",
                      "llamado": "📣 Llamado",
                      "no-escucho": "🔇 No escuchó",
                      "regreso": "↩️ Regresó",
                      "atendiendo": "👤 Atendiendo",
                      "completado": "✅ Completado",
                    };

                    if (editingFollowUpId === entry.id) {
                      return (
                        <tr key={entry.id} className="bg-blue-50 border-b border-blue-200">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <label className="grid gap-1">
                                <span className="text-xs text-gray-600">Nombre cliente</span>
                                <input value={editState.clientName}
                                  onChange={(e) => setEditState({ ...editState, clientName: e.target.value })}
                                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                              </label>
                              <label className="grid gap-1">
                                <span className="text-xs text-gray-600">Técnico</span>
                                <select value={editState.technicianId}
                                  onChange={(e) => setEditState({ ...editState, technicianId: e.target.value })}
                                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white">
                                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                              </label>
                              <label className="grid gap-1">
                                <span className="text-xs text-gray-600">Observaciones</span>
                                <input value={editState.observations}
                                  onChange={(e) => setEditState({ ...editState, observations: e.target.value })}
                                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                              </label>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => handleSaveEdit(entry)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-green-700">✓ Guardar</button>
                              <button onClick={() => setEditingFollowUpId(null)} className="px-3 py-1.5 bg-gray-400 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-gray-500">Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={entry.id} className={`${rowBg} border-b border-gray-100`}>
                        <td className="px-3 py-3">
                          <p className="font-mono font-semibold">{entry.tramiteCode}</p>
                          <p className="text-xs text-gray-400">{entry.registrationNumber}</p>
                          {fu.isUnscheduled && <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded">sin prog.</span>}
                        </td>
                        <td className="px-3 py-3">{fu.clientName}</td>
                        <td className="px-3 py-3 font-semibold text-sm">{tech}</td>
                        <td className="px-3 py-3 font-semibold text-pink-700">{fu.arrivalTime ?? "—"}</td>
                        <td className="px-3 py-3">
                          <span className="text-xs font-semibold">{statusLabel[st] ?? st}</span>
                          {fu.calledTime && <p className="text-xs text-gray-400">Llamado: {fu.calledTime}</p>}
                          {fu.returnedTime && <p className="text-xs text-yellow-700">Regresó: {fu.returnedTime}</p>}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {wait !== null && <span className={wait > 30 ? "text-red-600 font-semibold" : "text-gray-600"}>{fmtMin(wait)}</span>}
                        </td>
                        <td className="px-3 py-3">
                          {confirmDeleteId === entry.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleDeleteFollowUp(entry)} className="px-2 py-1 bg-red-600 text-white rounded text-xs cursor-pointer">Sí</button>
                              <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-gray-400 text-white rounded text-xs cursor-pointer">No</button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {/* "Cliente regresó" solo si fue llamado y no escuchó */}
                              {st === "no-escucho" && (
                                <button onClick={() => handleMarkRegreso(entry)} className="text-xs px-2 py-1 rounded bg-yellow-500 text-white hover:bg-yellow-600 cursor-pointer whitespace-nowrap">
                                  ↩️ Regresó
                                </button>
                              )}
                              <button onClick={() => handleStartEdit(entry)} className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 cursor-pointer">✏️ Editar</button>
                              <button onClick={() => setConfirmDeleteId(entry.id)} className="text-xs px-2 py-1 rounded bg-gray-300 text-gray-700 hover:bg-red-100 cursor-pointer">🗑️</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── RESUMEN POR TÉCNICO ── */}
        <section className="rounded-4xl border-2 border-pink-200 p-6">
          <h2 className="text-2xl font-bold mb-4">Técnicos — Resumen del Día</h2>
          {Object.keys(technicianLoad).length === 0 ? (
            <p className="text-gray-500">Sin actividad hoy</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(technicianLoad).map(([tid, data]) => {
                const cnt = techCountToday[tid] ?? 0;
                const { dot, bar } = techColor(cnt);
                return (
                  <div key={tid} className="rounded-xl border-2 border-pink-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-bold">{data.name}</p>
                      <span>{dot}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      <span className="text-gray-500">Programados:</span><span className="font-semibold">{data.programados}</span>
                      <span className="text-gray-500">Llegadas:</span><span className="font-semibold text-pink-700">{data.llegadas}</span>
                      <span className="text-gray-500">Atendidos:</span><span className="font-semibold text-blue-700">{data.atendidos}</span>
                      <span className="text-gray-500">Completados:</span><span className="font-semibold text-green-700">{data.completados}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Seguimientos: {cnt}/{LIMITE}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${bar}`} style={{ width: `${Math.min((cnt / LIMITE) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
