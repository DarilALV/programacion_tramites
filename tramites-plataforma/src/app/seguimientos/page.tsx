"use client";

import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useTramitesStore, type Entry } from "@/lib/tramites-store";

const LIMITE_SEGUIMIENTOS = 12;

function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function minutesDiff(from: string, to?: string) {
  const [fh, fm] = from.split(":").map(Number);
  if (to) {
    const [th, tm] = to.split(":").map(Number);
    return (th * 60 + tm) - (fh * 60 + fm);
  }
  const now = new Date();
  return (now.getHours() * 60 + now.getMinutes()) - (fh * 60 + fm);
}

function formatMinutes(mins: number) {
  if (mins < 0) return "—";
  if (mins === 0) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function SeguimientosPage() {
  const [tramiteCode, setTramiteCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [observations, setObservations] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const { entries, updateEntry, createEntry, technicians, currentUser, getNextRegistrationNumber } =
    useTramitesStore();

  const today = new Date().toISOString().slice(0, 10);

  // Buscar el trámite en TODAS las entradas
  const foundEntry = useMemo(() => {
    if (!tramiteCode.trim()) return null;
    return entries.find((e) => e.tramiteCode === tramiteCode.trim()) ?? null;
  }, [tramiteCode, entries]);

  // Pre-seleccionar técnico cuando se encuentra el trámite
  useEffect(() => {
    if (foundEntry) setSelectedTechnicianId(foundEntry.technicianId);
  }, [foundEntry?.id]);

  const effectiveTechnician = technicians.find((t) => t.id === selectedTechnicianId);

  // Seguimientos registrados hoy
  const todayFollowUps = useMemo(() => {
    return entries
      .filter(
        (e) =>
          e.followUp?.createdAt?.startsWith(today) ||
          (e.scheduleDate === today && e.followUp)
      )
      .sort((a, b) => {
        const ta = a.followUp?.arrivalTime ?? "00:00";
        const tb = b.followUp?.arrivalTime ?? "00:00";
        return tb.localeCompare(ta);
      });
  }, [entries, today]);

  // Contador de seguimientos por técnico hoy
  const techCountToday = useMemo(() => {
    const counts: Record<string, number> = {};
    todayFollowUps.forEach((e) => {
      const tid = e.followUp?.actualTechnicianId ?? e.technicianId;
      counts[tid] = (counts[tid] ?? 0) + 1;
    });
    return counts;
  }, [todayFollowUps]);

  // Carga por técnico hoy
  const technicianLoad = useMemo(() => {
    const load: Record<string, { name: string; programados: number; llegadas: number; atendidos: number; completados: number }> = {};
    entries.filter((e) => e.scheduleDate === today).forEach((e) => {
      if (!load[e.technicianId]) load[e.technicianId] = { name: e.technicianName, programados: 0, llegadas: 0, atendidos: 0, completados: 0 };
      load[e.technicianId].programados += 1;
    });
    todayFollowUps.forEach((e) => {
      const tid = e.followUp?.actualTechnicianId ?? e.technicianId;
      const tname = e.followUp?.actualTechnicianName ?? e.technicianName;
      if (!load[tid]) load[tid] = { name: tname, programados: 0, llegadas: 0, atendidos: 0, completados: 0 };
      load[tid].llegadas += 1;
      if (e.followUp?.attendedTime) load[tid].atendidos += 1;
      if (e.followUp?.completedTime) load[tid].completados += 1;
    });
    return load;
  }, [entries, todayFollowUps, today]);

  function showMsg(text: string, type: "success" | "error") {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(""), 4000);
  }

  function handleRegisterArrival() {
    if (!tramiteCode.trim()) return showMsg("⚠️ Ingresa el número de trámite", "error");
    if (!clientName.trim()) return showMsg("⚠️ Ingresa el nombre de la persona", "error");
    if (!selectedTechnicianId) return showMsg("⚠️ Selecciona el técnico que atenderá", "error");

    const count = techCountToday[selectedTechnicianId] ?? 0;
    if (count >= LIMITE_SEGUIMIENTOS) {
      return showMsg(`⛔ ${effectiveTechnician?.name} ya alcanzó el límite de ${LIMITE_SEGUIMIENTOS} seguimientos hoy`, "error");
    }

    const arrival = nowTime();
    const now = new Date();

    if (foundEntry) {
      const techChanged = selectedTechnicianId !== foundEntry.technicianId;
      updateEntry(foundEntry.id, {
        ...foundEntry,
        followUp: {
          clientName: clientName.trim(),
          arrivalTime: arrival,
          actualTechnicianId: techChanged ? selectedTechnicianId : undefined,
          actualTechnicianName: techChanged ? effectiveTechnician?.name : undefined,
          observations: observations.trim() || undefined,
          createdAt: now.toISOString(),
        },
      });
      showMsg(`✅ Llegada registrada — ${effectiveTechnician?.name}`, "success");
    } else {
      const newEntry: Entry = {
        id: `unsched-${Date.now()}`,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        registrationNumber: getNextRegistrationNumber(),
        tramiteCode: tramiteCode.trim(),
        technicianId: selectedTechnicianId,
        technicianName: effectiveTechnician?.name ?? selectedTechnicianId,
        technicianArea: effectiveTechnician?.areaLabel ?? "",
        scheduleDate: today,
        registrationDate: today,
        observations: "",
        status: "Registrado",
        createdAt: now.toISOString(),
        followUp: {
          clientName: clientName.trim(),
          arrivalTime: arrival,
          observations: observations.trim() || undefined,
          createdAt: now.toISOString(),
          isUnscheduled: true,
        },
      };
      createEntry(newEntry);
      showMsg(`✅ Seguimiento sin programación registrado — ${effectiveTechnician?.name}`, "success");
    }

    setTramiteCode("");
    setClientName("");
    setSelectedTechnicianId("");
    setObservations("");
  }

  function handleMarkAttended(entry: Entry) {
    updateEntry(entry.id, {
      ...entry,
      followUp: { ...entry.followUp, attended: true, attendedTime: nowTime() },
    });
  }

  function handleMarkCompleted(entry: Entry) {
    updateEntry(entry.id, {
      ...entry,
      followUp: { ...entry.followUp, completedTime: nowTime() },
    });
  }

  async function exportarReporte() {
    const XLSX = await import("xlsx");
    const rows = todayFollowUps.map((e) => {
      const fu = e.followUp!;
      const techName = fu.actualTechnicianName ?? e.technicianName;
      const waitMins = fu.arrivalTime && fu.attendedTime ? minutesDiff(fu.arrivalTime, fu.attendedTime) : null;
      const attnMins = fu.attendedTime && fu.completedTime ? minutesDiff(fu.attendedTime, fu.completedTime) : null;
      return {
        Fecha: today,
        "Código Trámite": e.tramiteCode,
        "N° Registro": e.registrationNumber,
        "Cliente": fu.clientName ?? "",
        "Técnico": techName,
        "Área": e.technicianArea,
        "Sin programación": fu.isUnscheduled ? "Sí" : "No",
        "Hora Llegada": fu.arrivalTime ?? "",
        "Hora Atención": fu.attendedTime ?? "",
        "Hora Completado": fu.completedTime ?? "",
        "Espera (min)": waitMins ?? "",
        "Duración atención (min)": attnMins ?? "",
        "Observaciones": fu.observations ?? "",
        "Registrado por": e.createdByName,
        "Registrado en": fu.createdAt ? new Date(fu.createdAt).toLocaleTimeString("es-BO") : "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Seguimientos");
    XLSX.writeFile(wb, `seguimientos-${today}.xlsx`);
  }

  const canSubmit = tramiteCode.trim() && clientName.trim() && selectedTechnicianId;
  const selectedTechCount = techCountToday[selectedTechnicianId] ?? 0;
  const selectedTechOverLimit = selectedTechCount >= LIMITE_SEGUIMIENTOS;

  return (
    <AppShell
      title="Seguimientos del Día"
      description="Registra llegadas, atenciones y cierres de trámites"
      eyebrow="SEGUIMIENTOS"
    >
      <div className="space-y-6">
        {/* FORMULARIO */}
        <section className="rounded-4xl border-2 border-pink-200 bg-pink-50 p-6 space-y-4">
          <h2 className="text-2xl font-bold">Registrar Llegada</h2>

          {message && (
            <div className={`p-4 rounded-lg text-sm font-medium ${
              messageType === "success"
                ? "bg-green-100 text-green-800 border border-green-300"
                : "bg-red-100 text-red-800 border border-red-300"
            }`}>
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">Número de Trámite *</span>
              <input
                type="text"
                value={tramiteCode}
                onChange={(e) => setTramiteCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRegisterArrival()}
                placeholder="Ej: 2026016618"
                autoFocus
                className="rounded-lg border-2 border-pink-300 px-4 py-3 text-lg font-semibold focus:border-pink-500 focus:outline-none"
              />
            </label>

            {tramiteCode.trim() && foundEntry && (
              <div className="md:col-span-2 rounded-lg bg-blue-50 border-2 border-blue-200 p-4 space-y-1">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">✓ Trámite encontrado</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-xs text-gray-500">Registro</p><p className="font-bold">{foundEntry.registrationNumber}</p></div>
                  <div><p className="text-xs text-gray-500">Fecha programada</p><p className="font-bold">{foundEntry.scheduleDate}</p></div>
                  <div><p className="text-xs text-gray-500">Técnico asignado</p><p className="font-bold text-blue-900">{foundEntry.technicianName}</p></div>
                  {foundEntry.followUp && <div><p className="text-xs text-orange-600 font-semibold">⚠️ Ya tiene seguimiento registrado</p></div>}
                </div>
              </div>
            )}

            {tramiteCode.trim() && !foundEntry && (
              <div className="md:col-span-2 rounded-lg bg-amber-50 border-2 border-amber-200 p-3">
                <p className="text-sm font-semibold text-amber-800">⚠️ Trámite no encontrado — selecciona técnico manualmente</p>
              </div>
            )}

            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">Nombre de Quién Viene *</span>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRegisterArrival()}
                placeholder="Ej: Juan Pérez"
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none"
              />
            </label>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">
                Técnico que Atenderá *
                {foundEntry && <span className="text-xs font-normal text-gray-500 ml-2">(puedes cambiar)</span>}
              </span>
              <select
                value={selectedTechnicianId}
                onChange={(e) => setSelectedTechnicianId(e.target.value)}
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none bg-white"
              >
                <option value="">— Selecciona técnico —</option>
                {technicians.map((t) => {
                  const cnt = techCountToday[t.id] ?? 0;
                  const over = cnt >= LIMITE_SEGUIMIENTOS;
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.areaLabel} {over ? `⛔ (${cnt}/${LIMITE_SEGUIMIENTOS})` : cnt > 0 ? `(${cnt}/${LIMITE_SEGUIMIENTOS})` : ""}
                    </option>
                  );
                })}
              </select>

              {/* Barra de progreso del técnico seleccionado */}
              {selectedTechnicianId && (
                <div className="mt-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">
                      {effectiveTechnician?.name}: {selectedTechCount} / {LIMITE_SEGUIMIENTOS} seguimientos hoy
                    </span>
                    {selectedTechOverLimit && (
                      <span className="text-red-600 font-semibold">⛔ Límite alcanzado</span>
                    )}
                    {!selectedTechOverLimit && selectedTechCount >= LIMITE_SEGUIMIENTOS - 3 && (
                      <span className="text-amber-600 font-semibold">⚠️ Casi al límite</span>
                    )}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        selectedTechOverLimit ? "bg-red-500" :
                        selectedTechCount >= LIMITE_SEGUIMIENTOS - 3 ? "bg-amber-500" : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min((selectedTechCount / LIMITE_SEGUIMIENTOS) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </label>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">Observaciones (opcional)</span>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Ej: cliente pidió urgencia, documento incompleto…"
                rows={2}
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none"
              />
            </label>
          </div>

          <button
            onClick={handleRegisterArrival}
            disabled={!canSubmit || selectedTechOverLimit}
            className={`w-full rounded-lg px-6 py-3 font-semibold text-white text-lg transition shadow-md ${
              canSubmit && !selectedTechOverLimit ? "bg-pink-600 hover:bg-pink-700 cursor-pointer" : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            ✅ Registrar Llegada — Hora Actual
          </button>
        </section>

        {/* LISTA DE SEGUIMIENTOS DEL DÍA */}
        <section className="rounded-4xl border-2 border-pink-200 overflow-hidden">
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-2xl font-bold">
              Seguimientos de Hoy
              <span className="text-sm font-normal ml-2">({todayFollowUps.length})</span>
            </h2>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm">🚶 {todayFollowUps.length} llegadas</span>
              <span className="text-sm">👤 {todayFollowUps.filter((e) => e.followUp?.attendedTime).length} atendidos</span>
              <span className="text-sm">✅ {todayFollowUps.filter((e) => e.followUp?.completedTime).length} completados</span>
              {todayFollowUps.length > 0 && (
                <button
                  onClick={exportarReporte}
                  className="bg-white text-pink-700 font-semibold text-sm px-4 py-1.5 rounded-lg hover:bg-pink-50 transition cursor-pointer"
                >
                  📥 Exportar Excel
                </button>
              )}
            </div>
          </div>

          {todayFollowUps.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">Aún no hay seguimientos registrados hoy</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-pink-100 border-b-2 border-pink-200">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold">Trámite</th>
                    <th className="px-3 py-3 text-left font-semibold">Persona</th>
                    <th className="px-3 py-3 text-left font-semibold">Técnico</th>
                    <th className="px-3 py-3 text-left font-semibold">Llegada</th>
                    <th className="px-3 py-3 text-left font-semibold">Atendido</th>
                    <th className="px-3 py-3 text-left font-semibold">Completado</th>
                    <th className="px-3 py-3 text-left font-semibold">Tiempos</th>
                    <th className="px-3 py-3 text-left font-semibold">Obs.</th>
                    <th className="px-3 py-3 text-left font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {todayFollowUps.map((entry, index) => {
                    const fu = entry.followUp!;
                    const techName = fu.actualTechnicianName ?? entry.technicianName;
                    const waitMins = fu.arrivalTime ? minutesDiff(fu.arrivalTime, fu.attendedTime) : null;
                    const attnMins = fu.attendedTime && fu.completedTime ? minutesDiff(fu.attendedTime, fu.completedTime) : null;

                    let rowBg = index % 2 === 0 ? "bg-pink-50" : "bg-white";
                    if (fu.completedTime) rowBg = "bg-green-50";
                    else if (fu.attendedTime) rowBg = "bg-blue-50";

                    return (
                      <tr key={entry.id} className={rowBg}>
                        <td className="px-3 py-3">
                          <p className="font-mono font-semibold">{entry.tramiteCode}</p>
                          <p className="text-xs text-gray-500">{entry.registrationNumber}</p>
                          {fu.isUnscheduled && <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded">sin prog.</span>}
                        </td>
                        <td className="px-3 py-3">{fu.clientName}</td>
                        <td className="px-3 py-3 font-semibold">
                          {techName}
                          {fu.actualTechnicianName && <p className="text-xs font-normal text-gray-500">asignado: {entry.technicianName}</p>}
                        </td>
                        <td className="px-3 py-3 font-semibold text-pink-700">{fu.arrivalTime ?? "—"}</td>
                        <td className="px-3 py-3 font-semibold text-blue-700">{fu.attendedTime ?? "—"}</td>
                        <td className="px-3 py-3 font-semibold text-green-700">{fu.completedTime ?? "—"}</td>
                        <td className="px-3 py-3 text-xs space-y-0.5">
                          {waitMins !== null && (
                            <p><span className="text-gray-500">Espera:</span> <span className={waitMins > 30 ? "text-red-600 font-semibold" : ""}>{formatMinutes(waitMins)}</span></p>
                          )}
                          {attnMins !== null && (
                            <p><span className="text-gray-500">Atención:</span> {formatMinutes(attnMins)}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600 max-w-[120px]">{fu.observations ? `"${fu.observations}"` : "—"}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            {!fu.attendedTime && (
                              <button onClick={() => handleMarkAttended(entry)} className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">
                                👤 Atendido
                              </button>
                            )}
                            {fu.attendedTime && !fu.completedTime && (
                              <button onClick={() => handleMarkCompleted(entry)} className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 cursor-pointer">
                                ✅ Completado
                              </button>
                            )}
                            {fu.completedTime && <span className="text-xs text-green-700 font-semibold">✓ Listo</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* CARGA POR TÉCNICO */}
        <section className="rounded-4xl border-2 border-pink-200 p-6">
          <h2 className="text-2xl font-bold mb-4">Técnicos — Resumen del Día</h2>
          {Object.keys(technicianLoad).length === 0 ? (
            <p className="text-gray-500">Sin actividad hoy</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(technicianLoad).map(([tid, data]) => {
                const count = techCountToday[tid] ?? 0;
                const pct = Math.min(Math.round((count / LIMITE_SEGUIMIENTOS) * 100), 100);
                const over = count >= LIMITE_SEGUIMIENTOS;
                return (
                  <div key={tid} className={`rounded-xl border-2 p-4 space-y-3 ${over ? "border-red-300 bg-red-50" : "border-pink-200 bg-white"}`}>
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-gray-900">{data.name}</p>
                      {over && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">⛔ Lleno</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      <span className="text-gray-500">Programados:</span><span className="font-semibold">{data.programados}</span>
                      <span className="text-gray-500">Llegadas:</span><span className="font-semibold text-pink-700">{data.llegadas}</span>
                      <span className="text-gray-500">Atendidos:</span><span className="font-semibold text-blue-700">{data.atendidos}</span>
                      <span className="text-gray-500">Completados:</span><span className="font-semibold text-green-700">{data.completados}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Seguimientos: {count}/{LIMITE_SEGUIMIENTOS}</span>
                        <span className={over ? "text-red-600 font-semibold" : "text-gray-500"}>{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${over ? "bg-red-500" : count >= LIMITE_SEGUIMIENTOS - 3 ? "bg-amber-500" : "bg-green-500"}`}
                          style={{ width: `${pct}%` }}
                        />
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
