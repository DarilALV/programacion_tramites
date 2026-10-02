"use client";

import { useMemo, useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { formatDate, plannerUsers, technicians, useTramitesStore, type FollowUpType, type Entry } from "@/lib/tramites-store";
import { Download, Filter, X, TrendingUp } from "lucide-react";

export default function ReportesPage() {
  const { entries, groupEntriesByCreator, groupEntriesByTechnician, groupEntriesByDateAndCreator, groupEntriesByDateAndTechnician, fetchReportData } =
    useTramitesStore();

  const [reportTab, setReportTab] = useState<"programaciones" | "atenciones" | "verificacion" | "consolidado" | "auditoria">("programaciones");
  const [auditReport, setAuditReport] = useState<any>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);
  const [selectedFollowUpType, setSelectedFollowUpType] = useState<FollowUpType | null>(null);
  const [historicalData, setHistoricalData] = useState<Entry[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  // Cargar datos históricos si el rango de fechas incluye antes de hoy
  useEffect(() => {
    if (!filterFromDate) {
      setHistoricalData([]);
      return;
    }

    if (filterFromDate >= today) {
      // El rango es después de hoy, no cargar históricos
      setHistoricalData([]);
      return;
    }

    setLoadingHistorical(true);
    const toDate = filterToDate && filterToDate < today ? filterToDate : today;

    fetchReportData(filterFromDate, toDate)
      .then((data) => {
        setHistoricalData(data);
        setLoadingHistorical(false);
      })
      .catch(() => {
        setHistoricalData([]);
        setLoadingHistorical(false);
      });
  }, [filterFromDate, filterToDate]);

  // Combinar entries de hoy con datos históricos
  const combinedEntries = useMemo(() => {
    const allEntries = [...entries, ...historicalData];
    // Deduplicar por ID
    const seen = new Set<string>();
    return allEntries.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [entries, historicalData]);

  // Filtrar entries según criterios
  const filteredEntries = useMemo(() => {
    let filtered = combinedEntries.filter((e) => !e.deleted); // Excluir entries deletados

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
  }, [combinedEntries, filterFromDate, filterToDate, selectedCreator, selectedTechnician]);

  // Filtrar followUps (atenciones) según criterios
  const filteredFollowUps = useMemo(() => {
    const followUps: Array<{ entry: typeof entries[0]; followUp: any; createdAtDate: string }> = [];

    combinedEntries.filter(e => !e.deleted).forEach((entry) => {
      (entry.followUps || []).forEach((fu) => {
        const createdAtDate = fu.createdAt?.split('T')[0] || "";
        let include = true;

        if (filterFromDate && createdAtDate < filterFromDate) include = false;
        if (filterToDate && createdAtDate > filterToDate) include = false;
        if (selectedCreator && entry.createdBy !== selectedCreator) include = false;
        if (selectedTechnician && fu.technicianId !== selectedTechnician) include = false;
        if (selectedFollowUpType && fu.type !== selectedFollowUpType) include = false;

        if (include) {
          followUps.push({ entry, followUp: fu, createdAtDate });
        }
      });
    });

    return followUps;
  }, [combinedEntries, filterFromDate, filterToDate, selectedCreator, selectedTechnician, selectedFollowUpType]);

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

  // Resúmenes para atenciones
  const followUpsTechnicianSummary = useMemo(() => {
    const map = new Map<string, number>();
    technicians.forEach((tech) => {
      map.set(tech.id, filteredFollowUps.filter((f) => f.followUp.technicianId === tech.id).length);
    });
    return technicians.map((tech) => ({ technician: tech, total: map.get(tech.id) ?? 0 }));
  }, [filteredFollowUps]);

  const followUpsTypeSummary = useMemo(() => {
    const map = new Map<string, number>();
    const types: FollowUpType[] = ["normal", "junta_ingreso", "derivado", "legalización", "planimetrias", "consultas"];
    types.forEach((type) => {
      map.set(type, filteredFollowUps.filter((f) => f.followUp.type === type).length);
    });
    return types.map((type) => ({ type, total: map.get(type) ?? 0 })).filter((t) => t.total > 0);
  }, [filteredFollowUps]);

  const followUpsCreatorSummary = useMemo(() => {
    const map = new Map<string, number>();
    plannerUsers.forEach((user) => {
      map.set(user.id, filteredFollowUps.filter((f) => f.entry.createdBy === user.id).length);
    });
    return plannerUsers.map((user) => ({ user, total: map.get(user.id) ?? 0 })).filter((u) => u.total > 0);
  }, [filteredFollowUps]);

  const followUpsMetrics = useMemo(() => {
    const totalAtenciones = filteredFollowUps.length;
    const activeTechnicians = followUpsTechnicianSummary.filter((t) => t.total > 0).length;
    const activeCreators = followUpsCreatorSummary.length;
    const promedioAtencionesPorTecnico = activeTechnicians > 0 ? (totalAtenciones / activeTechnicians).toFixed(1) : 0;

    return {
      totalAtenciones,
      activeTechnicians,
      activeCreators,
      promedioAtencionesPorTecnico,
    };
  }, [filteredFollowUps, followUpsTechnicianSummary, followUpsCreatorSummary]);

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

  // Exportar reporte consolidado
  const exportConsolidatedReport = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Sheet 1: Resumen
      const summaryData = [
        ['Métrica', 'Valor'],
        ['Total Programaciones', verificationMetrics.totalEntries],
        ['Total Atenciones', verificationMetrics.totalFollowUps],
        ['Total Juntas', verificationMetrics.totalJuntas],
        ['Promedio Atenciones/Prog', verificationMetrics.promedioFollowUpsPerEntry],
        ['Técnicos Activos', followUpsTechnicianSummary.filter(t => t.total > 0).length],
        ['Registradoras Activas', followUpsCreatorSummary.length],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Resumen');

      // Sheet 2: Programaciones
      const programsData = [
        ['Código', 'Técnico', 'Registrador', 'Estado', 'Fecha Registro'],
        ...filteredEntries.map(e => [e.tramiteCode, e.technicianName, e.createdByName, e.status, e.registrationDate]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(programsData), 'Programaciones');

      // Sheet 3: Atenciones
      const followUpsData = [
        ['Fecha', 'Tipo', 'Técnico', 'Registrador', 'Cliente', 'Estado'],
        ...filteredFollowUps.map(f => [
          f.createdAtDate,
          f.followUp.type || 'normal',
          f.followUp.technicianName || f.entry.technicianName || '—',
          f.entry.createdByName,
          f.followUp.clientName || '—',
          f.followUp.followUpStatus || '—',
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(followUpsData), 'Atenciones');

      // Sheet 4: Productividad Técnicos
      const techsData = [
        ['Técnico', 'Área', 'Programaciones', 'Atenciones'],
        ...technicians.map(t => {
          const progCount = filteredEntries.filter(e => e.technicianId === t.id).length;
          const followUpCount = filteredFollowUps.filter(f => f.followUp.technicianId === t.id).length;
          return [t.name, t.areaLabel, progCount, followUpCount];
        }),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(techsData), 'Productividad Técnicos');

      // Sheet 5: Productividad Registradoras
      const creatorsData = [
        ['Registradora', 'Programaciones', 'Atenciones Registradas'],
        ...plannerUsers.map(u => {
          const progCount = filteredEntries.filter(e => e.createdBy === u.id).length;
          const followUpCount = filteredFollowUps.filter(f => f.entry.createdBy === u.id).length;
          return [u.name, progCount, followUpCount];
        }),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(creatorsData), 'Productividad Registradoras');

      // Descargar
      XLSX.writeFile(wb, `reporte_consolidado_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      console.error('Error generando reporte:', error);
      alert('Error al generar el reporte');
    }
  };

  // Exportar atenciones a Excel
  const exportFollowUpsToExcel = () => {
    const data = filteredFollowUps.map((f) => ({
      "Fecha Atención": f.createdAtDate,
      "Tipo": f.followUp.type || "normal",
      "Técnico": f.followUp.technicianName || f.entry.technicianName || "—",
      "Registrado por": f.entry.createdByName,
      "Cliente": f.followUp.clientName || "—",
      "Estado": f.followUp.followUpStatus || "—",
      "Código Trámite": f.entry.tramiteCode || "—",
      "Observaciones": f.followUp.observations || "—",
    }));

    const csv = [
      Object.keys(data[0] || {}).join(","),
      ...data.map((row) =>
        Object.values(row)
          .map((v) => `"${v}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_atenciones_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Métricas de verificación/auditoría
  const verificationMetrics = useMemo(() => {
    const totalEntries = filteredEntries.length;
    const totalFollowUps = filteredFollowUps.length;
    const totalJuntas = filteredEntries.filter(e => e.juntaId).length;

    // Desglose de followUps por tipo
    const followUpsByType = new Map<string, number>();
    const types: FollowUpType[] = ["normal", "junta_ingreso", "derivado", "legalización", "planimetrias", "consultas"];
    types.forEach(type => {
      const count = filteredFollowUps.filter(f => f.followUp.type === type).length;
      if (count > 0) followUpsByType.set(type, count);
    });

    // Desglose de entries por estado
    const entriesByStatus = new Map<string, number>();
    filteredEntries.forEach(e => {
      entriesByStatus.set(e.status, (entriesByStatus.get(e.status) ?? 0) + 1);
    });

    return {
      totalEntries,
      totalFollowUps,
      totalJuntas,
      promedioFollowUpsPerEntry: totalEntries > 0 ? (totalFollowUps / totalEntries).toFixed(2) : 0,
      followUpsByType,
      entriesByStatus,
    };
  }, [filteredEntries, filteredFollowUps]);

  // Función de auditoría
  const runAudit = async () => {
    setAuditLoading(true);
    try {
      const { firestore } = await import('@/lib/firebase');
      const { collection, getDocs } = await import('firebase/firestore');

      // Datos de Firebase
      const snapshot = await getDocs(collection(firestore, 'entries'));
      const firebaseIds = new Set(snapshot.docs.map(d => d.id));
      const firebaseTotal = snapshot.size;
      const firebaseActive = snapshot.docs.filter(d => d.data().deleted !== true).length;

      // Datos en localStorage
      const storageKey = "gmc-tramites-mvp";
      const stored = localStorage.getItem(storageKey);
      const localStorageIds = new Set<string>();
      let localStorageSize = 0;
      if (stored) {
        JSON.parse(stored).entries.forEach((e: any) => localStorageIds.add(e.id));
        localStorageSize = new Blob([stored]).size;
      }

      // Datos en memoria
      const memoryIds = new Set(entries.map(e => e.id));

      // Comparar
      const inFirebaseOnly = Array.from(firebaseIds).filter(id => !localStorageIds.has(id));
      const inLocalStorageOnly = Array.from(localStorageIds).filter(id => !firebaseIds.has(id));
      const inMemoryOnly = Array.from(memoryIds).filter(id => !firebaseIds.has(id));

      setAuditReport({
        firebaseTotal,
        firebaseActive,
        localStorageCount: localStorageIds.size,
        localStorageSize: (localStorageSize / 1024).toFixed(2),
        memoryCount: memoryIds.size,
        inFirebaseOnly: inFirebaseOnly.length,
        inLocalStorageOnly: inLocalStorageOnly.length,
        inMemoryOnly: inMemoryOnly.length,
        missingFromLocalStorage: inFirebaseOnly.slice(0, 10),
      });
    } catch (error) {
      console.error('Error en auditoría:', error);
      setAuditReport({ error: String(error) });
    } finally {
      setAuditLoading(false);
    }
  };

  const hasFilters = filterFromDate || filterToDate || selectedCreator || selectedTechnician || selectedFollowUpType;

  return (
    <AppShell
      title="Reporte de control"
      description="Control detallado para supervisor: análisis de registros, productividad y desempeño."
      eyebrow="Reportes"
    >
      {/* TABS */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <button
          onClick={() => setReportTab("auditoria")}
          className={`px-6 py-3 rounded-full font-semibold transition ${
            reportTab === "auditoria"
              ? "bg-[#1a140d] text-white"
              : "border border-black/10 bg-white text-[#1a140d] hover:border-black/20"
          }`}
        >
          🔍 Auditoría
        </button>
        <button
          onClick={() => setReportTab("consolidado")}
          className={`px-6 py-3 rounded-full font-semibold transition ${
            reportTab === "consolidado"
              ? "bg-[#1a140d] text-white"
              : "border border-black/10 bg-white text-[#1a140d] hover:border-black/20"
          }`}
        >
          📊 Consolidado
        </button>
        <button
          onClick={() => setReportTab("programaciones")}
          className={`px-6 py-3 rounded-full font-semibold transition ${
            reportTab === "programaciones"
              ? "bg-[#1a140d] text-white"
              : "border border-black/10 bg-white text-[#1a140d] hover:border-black/20"
          }`}
        >
          Programaciones
        </button>
        <button
          onClick={() => setReportTab("atenciones")}
          className={`px-6 py-3 rounded-full font-semibold transition ${
            reportTab === "atenciones"
              ? "bg-[#1a140d] text-white"
              : "border border-black/10 bg-white text-[#1a140d] hover:border-black/20"
          }`}
        >
          Atenciones
        </button>
        <button
          onClick={() => setReportTab("verificacion")}
          className={`px-6 py-3 rounded-full font-semibold transition ${
            reportTab === "verificacion"
              ? "bg-[#1a140d] text-white"
              : "border border-black/10 bg-white text-[#1a140d] hover:border-black/20"
          }`}
        >
          🔍 Verificación
        </button>
      </div>

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
                setSelectedFollowUpType(null);
              }}
              className="flex items-center gap-2 text-sm text-black/60 hover:text-black/80"
            >
              <X size={16} />
              Limpiar
            </button>
          )}
        </div>

        <div className={`grid gap-4 ${reportTab === "atenciones" ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
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
          {reportTab === "atenciones" && (
            <div>
              <label className="block text-xs font-semibold text-black/70 mb-2">Tipo</label>
              <select
                value={selectedFollowUpType ?? ""}
                onChange={(e) => setSelectedFollowUpType((e.target.value as FollowUpType) || null)}
                className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm"
              >
                <option value="">Todos</option>
                <option value="normal">Normal</option>
                <option value="junta_ingreso">Junta</option>
                <option value="derivado">Derivado</option>
                <option value="planimetrias">Planimetría</option>
                <option value="consultas">Consulta</option>
                <option value="legalización">Legalización</option>
              </select>
            </div>
          )}
        </div>
        {loadingHistorical && (
          <div className="mt-4 flex items-center gap-2 text-sm text-black/60">
            <div className="animate-spin">⏳</div>
            <span>Cargando datos históricos...</span>
          </div>
        )}
      </section>

      {/* MÉTRICAS PRINCIPALES */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {reportTab === "consolidado" ? (
          <>
            <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Programaciones (filtradas)</div>
              <div className="mt-3 text-4xl font-bold text-[#1a140d]">{filteredEntries.length}</div>
            </article>
            <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Atenciones (filtradas)</div>
              <div className="mt-3 text-4xl font-bold text-[#1a140d]">{filteredFollowUps.length}</div>
            </article>
            <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Total Juntas</div>
              <div className="mt-3 text-4xl font-bold text-[#1a140d]">{verificationMetrics.totalJuntas}</div>
            </article>
            <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Promedio Atenciones/Prog</div>
              <div className="mt-3 text-4xl font-bold text-[#1a140d]">{filteredEntries.length > 0 ? (filteredFollowUps.length / filteredEntries.length).toFixed(2) : 0}</div>
            </article>
          </>
        ) : reportTab === "verificacion" ? (
          <>
            <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Total Programaciones</div>
              <div className="mt-3 text-4xl font-bold text-[#1a140d]">{verificationMetrics.totalEntries}</div>
            </article>
            <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Total Seguimientos</div>
              <div className="mt-3 text-4xl font-bold text-[#1a140d]">{verificationMetrics.totalFollowUps}</div>
            </article>
            <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Total Juntas</div>
              <div className="mt-3 text-4xl font-bold text-[#1a140d]">{verificationMetrics.totalJuntas}</div>
            </article>
            <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Promedio Seguimientos/Prog</div>
              <div className="mt-3 text-4xl font-bold text-[#1a140d]">{verificationMetrics.promedioFollowUpsPerEntry}</div>
            </article>
          </>
        ) : reportTab === "programaciones" ? (
          <>
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
          </>
        ) : (
          <>
            <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Total Atenciones</div>
              <div className="mt-3 text-4xl font-bold text-[#1a140d]">{followUpsMetrics.totalAtenciones}</div>
            </article>
            <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Técnicos Activos</div>
              <div className="mt-3 text-4xl font-bold text-[#1a140d]">{followUpsMetrics.activeTechnicians}</div>
            </article>
            <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Registradoras Activas</div>
              <div className="mt-3 text-4xl font-bold text-[#1a140d]">{followUpsMetrics.activeCreators}</div>
            </article>
            <article className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Promedio por Técnico</div>
              <div className="mt-3 text-4xl font-bold text-[#1a140d]">{followUpsMetrics.promedioAtencionesPorTecnico}</div>
            </article>
          </>
        )}
      </section>

      {/* BOTONES DE EXPORTACIÓN */}
      {reportTab !== "verificacion" && (
      <section className="flex flex-wrap gap-3">
        {reportTab === "consolidado" ? (
          <button
            onClick={exportConsolidatedReport}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            <Download size={18} />
            Descargar Reporte Consolidado (Excel)
          </button>
        ) : reportTab === "programaciones" ? (
          <>
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
          </>
        ) : (
          <button
            onClick={exportFollowUpsToExcel}
            className="inline-flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition"
          >
            <Download size={18} />
            Exportar Atenciones a Excel
          </button>
        )}
      </section>
      )}

      {/* REPORTES */}
      {reportTab === "auditoria" ? (
        <section className="space-y-6">
          <div className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
            <h2 className="font-serif text-3xl text-[#1a140d]">Auditoría de Datos</h2>
            <p className="mt-2 text-sm text-black/70">Compara Firebase vs localStorage vs memoria para identificar datos perdidos</p>

            <button
              onClick={runAudit}
              disabled={auditLoading}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
            >
              {auditLoading ? "Analizando..." : "🔍 Ejecutar Auditoría"}
            </button>
          </div>

          {auditReport && (
            <div className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
              <h3 className="font-semibold text-[#1a140d] mb-4">Resultados</h3>

              {auditReport.error ? (
                <p className="text-red-600">{auditReport.error}</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
                      <div className="text-sm text-black/70">📦 Firebase Total</div>
                      <div className="text-2xl font-bold text-[#151515]">{auditReport.firebaseTotal}</div>
                      <div className="text-xs text-black/60">({auditReport.firebaseActive} activos)</div>
                    </div>
                    <div className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
                      <div className="text-sm text-black/70">💾 localStorage</div>
                      <div className="text-2xl font-bold text-[#151515]">{auditReport.localStorageCount}</div>
                      <div className="text-xs text-black/60">({auditReport.localStorageSize} KB)</div>
                    </div>
                    <div className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
                      <div className="text-sm text-black/70">🧠 En Memoria</div>
                      <div className="text-2xl font-bold text-[#151515]">{auditReport.memoryCount}</div>
                    </div>
                    <div className="rounded-3xl border border-red-200 bg-red-50 p-4">
                      <div className="text-sm text-red-700">❌ Faltantes en localStorage</div>
                      <div className="text-2xl font-bold text-red-700">{auditReport.inFirebaseOnly}</div>
                    </div>
                  </div>

                  {auditReport.inFirebaseOnly > 0 && (
                    <div className="mt-6 p-4 rounded-3xl border border-red-200 bg-red-50">
                      <p className="text-sm font-semibold text-red-800 mb-2">
                        ⚠️ {auditReport.inFirebaseOnly} documentos en Firebase no se guardaron en localStorage
                      </p>
                      <p className="text-xs text-red-700">
                        localStorage tiene un límite de ~5-10MB. Necesitamos migrar a IndexedDB para guardar todos los datos históricos.
                      </p>
                    </div>
                  )}

                  <div className="mt-6 p-4 rounded-3xl border border-green-200 bg-green-50">
                    <p className="text-sm font-semibold text-green-800">
                      ✓ Recomendación: Usar IndexedDB en lugar de localStorage
                    </p>
                    <p className="text-xs text-green-700 mt-2">
                      IndexedDB tiene ~50MB de capacidad y es ideal para guardar todos los datos históricos sin límite.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      ) : reportTab === "consolidado" ? (
        <section className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <h2 className="font-serif text-3xl text-[#1a140d]">Reporte Consolidado</h2>
          <div className="mt-6 space-y-4">
            <p className="text-sm text-black/70">
              El reporte consolidado incluye 5 sheets en Excel:
            </p>
            <ul className="space-y-2 text-sm text-black/70 ml-4">
              <li><strong>Resumen:</strong> Métricas clave del período</li>
              <li><strong>Programaciones:</strong> Listado completo de trámites</li>
              <li><strong>Atenciones:</strong> Listado completo de seguimientos registrados</li>
              <li><strong>Productividad Técnicos:</strong> Desempeño por técnico</li>
              <li><strong>Productividad Registradoras:</strong> Desempeño por usuaria registradora</li>
            </ul>
            <div className="mt-6 p-4 rounded-3xl border border-green-200 bg-green-50">
              <p className="text-sm text-green-800">
                ✓ Haz clic en "Descargar Reporte Consolidado" para descargar el archivo Excel completo con todos los datos.
              </p>
            </div>
          </div>
        </section>
      ) : reportTab === "verificacion" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          {/* SEGUIMIENTOS POR TIPO */}
          <article className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
            <h2 className="font-serif text-3xl text-[#1a140d]">Seguimientos por Tipo</h2>
            <div className="mt-6 space-y-3">
              {Array.from(verificationMetrics.followUpsByType.entries()).map(([type, count]) => (
                <div key={type} className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-[#151515]">{type}</div>
                    <div className="text-sm text-black/70">
                      <strong>{count}</strong>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-black/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black/30"
                      style={{ width: `${(count / Math.max(verificationMetrics.totalFollowUps, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* PROGRAMACIONES POR ESTADO */}
          <article className="rounded-4xl border border-black/10 bg-[#151515] p-6 text-white shadow-[0_16px_40px_rgba(17,17,17,0.16)]">
            <h2 className="font-serif text-3xl text-white flex items-center gap-2">
              <TrendingUp size={24} />
              Programaciones por Estado
            </h2>
            <div className="mt-6 space-y-3">
              {Array.from(verificationMetrics.entriesByStatus.entries()).map(([status, count]) => (
                <div key={status} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="font-semibold">{status}</span>
                    <span className="text-lg font-bold">{count}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white"
                      style={{ width: `${(count / Math.max(verificationMetrics.totalEntries, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* INFORMACIÓN DE AUDITORÍA */}
          <article className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)] lg:col-span-2">
            <h2 className="font-serif text-3xl text-[#1a140d]">Resumen de Verificación</h2>
            <div className="mt-6 space-y-3">
              <div className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-[#151515]">✓ Programaciones cargadas</span>
                  <span className="text-lg font-bold text-[#151515]">{verificationMetrics.totalEntries}</span>
                </div>
              </div>
              <div className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-[#151515]">✓ Seguimientos/Atenciones cargadas</span>
                  <span className="text-lg font-bold text-[#151515]">{verificationMetrics.totalFollowUps}</span>
                </div>
              </div>
              <div className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-[#151515]">✓ Juntas registradas</span>
                  <span className="text-lg font-bold text-[#151515]">{verificationMetrics.totalJuntas}</span>
                </div>
              </div>
              <div className="rounded-3xl border border-black/10 bg-[#e8f5e9] p-4 mt-4">
                <div className="text-sm text-green-800">
                  <strong>✓ Datos sincronizados correctamente desde Firebase</strong>
                </div>
              </div>
            </div>
          </article>
        </section>
      ) : reportTab === "programaciones" ? (
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
      ) : (
        <section className="grid gap-6 lg:grid-cols-2">
          {/* ATENCIONES POR TIPO */}
          <article className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
            <h2 className="font-serif text-3xl text-[#1a140d]">Atenciones por Tipo</h2>
            <div className="mt-6 space-y-3">
              {followUpsTypeSummary.map(({ type, total }) => (
                <div key={type} className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-[#151515]">{type}</div>
                    <div className="text-sm text-black/70">
                      <strong>{total}</strong>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-black/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black/30"
                      style={{ width: `${(total / Math.max(followUpsMetrics.totalAtenciones, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* ATENCIONES POR REGISTRADORA */}
          <article className="rounded-4xl border border-black/10 bg-[#151515] p-6 text-white shadow-[0_16px_40px_rgba(17,17,17,0.16)]">
            <h2 className="font-serif text-3xl text-white flex items-center gap-2">
              <TrendingUp size={24} />
              Registradas por Usuaria
            </h2>
            <div className="mt-6 space-y-3">
              {followUpsCreatorSummary.map((item) => (
                <div key={item.user.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="font-semibold">{item.user.name}</span>
                    <span className="text-lg font-bold">{item.total}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white"
                      style={{ width: `${(item.total / Math.max(followUpsMetrics.totalAtenciones, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* ATENCIONES POR TÉCNICO */}
          <article className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)] lg:col-span-2">
            <h2 className="font-serif text-3xl text-[#1a140d] flex items-center gap-2">
              <TrendingUp size={24} />
              Atenciones por Técnico
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {followUpsTechnicianSummary.filter(t => t.total > 0).map((item) => (
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
                      style={{ width: `${(item.total / Math.max(followUpsMetrics.totalAtenciones, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}
    </AppShell>
  );
}
