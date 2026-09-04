"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { formatDate, getStatusTone, useTramitesStore } from "@/lib/tramites-store";
import { Search, X, Info, Download, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from 'xlsx';

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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<typeof entries[0] | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

  const selectedTechnician = useMemo(
    () => technicians.find((t) => t.id === selectedTechnicianId),
    [selectedTechnicianId, technicians]
  );

  // Obtener trámites del técnico seleccionado y aplicar filtros
  const filteredTechnicianEntries = useMemo(() => {
    let filtered = entries.filter((e) => e.technicianId === selectedTechnicianId);

    // Filtro de búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.registrationNumber.toLowerCase().includes(term) ||
          e.tramiteCode.toLowerCase().includes(term) ||
          e.observations.toLowerCase().includes(term) ||
          e.technicianName.toLowerCase().includes(term)
      );
    }

    // Filtro de fechas
    if (filterFromDate) {
      filtered = filtered.filter((e) => e.scheduleDate >= filterFromDate);
    }
    if (filterToDate) {
      filtered = filtered.filter((e) => e.scheduleDate <= filterToDate);
    }

    return filtered;
  }, [entries, selectedTechnicianId, searchTerm, filterFromDate, filterToDate]);

  // Agrupar por fecha programada (ORDENADO DESCENDENTE)
  const entriesByScheduleDate = useMemo(() => {
    const map = new Map<string, typeof entries>();
    
    for (const entry of filteredTechnicianEntries) {
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
      .sort((a, b) => b.date.localeCompare(a.date)); // ✅ DESCENDENTE (próximas primero)
  }, [filteredTechnicianEntries]);

  // Estadísticas de la agenda
  const stats = useMemo(() => {
    return {
      total: filteredTechnicianEntries.length,
      registrado: filteredTechnicianEntries.filter((e) => e.status === "Registrado").length,
      enRevision: filteredTechnicianEntries.filter((e) => e.status === "En revisión").length,
      aprobado: filteredTechnicianEntries.filter((e) => e.status === "Aprobado").length,
    };
  }, [filteredTechnicianEntries]);

  // Exportar a Excel
 const exportToExcel = () => {
  // Preparar datos
  const data = filteredTechnicianEntries
    .sort((a, b) => b.scheduleDate.localeCompare(a.scheduleDate))
    .map((entry) => ({
      "Fecha Programación": entry.scheduleDate,
      "Número Registro": entry.registrationNumber,
      "Código Trámite": entry.tramiteCode,
      "Creado por": entry.createdByName,
      "Técnico": entry.technicianName,
      "Área": entry.technicianArea,
      "Estado": entry.status,
      "Observaciones": entry.observations || "",
    }));

  if (data.length === 0) {
    alert("No hay datos para exportar");
    return;
  }

  // Crear worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Ajustar ancho de columnas
  worksheet['!cols'] = [
    { wch: 18 }, // Fecha Programación
    { wch: 16 }, // Número Registro
    { wch: 15 }, // Código Trámite
    { wch: 16 }, // Creado por
    { wch: 16 }, // Técnico
    { wch: 14 }, // Área
    { wch: 15 }, // Estado
    { wch: 35 }, // Observaciones
  ];

  // ==================== APLICAR FORMATO A ENCABEZADOS ====================
  // Colores profesionales
  const headerStyle = {
    fill: { fgColor: { rgb: "1a1a1a" } },        // Fondo oscuro
    font: { bold: true, color: { rgb: "FFFFFF" } }, // Texto blanco y negrita
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
  };

  // Obtener los headers (A1, B1, C1, D1, etc.)
  const headerCells = ["A", "B", "C", "D", "E", "F", "G", "H"];
  headerCells.forEach((cell) => {
    const cellRef = `${cell}1`;
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = headerStyle;
    }
  });

  // ==================== APLICAR FORMATO A DATOS ====================
  // Estilo para datos (alternado, bordes)
  const dataStyle = {
    alignment: { horizontal: "left", vertical: "top", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "D3D3D3" } },
      bottom: { style: "thin", color: { rgb: "D3D3D3" } },
      left: { style: "thin", color: { rgb: "D3D3D3" } },
      right: { style: "thin", color: { rgb: "D3D3D3" } },
    },
  };

  // Aplicar a todas las filas
  for (let i = 2; i <= data.length + 1; i++) {
    for (let j = 0; j < headerCells.length; j++) {
      const cellRef = `${headerCells[j]}${i}`;
      if (worksheet[cellRef]) {
        worksheet[cellRef].s = dataStyle;
      }
    }
  }

  // Crear workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Trámites");

  // Descargar archivo
  XLSX.writeFile(
    workbook,
    `agenda_${selectedTechnician?.name || 'tramites'}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
};


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
          No hay trámites con los criterios de búsqueda.
        </div>
      ) : (
        entriesByScheduleDate.map(({ date, entries: dateEntries }) => (
          <div key={date} className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
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
                    <button
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className="w-full grid grid-cols-5 gap-4 px-6 py-4 text-sm hover:bg-white/5 transition text-left"
                    >
                      <div className="font-semibold text-white">{entry.registrationNumber}</div>
                      <div className="text-white/75">{entry.tramiteCode}</div>
                      <div className="text-white/75">{entry.createdByName}</div>
                      <div className="text-white/75 truncate">{entry.observations || "—"}</div>
                      <div>
                        <span className={`inline-block rounded-full border px-2 py-1 text-xs font-semibold ${getStatusTone(entry.status)}`}>
                          {entry.status}
                        </span>
                      </div>
                    </button>
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
          No hay trámites con los criterios de búsqueda.
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
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition text-left"
                >
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-white/55 uppercase tracking-widest">Registro</div>
                      <div className="text-lg font-bold text-white">{entry.registrationNumber}</div>
                    </div>

                    <div>
                      <div className="text-xs text-white/55 uppercase tracking-widest">Código Trámite</div>
                      <div className="text-base font-semibold text-white/75">{entry.tramiteCode}</div>
                    </div>

                    <div>
                      <div className="text-xs text-white/55 uppercase tracking-widest">Registrada por</div>
                      <div className="text-sm text-white/75">{entry.createdByName}</div>
                    </div>

                    {entry.observations && (
                      <div>
                        <div className="text-xs text-white/55 uppercase tracking-widest">Notas</div>
                        <div className="text-sm text-white/75 line-clamp-2">{entry.observations}</div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(entry.status)}`}>
                        {entry.status}
                      </span>
                      <Info size={16} className="text-white/50" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ==================== VISTA 3: LISTA SIMPLE COMPACTA ====================
  const ListaSimple = () => {
    const paginatedEntries = filteredTechnicianEntries
      .sort((a, b) => b.scheduleDate.localeCompare(a.scheduleDate))
      .slice((page - 1) * itemsPerPage, page * itemsPerPage);

    const totalPages = Math.ceil(filteredTechnicianEntries.length / itemsPerPage);

    return (
      <div className="space-y-3">
        {filteredTechnicianEntries.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
            No hay trámites con los criterios de búsqueda.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedEntries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between hover:bg-white/10 transition w-full"
                >
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold text-white">
                      {entry.registrationNumber} • {entry.tramiteCode}
                    </div>
                    <div className="text-xs text-white/55 mt-1">
                      📅 {formatDate(entry.scheduleDate)} • {entry.createdByName}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-block rounded-full border px-2 py-1 text-xs font-semibold ${getStatusTone(entry.status)}`}>
                      {entry.status}
                    </span>
                    <Info size={16} className="text-white/50" />
                  </div>
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-white/70">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ==================== VISTA 4: CRONOGRAMA VISUAL ====================
  const Cronograma = () => {
    return (
      <div className="space-y-4">
        {entriesByScheduleDate.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
            No hay trámites con los criterios de búsqueda.
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
    const today = new Date();
    const firstDay = new Date(today);
    firstDay.setDate(today.getDate() - today.getDay() + (weekOffset * 7));
    
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(firstDay);
      date.setDate(date.getDate() + i);
      return date.toISOString().slice(0, 10);
    });

    const weekDaysSpanish = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="p-2 rounded-lg border border-white/10 hover:bg-white/10"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <div className="text-sm text-white/70">
              Semana del {formatDate(weekDates[0])} al {formatDate(weekDates[6])}
            </div>
          </div>
          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="p-2 rounded-lg border border-white/10 hover:bg-white/10"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, index) => {
            const dayEntries = filteredTechnicianEntries.filter((e) => e.scheduleDate === date);
            const todayDate = new Date().toISOString().slice(0, 10);
            const isToday = date === todayDate;

            return (
              <div
                key={date}
                className={`rounded-2xl border p-4 ${
                  isToday
                    ? "border-white bg-white/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                } transition cursor-pointer`}
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
          {filteredTechnicianEntries.filter((e) => {
            const entryDate = new Date(e.scheduleDate);
            return entryDate >= new Date(weekDates[0]) && entryDate <= new Date(weekDates[6]);
          }).length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
              No hay trámites esta semana.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTechnicianEntries
                .filter((e) => {
                  const entryDate = new Date(e.scheduleDate);
                  return entryDate >= new Date(weekDates[0]) && entryDate <= new Date(weekDates[6]);
                })
                .sort((a, b) => a.scheduleDate.localeCompare(b.scheduleDate))
                .map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center justify-between hover:bg-white/10 transition w-full"
                  >
                    <div className="flex-1 text-left">
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
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==================== MODAL DE DETALLES ====================
  const DetallesModal = () => {
    if (!selectedEntry) return null;

    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-[#1a1a1a] rounded-4xl border border-white/10 p-8 max-w-2xl w-full max-h-96 overflow-y-auto">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-3xl font-bold text-white">{selectedEntry.registrationNumber}</h3>
              <p className="text-white/70 mt-2">Código: {selectedEntry.tramiteCode}</p>
            </div>
            <button
              onClick={() => setSelectedEntry(null)}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <X size={24} className="text-white" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Registrada por</div>
                <div className="text-white font-semibold">{selectedEntry.createdByName}</div>
              </div>
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Técnico</div>
                <div className="text-white font-semibold">{selectedEntry.technicianName}</div>
              </div>
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Área</div>
                <div className="text-white font-semibold">{selectedEntry.technicianArea}</div>
              </div>
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Estado</div>
                <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(selectedEntry.status)}`}>
                  {selectedEntry.status}
                </span>
              </div>
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Fecha Programada</div>
                <div className="text-white font-semibold">{formatDate(selectedEntry.scheduleDate)}</div>
              </div>
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Fecha Registro</div>
                <div className="text-white font-semibold">{formatDate(selectedEntry.registrationDate)}</div>
              </div>
            </div>

            {selectedEntry.observations && (
              <div className="border-t border-white/10 pt-4">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Observaciones</div>
                <div className="text-white/80 bg-white/5 p-3 rounded-lg">{selectedEntry.observations}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <AppShell
      title="Lista de programaciones"
      description="Visualiza los trámites asignados a ti organizados por fecha programada"
      eyebrow="PROGRAMACIONES"
    >
      {/* Botón flotante a reportes de supervisión */}
      <div className="mb-6 flex justify-end">
        <Link
          href="/supervision/reportes"
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 transition cursor-pointer shadow-lg"
        >
          📊 Ver Reportes de Supervisión
        </Link>
      </div>

      <section className="grid gap-6">
        {/* Controles */}
        <article className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <h2 className="font-serif text-3xl text-[#1a140d]">PROGRAMACIONES</h2>
          <p className="mt-2 text-sm leading-6 text-black/70">
            Elige cómo quieres ver tus trámites programados.
          </p>

          <div className="mt-6 grid gap-4">
            {/* Selector de técnico */}
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

            {/* Buscador */}
            <div className="relative">
              <Search size={18} className="absolute left-4 top-3.5 text-black/40" />
              <input
                type="text"
                placeholder="Buscar por código, registro u observaciones..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 rounded-2xl border border-black/10 bg-[#fcfcfb] outline-none transition focus:ring-2 focus:ring-[#151515]/15"
              />
            </div>

            {/* Filtros de fecha */}
            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                  Desde
                </span>
                <input
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => {
                    setFilterFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-2xl border border-black/10 bg-[#fcfcfb] px-4 py-3 outline-none transition focus:ring-2 focus:ring-[#151515]/15"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                  Hasta
                </span>
                <input
                  type="date"
                  value={filterToDate}
                  onChange={(e) => {
                    setFilterToDate(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-2xl border border-black/10 bg-[#fcfcfb] px-4 py-3 outline-none transition focus:ring-2 focus:ring-[#151515]/15"
                />
              </label>
            </div>

            {/* Vistas */}
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
          </div>
        </article>

        {/* Estadísticas */}
        {selectedTechnician && (
          <article className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <div className="rounded-4xl border border-black/10 bg-white p-4 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Total</div>
              <div className="mt-2 text-3xl font-bold text-[#1a140d]">{stats.total}</div>
            </div>
            <div className="rounded-4xl border border-black/10 bg-white p-4 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Registrado</div>
              <div className="mt-2 text-3xl font-bold text-slate-600">{stats.registrado}</div>
            </div>
            <div className="rounded-4xl border border-black/10 bg-white p-4 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">En Revisión</div>
              <div className="mt-2 text-3xl font-bold text-amber-600">{stats.enRevision}</div>
            </div>
            <div className="rounded-4xl border border-black/10 bg-white p-4 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Aprobado</div>
              <div className="mt-2 text-3xl font-bold text-emerald-600">{stats.aprobado}</div>
            </div>
            <button
              onClick={exportToExcel}
              className="rounded-4xl border border-black/10 bg-green-600 text-white p-4 shadow-[0_16px_40px_rgba(26,21,12,0.08)] hover:bg-green-700 transition flex items-center justify-center gap-2"
            >
              <Download size={20} />
              <span className="font-semibold">Exportar</span>
            </button>
          </article>
        )}

        {/* Contenido dinámico */}
        <article className="rounded-4xl border border-black/10 bg-[#151515] p-6 text-white shadow-[0_16px_40px_rgba(17,17,17,0.16)]">
          {viewMode === "tabla-por-fecha" && <TablasPorFecha />}
          {viewMode === "tarjetas-fecha" && <TarjetasPorFecha />}
          {viewMode === "lista-simple" && <ListaSimple />}
          {viewMode === "cronograma" && <Cronograma />}
          {viewMode === "calendario-semanal" && <CalendarioSemanal />}
        </article>
      </section>

      {/* Modal de detalles */}
      <DetallesModal />
    </AppShell>
  );
}
