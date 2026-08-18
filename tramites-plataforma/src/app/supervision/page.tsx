"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { formatDate, getStatusTone, useTramitesStore } from "@/lib/tramites-store";

type TechnicianViewMode = 
  | "calendario-semanal" 
  | "tabla-por-fecha" 
  | "tarjetas-fecha" 
  | "lista-simple" 
  | "cronograma";

export default function TechnicianSchedulePage() {
  const { entries, technicians } = useTramitesStore();
  const [viewMode, setViewMode] = useState<TechnicianViewMode>("tabla-por-fecha");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(technicians[0]?.id || "");
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const selectedTechnician = useMemo(
    () => technicians.find((t) => t.id === selectedTechnicianId),
    [selectedTechnicianId, technicians]
  );

  // Obtener trámites del técnico seleccionado
  const technicianEntries = useMemo(
    () => entries.filter((e) => e.technicianId === selectedTechnicianId),
    [entries, selectedTechnicianId]
  );

  // Agrupar por fecha programada
  const entriesByScheduleDate = useMemo(() => {
    const map = new Map<string, typeof entries>();
    
    for (const entry of technicianEntries) {
      if (!map.has(entry.scheduleDate)) {
        map.set(entry.scheduleDate, []);
      }
      map.get(entry.scheduleDate)!.push(entry);
    }

    return Array.from(map.entries())
      .map(([date, dateEntries]) => ({
        date,
        entries: dateEntries.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        total: dateEntries.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [technicianEntries]);

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  // ==================== VISTA 1: TABLA POR FECHA ====================
  const TablasPorFecha = () => (
    <div className="space-y-4">
      {entriesByScheduleDate.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
          No hay trámites asignados a este técnico.
        </div>
      ) : (
        entriesByScheduleDate.map(({ date, entries: dateEntries }) => (
          <div key={date} className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            {/* Header colapsable */}
            <button
              onClick={() => toggleDate(date)}
              className="w-full px-6 py-4 text-left hover:bg-white/10 transition flex items-center justify-between border-b border-white/10"
            >
              <div>
                <div className="text-lg font-semibold text-white">
                  📅 {formatDate(date)}
                </div>
                <div className="text-sm text-white/55">
                  {dateEntries.length} trámite{dateEntries.length !== 1 ? "s" : ""}
                </div>
              </div>
              <span
                className={`text-white/70 transition transform ${
                  expandedDates[date] ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>

            {/* Tabla expandible */}
            {expandedDates[date] && (
              <div>
                <div className="grid grid-cols-5 gap-4 border-b border-white/10 px-6 py-3 text-xs uppercase tracking-[0.18em] text-white/55 bg-white/5">
                  <span>Registro</span>
                  <span>Trámite</span>
                  <span>Usuaria</span>
                  <span>Observaciones</span>
                  <span>Estado</span>
                </div>
                <div className="divide-y divide-white/10">
                  {dateEntries.map((entry) => (
                    <div key={entry.id} className="grid grid-cols-5 gap-4 px-6 py-4 text-sm hover:bg-white/5 transition">
                      <div className="font-semibold text-white">{entry.registrationNumber}</div>
                      <div className="text-white/75">{entry.tramiteCode}</div>
                      <div className="text-white/75">{entry.createdByName}</div>
                      <div className="text-white/75 truncate">{entry.observations || "—"}</div>
                      <div>
                        <span className={`inline-block rounded-full border px-2 py-1 text-xs font-semibold ${getStatusTone(entry.status)}`}>
                          {entry.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  // ==================== VISTA 2: TARJETAS POR FECHA ====================
  const TarjetasPorFecha = () => (
    <div className="space-y-6">
      {entriesByScheduleDate.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
          No hay trámites asignados a este técnico.
        </div>
      ) : (
        entriesByScheduleDate.map(({ date, entries: dateEntries }) => (
          <div key={date}>
            <div className="mb-4">
              <h3 className="text-2xl font-semibold text-white">
                📅 {formatDate(date)}
              </h3>
              <p className="text-sm text-white/55 mt-1">
                {dateEntries.length} trámite{dateEntries.length !== 1 ? "s" : ""} programado{dateEntries.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dateEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
                >
                  <div className="space-y-3">
                    {/* Registro */}
                    <div>
                      <div className="text-xs text-white/55 uppercase tracking-widest">Registro</div>
                      <div className="text-lg font-bold text-white">{entry.registrationNumber}</div>
                    </div>

                    {/* Trámite */}
                    <div>
                      <div className="text-xs text-white/55 uppercase tracking-widest">Código Trámite</div>
                      <div className="text-base font-semibold text-white/75">{entry.tramiteCode}</div>
                    </div>

                    {/* Usuaria */}
                    <div>
                      <div className="text-xs text-white/55 uppercase tracking-widest">Registrada por</div>
                      <div className="text-sm text-white/75">{entry.createdByName}</div>
                    </div>

                    {/* Observaciones */}
                    {entry.observations && (
                      <div>
                        <div className="text-xs text-white/55 uppercase tracking-widest">Notas</div>
                        <div className="text-sm text-white/75 line-clamp-2">{entry.observations}</div>
                      </div>
                    )}

                    {/* Estado */}
                    <div className="pt-2 border-t border-white/10">
                      <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(entry.status)}`}>
                        {entry.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ==================== VISTA 3: LISTA SIMPLE COMPACTA ====================
  const ListaSimple = () => (
    <div className="space-y-3">
      {technicianEntries.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
          No hay trámites asignados a este técnico.
        </div>
      ) : (
        technicianEntries
          .sort((a, b) => a.scheduleDate.localeCompare(b.scheduleDate))
          .map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between hover:bg-white/10 transition"
            >
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">
                  {entry.registrationNumber} • {entry.tramiteCode}
                </div>
                <div className="text-xs text-white/55 mt-1">
                  📅 {formatDate(entry.scheduleDate)} • {entry.createdByName}
                </div>
              </div>
              <span className={`inline-block rounded-full border px-2 py-1 text-xs font-semibold ${getStatusTone(entry.status)}`}>
                {entry.status}
              </span>
            </div>
          ))
      )}
    </div>
  );

  // ==================== VISTA 4: CRONOGRAMA VISUAL ====================
  const Cronograma = () => {
    // Obtener rango de fechas
    const allDates = entriesByScheduleDate.map((g) => g.date);
    const minDate = allDates.length > 0 ? allDates[0] : new Date().toISOString().slice(0, 10);
    const maxDate = allDates.length > 0 ? allDates[allDates.length - 1] : new Date().toISOString().slice(0, 10);

    return (
      <div className="space-y-4">
        {entriesByScheduleDate.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
            No hay trámites asignados a este técnico.
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="space-y-4">
              {entriesByScheduleDate.map(({ date, entries: dateEntries }) => {
                const statusCounts = {
                  "Registrado": dateEntries.filter((e) => e.status === "Registrado").length,
                  "En revisión": dateEntries.filter((e) => e.status === "En revisión").length,
                  "Aprobado": dateEntries.filter((e) => e.status === "Aprobado").length,
                };

                return (
                  <div key={date} className="border-b border-white/10 pb-4 last:border-b-0">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-lg font-semibold text-white">{formatDate(date)}</div>
                        <div className="text-sm text-white/55">Total: {dateEntries.length}</div>
                      </div>
                      <div className="text-3xl font-bold text-white">{dateEntries.length}</div>
                    </div>

                    {/* Barra de progreso por estado */}
                    <div className="flex gap-1 h-8 rounded-full overflow-hidden bg-white/10">
                      {statusCounts["Registrado"] > 0 && (
                        <div
                          className="bg-slate-500 flex items-center justify-center text-white text-xs font-bold"
                          style={{
                            width: `${(statusCounts["Registrado"] / dateEntries.length) * 100}%`,
                          }}
                          title={`${statusCounts["Registrado"]} Registrado`}
                        >
                          {statusCounts["Registrado"] > 1 && statusCounts["Registrado"]}
                        </div>
                      )}
                      {statusCounts["En revisión"] > 0 && (
                        <div
                          className="bg-amber-500 flex items-center justify-center text-white text-xs font-bold"
                          style={{
                            width: `${(statusCounts["En revisión"] / dateEntries.length) * 100}%`,
                          }}
                          title={`${statusCounts["En revisión"]} En revisión`}
                        >
                          {statusCounts["En revisión"] > 1 && statusCounts["En revisión"]}
                        </div>
                      )}
                      {statusCounts["Aprobado"] > 0 && (
                        <div
                          className="bg-emerald-500 flex items-center justify-center text-white text-xs font-bold"
                          style={{
                            width: `${(statusCounts["Aprobado"] / dateEntries.length) * 100}%`,
                          }}
                          title={`${statusCounts["Aprobado"]} Aprobado`}
                        >
                          {statusCounts["Aprobado"] > 1 && statusCounts["Aprobado"]}
                        </div>
                      )}
                    </div>

                    {/* Leyenda */}
                    <div className="flex gap-4 mt-3 text-xs text-white/70">
                      {statusCounts["Registrado"] > 0 && (
                        <div>🔵 Registrado: {statusCounts["Registrado"]}</div>
                      )}
                      {statusCounts["En revisión"] > 0 && (
                        <div>🟡 En revisión: {statusCounts["En revisión"]}</div>
                      )}
                      {statusCounts["Aprobado"] > 0 && (
                        <div>🟢 Aprobado: {statusCounts["Aprobado"]}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== VISTA 5: CALENDARIO SEMANAL ====================
  const CalendarioSemanal = () => {
    // Obtener la semana actual
    const today = new Date();
    const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(firstDay);
      date.setDate(date.getDate() + i);
      return date.toISOString().slice(0, 10);
    });

    const weekDaysSpanish = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, index) => {
            const dayEntries = technicianEntries.filter((e) => e.scheduleDate === date);
            const today = new Date().toISOString().slice(0, 10);
            const isToday = date === today;

            return (
              <div
                key={date}
                className={`rounded-2xl border p-4 ${
                  isToday
                    ? "border-white bg-white/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                } transition`}
              >
                <div className="text-center">
                  <div className="text-xs font-semibold text-white/70 uppercase">
                    {weekDaysSpanish[index]}
                  </div>
                  <div className={`text-2xl font-bold ${isToday ? "text-white" : "text-white/70"}`}>
                    {new Date(date).getDate()}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="text-2xl font-bold text-white">{dayEntries.length}</div>
                    <div className="text-xs text-white/55 mt-1">
                      trámite{dayEntries.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-white mb-4">Detalle de esta semana</h3>
          {technicianEntries.filter((e) => {
            const entryDate = new Date(e.scheduleDate);
            return entryDate >= new Date(weekDates[0]) && entryDate <= new Date(weekDates[6]);
          }).length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
              No hay trámites esta semana.
            </div>
          ) : (
            <div className="space-y-2">
              {technicianEntries
                .filter((e) => {
                  const entryDate = new Date(e.scheduleDate);
                  return entryDate >= new Date(weekDates[0]) && entryDate <= new Date(weekDates[6]);
                })
                .sort((a, b) => a.scheduleDate.localeCompare(b.scheduleDate))
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center justify-between hover:bg-white/10 transition"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">
                        {entry.registrationNumber} • {entry.tramiteCode}
                      </div>
                      <div className="text-xs text-white/55">
                        {formatDate(entry.scheduleDate)} • {entry.createdByName}
                      </div>
                    </div>
                    <span className={`inline-block rounded-full border px-2 py-1 text-xs font-semibold ${getStatusTone(entry.status)}`}>
                      {entry.status}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppShell
      title="Mi Agenda de Trámites"
      description="Visualiza los trámites asignados a ti organizados por fecha programada"
      eyebrow="Técnico"
    >
      <section className="grid gap-6">
        {/* Controles */}
        <article className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <h2 className="font-serif text-3xl text-[#1a140d]">Selecciona tu vista</h2>
          <p className="mt-2 text-sm leading-6 text-black/70">
            Elige cómo quieres ver tus trámites programados y selecciona tu nombre.
          </p>

          <div className="mt-6 grid gap-4">
          
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                Técnico
              </span>
              <select
                value={selectedTechnicianId}
                onChange={(e) => setSelectedTechnicianId(e.target.value)}
                className="rounded-2xl border border-black/10 bg-[#fcfcfb] px-4 py-3 outline-none transition focus:ring-2 focus:ring-[#151515]/15"
              >
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name} ({tech.areaLabel})
                  </option>
                ))}
              </select>
            </label>

           
            <div className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                Tipo de vista
              </span>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
                {(
                  [
                    { id: "tabla-por-fecha", label: "Tabla" },
                    { id: "tarjetas-fecha", label: "Tarjetas" },
                    { id: "lista-simple", label: "Lista" },
                    { id: "cronograma", label: "Cronograma" },
                    { id: "calendario-semanal", label: "Calendario" },
                  ] as const
                ).map((view) => (
                  <button
                    key={view.id}
                    onClick={() => setViewMode(view.id as TechnicianViewMode)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      viewMode === view.id
                        ? "border-[#1a140d] bg-[#1a140d] text-white"
                        : "border-black/10 bg-[#fcfcfb] text-[#1a140d] hover:bg-black/5"
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4 text-sm text-black/70">
              Total de trámites: <strong className="text-black">{technicianEntries.length}</strong>
            </div>
          </div>
        </article>

       
        {selectedTechnician && (
          <article className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-[#1a140d]">{selectedTechnician.name}</h3>
                <p className="text-sm text-black/70 mt-1">Área: {selectedTechnician.areaLabel}</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-[#1a140d]">{technicianEntries.length}</div>
                <p className="text-sm text-black/70">trámites asignados</p>
              </div>
            </div>
          </article>
        )}

    
        <article className="rounded-4xl border border-black/10 bg-[#151515] p-6 text-white shadow-[0_16px_40px_rgba(17,17,17,0.16)]">
          {viewMode === "tabla-por-fecha" && <TablasPorFecha />}
          {viewMode === "tarjetas-fecha" && <TarjetasPorFecha />}
          {viewMode === "lista-simple" && <ListaSimple />}
          {viewMode === "cronograma" && <Cronograma />}
          {viewMode === "calendario-semanal" && <CalendarioSemanal />}
        </article>
      </section>
    </AppShell>
  );
}
