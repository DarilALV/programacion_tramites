"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { useTramitesStore } from "@/lib/tramites-store";

export default function SeguimientosPage() {
  const [tramiteCode, setTramiteCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [supervisorNotes, setSupervisorNotes] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");

  const { entries, updateEntry } = useTramitesStore();

  // Obtener programaciones de hoy
  const today = new Date().toISOString().slice(0, 10);
  const todayProgrammations = useMemo(() => {
    return entries.filter((e) => e.scheduleDate === today);
  }, [entries]);

  // Programaciones sin seguimiento registrado aún
  const pendingFollowUps = useMemo(() => {
    return todayProgrammations.filter((e) => !e.followUp);
  }, [todayProgrammations]);

  // Seguimientos ya registrados
  const registeredFollowUps = useMemo(() => {
    return todayProgrammations.filter((e) => e.followUp);
  }, [todayProgrammations]);

  // Buscar trámite por código
  const selectedTramite = useMemo(() => {
    if (!tramiteCode.trim()) return null;
    return pendingFollowUps.find((e) => e.tramiteCode === tramiteCode);
  }, [tramiteCode, pendingFollowUps]);

  // Carga de técnicos/supervisores con mini lista de trámites
  const technicianLoad = useMemo(() => {
    const load: Record<
      string,
      {
        name: string;
        type: "technician" | "supervisor";
        total: number;
        registered: number;
        pending: number;
        tramites: Array<{
          code: string;
          registration: string;
          status: "registered" | "pending";
        }>;
      }
    > = {};

    todayProgrammations.forEach((entry) => {
      if (!load[entry.technicianId]) {
        load[entry.technicianId] = {
          name: entry.technicianName,
          type: "technician", // Puedes detectar supervisor si lo necesitas
          total: 0,
          registered: 0,
          pending: 0,
          tramites: [],
        };
      }

      load[entry.technicianId].total += 1;

      const tramiteStatus = entry.followUp ? "registered" : "pending";

      load[entry.technicianId].tramites.push({
        code: entry.tramiteCode,
        registration: entry.registrationNumber,
        status: tramiteStatus,
      });

      if (entry.followUp) {
        load[entry.technicianId].registered += 1;
      } else {
        load[entry.technicianId].pending += 1;
      }
    });

    return load;
  }, [todayProgrammations]);

  // Registrar llegada
  const handleRegisterArrival = () => {
    if (!tramiteCode.trim()) {
      setMessageType("error");
      setMessage("⚠️ Ingresa el número de trámite");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    if (!clientName.trim()) {
      setMessageType("error");
      setMessage("⚠️ Ingresa el nombre de quién lo deja");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    if (!selectedTramite) {
      setMessageType("error");
      setMessage("❌ No se encontró el trámite programado para hoy");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    // Registrar la hora actual como hora de llegada
    const currentTime = new Date();
    const hours = String(currentTime.getHours()).padStart(2, "0");
    const minutes = String(currentTime.getMinutes()).padStart(2, "0");
    const arrivalTime = `${hours}:${minutes}`;

    // Actualizar entrada con seguimiento
    updateEntry(selectedTramite.id, {
      ...selectedTramite,
      followUp: {
        clientName,
        arrivalTime,
        observations: supervisorNotes,
        createdAt: new Date().toISOString(),
      },
    });

    setMessageType("success");
    setMessage(
      `✅ Trámite ${tramiteCode} registrado - Técnico: ${selectedTramite.technicianName}`
    );

    // Limpiar formulario
    setTramiteCode("");
    setClientName("");
    setSupervisorNotes("");

    setTimeout(() => setMessage(""), 3000);
  };

  // Manejar Enter en inputs
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRegisterArrival();
    }
  };

  return (
    <AppShell
      title="Registro de Llegadas"
      description="Registra cuándo llegan los clientes con sus trámites"
      eyebrow="SEGUIMIENTOS"
    >
      <div className="space-y-6">
        {/* SECCIÓN 1: FORMULARIO */}
        <section className="rounded-4xl border-2 border-pink-200 bg-pink-50 p-6 space-y-4">
          <h2 className="text-2xl font-bold">Registrar Llegada</h2>

          {message && (
            <div
              className={`p-4 rounded-lg text-sm font-medium ${
                messageType === "success"
                  ? "bg-green-100 text-green-800 border border-green-300"
                  : messageType === "error"
                  ? "bg-red-100 text-red-800 border border-red-300"
                  : "bg-blue-100 text-blue-800 border border-blue-300"
              }`}
            >
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Número de Trámite */}
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">
                Número de Trámite / Código *
              </span>
              <input
                type="text"
                value={tramiteCode}
                onChange={(e) => setTramiteCode(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ej: 2026016618"
                autoFocus
                className="rounded-lg border-2 border-pink-300 px-4 py-3 text-lg font-semibold focus:border-pink-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500">
                Hay {pendingFollowUps.length} trámites pendientes para hoy
              </p>
            </label>

            {/* Técnico Asignado (Auto-detectado) */}
            {selectedTramite && (
              <div className="grid gap-2 md:col-span-2 rounded-lg bg-blue-50 border-2 border-blue-200 p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  ✓ Trámite encontrado
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Técnico Asignado</p>
                    <p className="text-lg font-bold text-blue-900">
                      {selectedTramite.technicianName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Registro</p>
                    <p className="text-lg font-bold text-blue-900">
                      {selectedTramite.registrationNumber}
                    </p>
                  </div>
                  {selectedTramite.observations && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-600">Observaciones Programación</p>
                      <p className="text-sm text-gray-800">
                        "{selectedTramite.observations}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tramiteCode && !selectedTramite && (
              <div className="grid gap-2 md:col-span-2 rounded-lg bg-red-50 border-2 border-red-200 p-4">
                <p className="text-sm font-semibold text-red-800">
                  ❌ Trámite no encontrado para hoy
                </p>
              </div>
            )}

            {/* Nombre de quien lo deja */}
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">
                Nombre de Quién lo Deja *
              </span>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ej: Juan Pérez"
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none"
              />
            </label>

            {/* Observaciones del Supervisor (Opcional) */}
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">
                Observaciones Supervisor (Opcional)
              </span>
              <textarea
                value={supervisorNotes}
                onChange={(e) => setSupervisorNotes(e.target.value)}
                placeholder="Ej: Cliente pidió cambiar de técnico, documento incompleto, etc."
                rows={2}
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none"
              />
            </label>
          </div>

          {/* Botón Registrar */}
          <button
            onClick={handleRegisterArrival}
            disabled={!selectedTramite || !clientName.trim()}
            className={`w-full rounded-lg px-6 py-3 font-semibold text-white transition shadow-md text-lg ${
              selectedTramite && clientName.trim()
                ? "bg-pink-600 hover:bg-pink-700 cursor-pointer"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            ✅ Registrar Llegada
          </button>
        </section>

        {/* SECCIÓN 2: CARGA DE TÉCNICOS CON MINI LISTA */}
        <section className="rounded-4xl border-2 border-pink-200 p-6">
          <h2 className="text-2xl font-bold mb-4">Técnicos/Supervisores - Hoy</h2>

          {Object.entries(technicianLoad).length === 0 ? (
            <p className="text-gray-500">No hay técnicos/supervisores con programaciones hoy</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {Object.entries(technicianLoad).map(([techId, data]) => {
                // Determinar color según carga
                let bgColor = "bg-green-50";
                let borderColor = "border-green-300";
                let statusText = "📌 Disponible";

                if (data.pending > 0) {
                  if (data.pending >= 3) {
                    bgColor = "bg-red-50";
                    borderColor = "border-red-300";
                    statusText = "🔴 Mucha carga";
                  } else if (data.pending >= 1) {
                    bgColor = "bg-amber-50";
                    borderColor = "border-amber-300";
                    statusText = "🟠 Algo de carga";
                  }
                }

                return (
                  <div
                    key={techId}
                    className={`rounded-lg border-2 p-4 ${bgColor} ${borderColor}`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Resumen izquierda */}
                      <div>
                        <p className="font-bold text-lg text-gray-800">{data.name}</p>

                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Total hoy:</span>
                            <span className="font-semibold">{data.total}</span>
                          </div>

                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Atendidos:</span>
                            <span className="font-semibold text-green-700">
                              {data.registered}
                            </span>
                          </div>

                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Pendientes:</span>
                            <span className="font-semibold text-amber-700">
                              {data.pending}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                          <p className="text-xs font-semibold">{statusText}</p>
                        </div>
                      </div>

                      {/* Mini tabla de trámites derecha */}
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase mb-2">
                          Trámites Asignados
                        </p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {data.tramites.map((tramite) => (
                            <div
                              key={tramite.code}
                              className={`text-xs px-2 py-1 rounded flex justify-between items-center ${
                                tramite.status === "registered"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              <span className="font-mono font-semibold">{tramite.code}</span>
                              <span className="text-xs">
                                {tramite.status === "registered" ? "✓" : "⏳"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECCIÓN 3: LISTA DE LLEGADAS */}
        <section className="rounded-4xl border-2 border-pink-200 overflow-hidden">
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-6 py-4">
            <h2 className="text-2xl font-bold">
              Trámites Registrados - Hoy
              <span className="text-sm font-normal ml-2">({registeredFollowUps.length})</span>
            </h2>
          </div>

          {registeredFollowUps.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <p>Aún no hay trámites registrados para hoy</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-pink-100 border-b-2 border-pink-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Código</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Registro</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Hora Llegada</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Persona</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Técnico</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Tiempo Pendiente</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registeredFollowUps
                    .sort((a, b) => {
                      // Ordenar por hora de llegada (más recientes primero)
                      const timeA = a.followUp?.arrivalTime || "00:00";
                      const timeB = b.followUp?.arrivalTime || "00:00";
                      return timeB.localeCompare(timeA);
                    })
                    .map((entry, index) => {
                      // Calcular tiempo desde que llegó
                      const arrivalTime = entry.followUp?.arrivalTime;
                      let timePending = "—";

                      if (arrivalTime) {
                        const [arrHours, arrMinutes] = arrivalTime
                          .split(":")
                          .map(Number);
                        const arrival = new Date();
                        arrival.setHours(arrHours, arrMinutes, 0);

                        const now = new Date();
                        const diffMinutes = Math.round(
                          (now.getTime() - arrival.getTime()) / 60000
                        );

                        if (diffMinutes < 0) {
                          timePending = "Aún no llega";
                        } else if (diffMinutes === 0) {
                          timePending = "Acaba de llegar";
                        } else if (diffMinutes < 60) {
                          timePending = `${diffMinutes} min`;
                        } else {
                          const hours = Math.floor(diffMinutes / 60);
                          const mins = diffMinutes % 60;
                          timePending = `${hours}h ${mins}m`;
                        }
                      }

                      return (
                        <tr
                          key={entry.id}
                          className={index % 2 === 0 ? "bg-pink-50" : "bg-white"}
                        >
                          <td className="px-4 py-3 text-sm font-semibold">
                            {entry.tramiteCode}
                          </td>
                          <td className="px-4 py-3 text-sm">{entry.registrationNumber}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-pink-600">
                            {entry.followUp?.arrivalTime}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {entry.followUp?.clientName}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold">
                            {entry.technicianName}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                timePending.includes("Aún") || timePending.includes("Acaba")
                                  ? "bg-green-100 text-green-800"
                                  : timePending.includes("min") && parseInt(timePending) > 30
                                  ? "bg-amber-100 text-amber-800"
                                  : timePending.includes("min") && parseInt(timePending) > 60
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {timePending}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {entry.followUp?.observations ? (
                              <span className="text-gray-700">
                                "{entry.followUp.observations}"
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
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

        {/* SECCIÓN 4: INFORMACIÓN ÚTIL */}
        <section className="rounded-4xl border-2 border-blue-200 bg-blue-50 p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3">ℹ️ Información Útil</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>
              ✓ <strong>Ingresa Código:</strong> Sistema busca automáticamente el trámite
            </li>
            <li>
              ✓ <strong>Técnico Auto-detectado:</strong> Se muestra automáticamente quién
              está asignado
            </li>
            <li>
              ✓ <strong>Observaciones:</strong> Agrega notas si el cliente pide algo especial
            </li>
            <li>
              ✓ <strong>Hora Auto-registrada:</strong> Se guarda la hora actual
            </li>
            <li>
              ✓ <strong>Mini Lista:</strong> Ve todos los trámites asignados a cada técnico
            </li>
            <li>
              ✓ <strong>Carga en Tiempo Real:</strong> Sabrás quién está saturado
            </li>
            <li>
              💡 <strong>Estado del Trámite:</strong> ✓ = Llegó, ⏳ = Aún no llega
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}