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
  arrivalTime?: string;           // ← YA ESTABA
  attendedTime?: string;          // ← AGREGAR ESTA LÍNEA
  status: "pending" | "arrived" | "attended";
  observations?: string;
};

export default function AgendaTecnicoPage() {
  const { entries, updateEntry } = useTramitesStore();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  
  // NUEVO: Selector de técnico
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(
    technicians[0].id // Primer técnico por defecto
  );

  // Obtener técnico seleccionado
  const selectedTechnician = technicians.find(
    (t) => t.id === selectedTechnicianId
  ) ?? technicians[0];

  // Obtener agenda del técnico para la fecha seleccionada
  const agendaHoy = useMemo(() => {
    return entries
      .filter(
        (e) =>
          e.scheduleDate === selectedDate &&
          e.technicianId === selectedTechnicianId
      )
      .sort((a, b) => {
        const timeA = a.scheduledTime || "00:00";
        const timeB = b.scheduledTime || "00:00";
        return timeA.localeCompare(timeB);
      })
      .map((entry) => {
  let status: "pending" | "arrived" | "attended" = "pending";

  if (entry.followUp?.attended) {
    status = "attended";
  } else if (entry.followUp?.arrivalTime) {
    status = "arrived";
  }

  return {
    id: entry.id,
    tramiteCode: entry.tramiteCode,
    registrationNumber: entry.registrationNumber,
    scheduledTime: entry.scheduledTime || "--:--",
    scheduledEndTime: entry.scheduledEndTime || "--:--",
    clientName: entry.followUp?.clientName,
    arrivalTime: entry.followUp?.arrivalTime,
    attendedTime: entry.followUp?.attendedTime,  // ← AGREGAR ESTA LÍNEA
    status,
    observations: entry.observations,
  } as TramiteAgenda;
})  
  }, [entries, selectedDate, selectedTechnicianId]);

  // Estadísticas
  const stats = useMemo(() => {
    return {
      total: agendaHoy.length,
      pending: agendaHoy.filter((t) => t.status === "pending").length,
      arrived: agendaHoy.filter((t) => t.status === "arrived").length,
      attended: agendaHoy.filter((t) => t.status === "attended").length,
    };
  }, [agendaHoy]);

  // Próximo a atender
  const proximoAAtender = useMemo(() => {
    return agendaHoy.find((t) => t.status === "arrived");
  }, [agendaHoy]);

  // NUEVO: Función para marcar como atendido
  const handleMarkAsAttended = (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || !entry.followUp) return;

    const currentTime = new Date();
    const hours = String(currentTime.getHours()).padStart(2, "0");
    const minutes = String(currentTime.getMinutes()).padStart(2, "0");
    const attendedTime = `${hours}:${minutes}`;

    updateEntry(entryId, {
      ...entry,
      followUp: {
        ...entry.followUp,
        attended: true,
        attendedTime,
      },
    });
  };

  return (
    <AppShell
      title="Mi Agenda de Atención"
      description="Ver trámites programados para hoy y clientes que llegan"
      eyebrow="TÉCNICO"
    >
      <div className="space-y-6">
        {/* SELECTOR DE FECHA Y TÉCNICO */}
        <section className="rounded-4xl border-2 border-pink-200 bg-pink-50 p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Filtros</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Selector de Técnico */}
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-700">
                Seleccionar Técnico
              </span>
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
              <p className="text-xs text-gray-600">
                Viendo agenda de: <strong>{selectedTechnician.name}</strong>
              </p>
            </label>

            {/* Selector de Fecha */}
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-700">
                Seleccionar Fecha
              </span>
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
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
            <p className="text-xs text-gray-600 uppercase">Total Programados</p>
            <p className="text-3xl font-bold text-blue-900 mt-2">{stats.total}</p>
          </div>

          <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-gray-600 uppercase">Pendientes</p>
            <p className="text-3xl font-bold text-amber-900 mt-2">{stats.pending}</p>
          </div>

          <div className="rounded-lg border-2 border-orange-200 bg-orange-50 p-4">
            <p className="text-xs text-gray-600 uppercase">Llegaron</p>
            <p className="text-3xl font-bold text-orange-900 mt-2">{stats.arrived}</p>
            {proximoAAtender && (
              <p className="text-xs text-orange-600 mt-2">
                ⏰ {proximoAAtender.tramiteCode} esperando
              </p>
            )}
          </div>

          <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
            <p className="text-xs text-gray-600 uppercase">Atendidos</p>
            <p className="text-3xl font-bold text-green-900 mt-2">{stats.attended}</p>
          </div>
        </section>

        {/* PRÓXIMO A ATENDER - DESTACADO */}
        {proximoAAtender && (
          <section className="rounded-4xl border-4 border-red-400 bg-gradient-to-r from-red-50 to-orange-50 p-6 animate-pulse">
            <p className="text-sm font-semibold text-red-700 uppercase">
              ⚠️ CLIENTE EN ESPERA
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-600">Código Trámite</p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {proximoAAtender.tramiteCode}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Cliente</p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {proximoAAtender.clientName || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Llegó a las</p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {proximoAAtender.arrivalTime}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleMarkAsAttended(proximoAAtender.id)}
              className="mt-4 w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition"
            >
              ✓ ATENDER A CLIENTE
            </button>
          </section>
        )}

        {/* AGENDA DEL DÍA */}
        <section className="rounded-4xl border-2 border-pink-200 overflow-hidden">
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-6 py-4">
            <h2 className="text-2xl font-bold">
              Agenda del Día - {selectedTechnician.name}
            </h2>
          </div>

          {agendaHoy.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <p>No hay trámites programados para esta fecha</p>
            </div>
          ) : (
            <div className="divide-y-2 divide-pink-100">
              {agendaHoy.map((tramite, index) => (
                <div
                  key={tramite.id}
                  className={`p-4 border-l-4 ${
                    tramite.status === "attended"
                      ? "bg-green-50 border-green-500"
                      : tramite.status === "arrived"
                      ? "bg-orange-50 border-orange-500"
                      : "bg-white border-gray-300"
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
  {/* COLUMNA 1: Horario */}
  <div>
    <p className="text-xs text-gray-600 uppercase">Horario</p>
    <p className="text-lg font-bold text-gray-900">
      {tramite.scheduledTime} - {tramite.scheduledEndTime}
    </p>
  </div>

  {/* COLUMNA 2: Trámite */}
  <div>
    <p className="text-xs text-gray-600 uppercase">Trámite</p>
    <p className="text-lg font-mono font-bold text-gray-900">
      {tramite.tramiteCode}
    </p>
  </div>

  {/* COLUMNA 3: Cliente */}
  <div>
    <p className="text-xs text-gray-600 uppercase">Cliente</p>
    <p className="text-lg font-bold text-gray-900">
      {tramite.clientName || "—"}
    </p>
  </div>

  {/* COLUMNA 4: Llegó a - NUEVA */}
  <div>
    <p className="text-xs text-gray-600 uppercase">Llegó a</p>
    <p className="text-lg font-bold text-gray-900">
      {tramite.arrivalTime || "—"}
    </p>
  </div>

  {/* COLUMNA 5: Atendido a - NUEVA */}
  <div>
    <p className="text-xs text-gray-600 uppercase">Atendido a</p>
    <p className="text-lg font-bold text-gray-900">
      {tramite.attendedTime || "—"}
    </p>
  </div>

  {/* COLUMNA 6: Estado */}
  <div>
    <p className="text-xs text-gray-600 uppercase">Estado</p>
    <p
      className={`text-sm font-bold mt-1 ${
        tramite.status === "attended"
          ? "text-green-700"
          : tramite.status === "arrived"
          ? "text-orange-700"
          : "text-gray-600"
      }`}
    >
      {tramite.status === "attended"
        ? `✓ Atendido a las ${tramite.attendedTime || "--:--"}`
        : tramite.status === "arrived"
        ? "⏳ Cliente esperando"
        : "🕐 Pendiente"}
    </p>
  </div>

  {/* COLUMNA 7: Acción */}
  <div className="text-right">
    <p className="text-xs text-gray-600 uppercase">Acción</p>
    {tramite.status === "arrived" && (
      <button
        onClick={() => handleMarkAsAttended(tramite.id)}
        className="mt-1 px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded hover:bg-orange-600 transition"
      >
        Atender
      </button>
    )}
    {tramite.status === "attended" && (
      <span className="text-xs text-green-700 font-bold">
        Completado
      </span>
    )}
    {tramite.status === "pending" && (
      <span className="text-xs text-gray-500">Esperando</span>
    )}
  </div>
</div>

                  {tramite.observations && (
                    <p className="text-xs text-gray-600 mt-3 pt-3 border-t">
                      📌 {tramite.observations}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* INFORMACIÓN ÚTIL */}
        <section className="rounded-4xl border-2 border-blue-200 bg-blue-50 p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3">
            ℹ️ Información Útil
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>
              ✓ <strong>Selecciona un técnico:</strong> Para ver su agenda
              personalizada
            </li>
            <li>
              ✓ <strong>Horarios calculados:</strong> Automáticos, 15 min por
              trámite
            </li>
            <li>
              ✓ <strong>Estado en tiempo real:</strong> Se actualiza cuando
              cliente llega
            </li>
            <li>
              ✓ <strong>Próximo a atender:</strong> Aparece destacado en rojo
            </li>
            <li>
              ✓ <strong>Observaciones:</strong> Información importante del
              cliente
            </li>
            <li>
              💡 <strong>Tiempo entre trámites:</strong> Calcula tu tiempo para
              alistar carpetas
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}