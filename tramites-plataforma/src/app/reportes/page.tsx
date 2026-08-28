"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { formatDate, plannerUsers, technicians, useTramitesStore } from "@/lib/tramites-store";
import { Download, Filter, X, TrendingUp } from "lucide-react";

export default function ReportesPage() {
  const { entries, groupEntriesByCreator, groupEntriesByTechnician, groupEntriesByDateAndCreator, groupEntriesByDateAndTechnician } =
    useTramitesStore();

  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);

  // Filtrar entries según criterios
  const filteredEntries = useMemo(() => {
    let filtered = entries;

    if (filterFromDate) {
      filtered = filtered.filter((e) => e.registrationDate >= filterFromDate);
    }
    if (filterToDate) {
      filtered = filtered.filter((e) => e.registrationDate <= filterToDate);
    }
    if (selectedCreator) {
      filtered = filtered.filter((e) => e.createdBy === selectedCreator);
    }
    if (selectedTechnician) {
      filtered = filtered.filter((e) => e.technicianId === selectedTechnician);
    }

    return filtered;
  }, [entries, filterFromDate, filterToDate, selectedCreator, selectedTechnician]);

  // Recalcular resúmenes con datos filtrados
  const creatorSummary = useMemo(() => {
    const map = new Map<string, number>();
    plannerUsers.forEach((user) => {
      map.set(user.id, filteredEntries.filter((e) => e.createdBy === user.id).length);
    });
    return plannerUsers.map((user) => ({ user, total: map.get(user.id) ?? 0 }));
  }, [filteredEntries]);

  const technicianSummary = useMemo(() => {
    const map = new Map<string, number>();
    technicians.forEach((tech) => {
      map.set(tech.id, filteredEntries.filter((e) => e.technicianId === tech.id).length);
    });
    return technicians.map((tech) => ({ technician: tech, total: map.get(tech.id) ?? 0 }));
  }, [filteredEntries]);

  // Agrupar por estado
  const summaryByStatus = useMemo(() => {
    const map = new Map<string, number>();
    filteredEntries.forEach((entry) => {
      map.set(entry.status, (map.get(entry.status) ?? 0) + 1);
    });
    return map;
  }, [filteredEntries]);

  // Métricas
  const metrics = useMemo(() => {
    const totalRegistros = filteredEntries.length;
    const totalUsarios = creatorSummary.filter((c) => c.total > 0).length;
    const totalTechnicians = technicianSummary.filter((t) => t.total > 0).length;
    const promedioPorUsuario = totalUsarios > 0 ? (totalRegistros / totalUsarios).toFixed(1) : 0;

    return {
      totalRegistros,
      totalUsarios,
      totalTechnicians,
      promedioPorUsuario,
    };
  }, [creatorSummary, technicianSummary, filteredEntries]);

  // Exportar a Excel
  const exportToExcel = () => {
    const data = filteredEntries.map((entry) => ({
      "Fecha Registro": entry.registrationDate,
      "Número Registro": entry.registrationNumber,
      "Código Trámite": entry.tramiteCode,
      "Creado por": entry.createdByName,
      "Técnico": entry.technicianName,
      "Área": entry.technicianArea,
      "Estado": entry.status,
      "Observaciones": entry.observations,
      "Fecha Programación": entry.scheduleDate,
    }));

    const csv = [
      Object.keys(data[0]).join(","),
      ...data.map((row) =>
        Object.values(row)
          .map((v) => `"${v}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `reportes_tramites_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Exportar resumen a PDF simulado (como texto)
  const exportToText = () => {
    let text = "=== REPORTE DE TRÁMITES ===\n\n";
    text += `Fecha de generación: ${new Date().toLocaleDateString("es-ES")}\n`;
    text += `Rango: ${filterFromDate || "inicio"} a ${filterToDate || "fin"}\n\n`;

    text += "MÉTRICAS GENERALES\n";
    text += "==================\n";
    text += `Total de Registros: ${metrics.totalRegistros}\n`;
    text += `Usuarias Activas: ${metrics.totalUsarios}\n`;
    text += `Técnicos Asignados: ${metrics.totalTechnicians}\n`;
    text += `Promedio por Usuaria: ${metrics.promedioPorUsuario}\n\n`;

    text += "POR ESTADO\n";
    text += "==========\n";
    summaryByStatus.forEach((count, status) => {
      text += `${status}: ${count}\n`;
    });
    text += "\n";

    text += "PRODUCCIÓN POR USUARIA\n";
    text += "====================\n";
    creatorSummary.forEach((item) => {
      text += `${item.user.name}: ${item.total} registros\n`;
    });
    text += "\n";

    text += "PRODUCCIÓN POR TÉCNICO\n";
    text += "====================\n";
    technicianSummary.forEach((item) => {
      text += `${item.technician.name} (${item.technician.areaLabel}): ${item.total} registros\n`;
    });

    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_resumen_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
  };

  const hasFilters = filterFromDate || filterToDate || selectedCreator || selectedTechnician;

  return (
    <AppShell
      title="Reporte de control"
      description="Control detallado para supervisor: análisis de registros, productividad y desempeño."
      eyebrow="Reportes"
    >
      {/* FILTROS */}
      <section className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-[#1a140d]" />
            <h3 className="font-semibold text-[#1a140d]">Filtros</h3>
          </div>
          {hasFilters && (
            <button
              onClick={() => {
                setFilterFromDate("");
                setFilterToDate("");
                setSelectedCreator(null);
                setSelectedTechnician(null);
              }}
              className="flex items-center gap-2 text-sm text-black/60 hover:text-black/80"
            >
              <X size={16} />
              Limpiar
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-black/70 mb-2">Desde</label>
            <input
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black/70 mb-2">Hasta</label>
            <input
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black/70 mb-2">Registradora</label>
            <select
              value={selectedCreator ?? ""}
              onChange={(e) => setSelectedCreator(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm"
            >
              <option value="">Todas</option>
              {plannerUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-black/70 mb-2">Técnico</label>
            <select
              value={selectedTechnician ?? ""}
              onChange={(e) => setSelectedTechnician(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm"
            >
              <option value="">Todos</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* MÉTRICAS PRINCIPALES */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Total Registros</div>
          <div className="mt-3 text-4xl font-bold text-[#1a140d]">{metrics.totalRegistros}</div>
        </article>
        <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Usuarias Activas</div>
          <div className="mt-3 text-4xl font-bold text-[#1a140d]">{metrics.totalUsarios}</div>
        </article>
        <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Técnicos Asignados</div>
          <div className="mt-3 text-4xl font-bold text-[#1a140d]">{metrics.totalTechnicians}</div>
        </article>
        <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Promedio por Usuaria</div>
          <div className="mt-3 text-4xl font-bold text-[#1a140d]">{metrics.promedioPorUsuario}</div>
        </article>
      </section>

      {/* BOTONES DE EXPORTACIÓN */}
      <section className="flex flex-wrap gap-3">
        <button
          onClick={exportToExcel}
          className="inline-flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition"
        >
          <Download size={18} />
          Exportar Excel
        </button>
        <button
          onClick={exportToText}
          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          <Download size={18} />
          Exportar Resumen
        </button>
      </section>

      {/* REPORTES */}
      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* RESUMEN DIARIO */}
        <article className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <h2 className="font-serif text-3xl text-[#1a140d]">Resumen por Estado</h2>
          <div className="mt-6 space-y-3">
            {Array.from(summaryByStatus.entries()).map(([status, count]) => (
              <div key={status} className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-[#151515]">{status}</div>
                  <div className="text-sm text-black/70">
                    <strong>{count}</strong> {count === 1 ? "registro" : "registros"}
                  </div>
                </div>
                <div className="mt-2 h-2 bg-black/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black/30"
                    style={{ width: `${(count / Math.max(metrics.totalRegistros, 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* PRODUCTIVIDAD POR USUARIA */}
        <article className="rounded-4xl border border-black/10 bg-[#151515] p-6 text-white shadow-[0_16px_40px_rgba(17,17,17,0.16)]">
          <h2 className="font-serif text-3xl text-white flex items-center gap-2">
            <TrendingUp size={24} />
            Producción por Usuaria
          </h2>
          <div className="mt-6 space-y-3">
            {creatorSummary.map((item) => (
              <div key={item.user.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-semibold">{item.user.name}</span>
                  <span className="text-lg font-bold">{item.total}</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white"
                    style={{ width: `${(item.total / Math.max(metrics.totalRegistros, 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* PRODUCTIVIDAD POR TÉCNICO */}
        <article className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)] lg:col-span-2">
          <h2 className="font-serif text-3xl text-[#1a140d] flex items-center gap-2">
            <TrendingUp size={24} />
            Productividad por Técnico
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {technicianSummary.map((item) => (
              <div key={item.technician.id} className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <div className="font-semibold text-[#151515]">{item.technician.name}</div>
                    <div className="text-xs text-black/60">{item.technician.areaLabel}</div>
                  </div>
                  <span className="text-lg font-bold text-[#151515]">{item.total}</span>
                </div>
                <div className="h-2 bg-black/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black/30"
                    style={{ width: `${(item.total / Math.max(metrics.totalRegistros, 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
