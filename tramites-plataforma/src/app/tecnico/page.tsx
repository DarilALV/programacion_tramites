"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { technicians, useTramitesStore } from "@/lib/tramites-store";

type TramiteAgenda = {
  id: string;
  tramiteCode: string;
  registrationNumber: string;
  scheduledTime: string;
  scheduledEndTime: string;
  clientName?: string;
  arrivalTime?: string;
  attendedTime?: string;
  completedTime?: string;
  isUnscheduled?: boolean;
  observations?: string;
  status: "pending" | "arrived" | "attending" | "completed";
};

function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function minDiff(from: string, to: string) {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  return (th * 60 + tm) - (fh * 60 + fm);
}

function fmtMin(mins: number) {
  if (mins <= 0) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function AgendaTecnicoPage() {
  const { entries, updateEntry } = useTramitesStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(technicians[0].id);

  const selectedTechnician = technicians.find((t) => t.id === selectedTechnicianId) ?? technicians[0];

  const agendaHoy = useMemo(() => {
    return entries
      .filter((e) => {
        const isThisDate = e.scheduleDate === selectedDate;
        const isThisTech = e.technicianId === selectedTechnicianId;
        // Seguimiento sin programación asignado a este técnico hoy
        const isActualTech =
          e.followUp?.actualTechnicianId === selectedTechnicianId &&
          e.followUp?.createdAt?.startsWith(selectedDate);
        return (isThisDate && isThisTech) || isActualTech;
      })
      .sort((a, b) => {
        const ta = a.scheduledTime || a.followUp?.arrivalTime || "00:00";
        const tb = b.scheduledTime || b.followUp?.arrivalTime || "00:00";
        return ta.localeCompare(tb);
      })
      .map((entry): TramiteAgenda => {
        const fu = entry.followUp;
        let status: TramiteAgenda["status"] = "pending";
        if (fu?.completedTime) status = "completed";
        else if (fu?.attendedTime) status = "attending";
        else if (fu?.arrivalTime) status = "arrived";

        return {
          id: entry.id,
          tramiteCode: entry.tramiteCode,
          registrationNumber: entry.registrationNumber,
          scheduledTime: entry.scheduledTime || fu?.arrivalTime || "--:--",
          scheduledEndTime: entry.scheduledEndTime || "--:--",
          clientName: fu?.clientName,
          arrivalTime: fu?.arrivalTime,
          attendedTime: fu?.attendedTime,
          completedTime: fu?.completedTime,
          isUnscheduled: fu?.isUnscheduled,
          observations: entry.observations,
          status,
        };
      });
  }, [entries, selectedDate, selectedTechnicianId]);

  const stats = useMemo(() => ({
    total: agendaHoy.length,
    pending: agendaHoy.filter((t) => t.status === "pending").length,
    arrived: agendaHoy.filter((t) => t.status === "arrived").length,
    attending: agendaHoy.filter((t) => t.status === "attending").length,
    completed: agendaHoy.filter((t) => t.status === "completed").length,
  }), [agendaHoy]);

  const clienteEsperando = useMemo(
    () => agendaHoy.find((t) => t.status === "arrived"),
    [agendaHoy]
  );

  function handleMarkAttending(entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry?.followUp) return;
    updateEntry(entryId, {
      ...entry,
      followUp: { ...entry.followUp, attended: true, attendedTime: nowTime() },
    });
  }

  function handleMarkCompleted(entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry?.followUp) return;
    updateEntry(entryId, {
      ...entry,
      followUp: { ...entry.followUp, completedTime: nowTime() },
    });
  }

  async function exportarReporte() {
    const XLSX = await import("xlsx");
    const rows = agendaHoy.map((t) => ({
      Fecha: selectedDate,
      Técnico: selectedTechnician.name,
      "Código Trámite": t.tramiteCode,
      "N° Registro": t.registrationNumber,
      "Sin programación": t.isUnscheduled ? "Sí" : "No",
      "Cliente": t.clientName ?? "",
      "Horario programado": `${t.scheduledTime} - ${t.scheduledEndTime}`,
      "Hora Llegada": t.arrivalTime ?? "",
      "Salió a atender": t.attendedTime ?? "",
      "Regresó": t.completedTime ?? "",
      "Espera (min)": t.arrivalTime && t.attendedTime ? minDiff(t.arrivalTime, t.attendedTime) : "",
      "Duración atención (min)": t.attendedTime && t.completedTime ? minDiff(t.attendedTime, t.completedTime) : "",
      "Estado": t.status === "completed" ? "Completado" : t.status === "attending" ? "Atendiendo" : t.status === "arrived" ? "Esperando" : "Pendiente",
      "Observaciones": t.observations ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agenda");
    XLSX.writeFile(wb, `agenda-${selectedTechnician.name.replace(/\s/g, "_")}-${selectedDate}.xlsx`);
  }

  return (
    <AppShell
      title="Mi Agenda de Atención"
      description="Ver trámites programados y clientes en espera"
      eyebrow="TÉCNICO"
    >
      <div className="space-y-6">
        {/* FILTROS */}
        <section className="rounded-4xl border-2 border-pink-200 bg-pink-50 p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-700">Técnico</span>
              <select
                value={selectedTechnicianId}
                onChange={(e) => setSelectedTechnicianId(e.target.value)}
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none bg-white font-semibold"
              >
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name} · {tech.areaLabel}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-700">Fecha</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none"
              />
            </label>
          </div>
        </section>

        {/* ESTADÍSTICAS */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Programados", value: stats.total, color: "blue" },
            { label: "Pendientes", value: stats.pending, color: "gray" },
            { label: "En espera", value: stats.arrived, color: "orange" },
            { label: "Atendiendo", value: stats.attending, color: "purple" },
            { label: "Completados", value: stats.completed, color: "green" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className={`rounded-lg border-2 border-${color}-200 bg-${color}-50 p-4`}
            >
              <p className="text-xs text-gray-600 uppercase">{label}</p>
              <p className={`text-3xl font-bold text-${color}-900 mt-1`}>{value}</p>
            </div>
          ))}
        </section>

        {/* ALERTA: CLIENTE ESPERANDO */}
        {clienteEsperando && (
          <section className="rounded-4xl border-4 border-red-400 bg-gradient-to-r from-red-50 to-orange-50 p-6 animate-pulse">
            <p className="text-sm font-semibold text-red-700 uppercase">⚠️ CLIENTE EN ESPERA</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-600">Código Trámite</p>
                <p className="text-2xl font-bold text-red-900 mt-1">{clienteEsperando.tramiteCode}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Cliente</p>
                <p className="text-2xl font-bold text-red-900 mt-1">{clienteEsperando.clientName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Llegó a las</p>
                <p className="text-2xl font-bold text-red-900 mt-1">{clienteEsperando.arrivalTime}</p>
              </div>
            </div>
            <button
              onClick={() => handleMarkAttending(clienteEsperando.id)}
              className="mt-4 w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition cursor-pointer"
            >
              👤 SALIR A ATENDER AL CLIENTE
            </button>
          </section>
        )}

        {/* AGENDA */}
        <section className="rounded-4xl border-2 border-pink-200 overflow-hidden">
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-2xl font-bold">Agenda — {selectedTechnician.name}</h2>
            {agendaHoy.length > 0 && (
              <button
                onClick={exportarReporte}
                className="bg-white text-pink-700 font-semibold text-sm px-4 py-1.5 rounded-lg hover:bg-pink-50 transition cursor-pointer"
              >
                📥 Exportar Excel
              </button>
            )}
          </div>

          {agendaHoy.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No hay trámites programados para esta fecha
            </div>
          ) : (
            <div className="divide-y-2 divide-pink-100">
              {agendaHoy.map((tramite) => {
                const rowBg =
                  tramite.status === "completed"
                    ? "bg-green-50 border-green-500"
                    : tramite.status === "attending"
                    ? "bg-purple-50 border-purple-500"
                    : tramite.status === "arrived"
                    ? "bg-orange-50 border-orange-500"
                    : "bg-white border-gray-200";

                const waitMins =
                  tramite.arrivalTime && tramite.attendedTime
                    ? minDiff(tramite.arrivalTime, tramite.attendedTime)
                    : tramite.arrivalTime && !tramite.attendedTime
                    ? minDiff(tramite.arrivalTime, nowTime())
                    : null;

                const attnMins =
                  tramite.attendedTime && tramite.completedTime
                    ? minDiff(tramite.attendedTime, tramite.completedTime)
                    : null;

                return (
                  <div key={tramite.id} className={`p-4 border-l-4 ${rowBg}`}>
                    <div className="grid grid-cols-2 md:grid-cols-8 gap-3 items-start">

                      {/* Horario */}
                      <div className="md:col-span-1">
                        <p className="text-xs text-gray-500 uppercase">Horario</p>
                        <p className="font-bold text-gray-900 text-sm">
                          {tramite.scheduledTime}
                          {tramite.scheduledEndTime !== "--:--" && (
                            <span className="text-gray-500"> – {tramite.scheduledEndTime}</span>
                          )}
                        </p>
                        {tramite.isUnscheduled && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded">sin prog.</span>
                        )}
                      </div>

                      {/* Trámite */}
                      <div className="md:col-span-1">
                        <p className="text-xs text-gray-500 uppercase">Trámite</p>
                        <p className="font-mono font-bold text-sm">{tramite.tramiteCode}</p>
                        <p className="text-xs text-gray-400">{tramite.registrationNumber}</p>
                      </div>

                      {/* Cliente */}
                      <div className="md:col-span-1">
                        <p className="text-xs text-gray-500 uppercase">Cliente</p>
                        <p className="font-semibold text-sm">{tramite.clientName || "—"}</p>
                      </div>

                      {/* Llegó */}
                      <div className="md:col-span-1">
                        <p className="text-xs text-gray-500 uppercase">Llegó</p>
                        <p className="font-bold text-pink-700 text-sm">{tramite.arrivalTime || "—"}</p>
                        {waitMins !== null && !tramite.attendedTime && (
                          <p className={`text-xs font-semibold ${waitMins > 30 ? "text-red-600" : "text-amber-600"}`}>
                            {fmtMin(waitMins)} esperando
                          </p>
                        )}
                      </div>

                      {/* Salió a atender */}
                      <div className="md:col-span-1">
                        <p className="text-xs text-gray-500 uppercase">Salió a atender</p>
                        <p className="font-bold text-purple-700 text-sm">{tramite.attendedTime || "—"}</p>
                        {waitMins !== null && tramite.attendedTime && (
                          <p className="text-xs text-gray-500">Espera: {fmtMin(waitMins)}</p>
                        )}
                      </div>

                      {/* Regresó */}
                      <div className="md:col-span-1">
                        <p className="text-xs text-gray-500 uppercase">Regresó</p>
                        <p className="font-bold text-green-700 text-sm">{tramite.completedTime || "—"}</p>
                        {attnMins !== null && (
                          <p className="text-xs text-gray-500">Atención: {fmtMin(attnMins)}</p>
                        )}
                      </div>

                      {/* Estado */}
                      <div className="md:col-span-1">
                        <p className="text-xs text-gray-500 uppercase">Estado</p>
                        <p className={`text-sm font-bold mt-0.5 ${
                          tramite.status === "completed" ? "text-green-700" :
                          tramite.status === "attending" ? "text-purple-700" :
                          tramite.status === "arrived" ? "text-orange-700" :
                          "text-gray-500"
                        }`}>
                          {tramite.status === "completed" ? "✅ Completado" :
                           tramite.status === "attending" ? "👤 Atendiendo" :
                           tramite.status === "arrived" ? "⏳ Esperando" :
                           "🕐 Pendiente"}
                        </p>
                      </div>

                      {/* Acción */}
                      <div className="md:col-span-1 flex flex-col gap-1">
                        {tramite.status === "arrived" && (
                          <button
                            onClick={() => handleMarkAttending(tramite.id)}
                            className="px-3 py-1.5 bg-orange-500 text-white text-xs font-bold rounded hover:bg-orange-600 transition cursor-pointer"
                          >
                            👤 Salir a atender
                          </button>
                        )}
                        {tramite.status === "attending" && (
                          <button
                            onClick={() => handleMarkCompleted(tramite.id)}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 transition cursor-pointer"
                          >
                            ✅ Regresé
                          </button>
                        )}
                        {tramite.status === "completed" && (
                          <span className="text-xs text-green-700 font-bold">✓ Listo</span>
                        )}
                        {tramite.status === "pending" && (
                          <span className="text-xs text-gray-400">Esperando llegada</span>
                        )}
                      </div>
                    </div>

                    {tramite.observations && (
                      <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
                        📌 {tramite.observations}
                      </p>
                    )}
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
