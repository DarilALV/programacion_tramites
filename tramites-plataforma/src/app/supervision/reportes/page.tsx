"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { technicians, useTramitesStore } from "@/lib/tramites-store";

function minDiff(from: string, to?: string) {
  const [fh, fm] = from.split(":").map(Number);
  if (to) { const [th, tm] = to.split(":").map(Number); return (th * 60 + tm) - (fh * 60 + fm); }
  const n = new Date(); return (n.getHours() * 60 + n.getMinutes()) - (fh * 60 + fm);
}

function fmtMin(m: number | null) {
  if (m === null || m <= 0) return "—";
  if (m < 60) return `${m} min`;
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

export default function ReportesSupervisionPage() {
  const { entries, currentUser } = useTramitesStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodo, setPeriodo] = useState<"dia" | "semana" | "mes">("dia");
  const [expandedTechId, setExpandedTechId] = useState<string | null>(null);

  const isSupervisor = currentUser.role === "supervisor";

  let from: string, to: string;
  if (periodo === "dia") { from = to = selectedDate; }
  else if (periodo === "semana") { const r = weekRange(selectedDate); from = r.from; to = r.to; }
  else { const r = monthRange(selectedDate); from = r.from; to = r.to; }

  // Datos agregados por técnico + detalles de trámites
  const reporteData = useMemo(() => {
    const techMap: Record<string, any> = {};

    technicians.forEach((tech) => {
      techMap[tech.id] = {
        techId: tech.id,
        techName: tech.name,
        area: tech.areaLabel,
        total: 0,
        completados: 0,
        noEscucho: 0,
        waitTimes: [] as number[],
        attnTimes: [] as number[],
        tramites: [] as any[],
      };
    });

    entries.forEach((e) => {
      if (!e.followUp) return;
      const d = e.scheduleDate ?? e.followUp.createdAt?.slice(0, 10) ?? "";
      if (d < from || d > to) return;

      const tid = e.followUp.actualTechnicianId ?? e.technicianId;
      const tech = technicians.find((t) => t.id === tid);
      if (!tech) return;

      if (!techMap[tid]) {
        techMap[tid] = {
          techId: tid,
          techName: tech.name,
          area: tech.areaLabel,
          total: 0,
          completados: 0,
          noEscucho: 0,
          waitTimes: [] as number[],
          attnTimes: [] as number[],
          tramites: [] as any[],
        };
      }

      const st = e.followUp.followUpStatus ?? "esperando";
      techMap[tid].total++;

      const esperaMin = e.followUp.arrivalTime && e.followUp.attendedTime ? minDiff(e.followUp.arrivalTime, e.followUp.attendedTime) : null;
      const attnMin = e.followUp.attendedTime && e.followUp.completedTime ? minDiff(e.followUp.attendedTime, e.followUp.completedTime) : null;

      techMap[tid].tramites.push({
        tramiteCode: e.tramiteCode,
        registrationNumber: e.registrationNumber,
        clientName: e.followUp.clientName ?? "—",
        status: st,
        arrivalTime: e.followUp.arrivalTime ?? "—",
        calledTime: e.followUp.calledTime ?? "—",
        attendedTime: e.followUp.attendedTime ?? "—",
        completedTime: e.followUp.completedTime ?? "—",
        returnedTime: e.followUp.returnedTime ?? "—",
        esperaMin,
        attnMin,
        observations: e.followUp.observations ?? "—",
      });

      if (st === "completado") {
        techMap[tid].completados++;
        if (esperaMin !== null && esperaMin >= 0) techMap[tid].waitTimes.push(esperaMin);
        if (attnMin !== null && attnMin >= 0) techMap[tid].attnTimes.push(attnMin);
      } else if (st === "no-escucho") techMap[tid].noEscucho++;
    });

    return Object.values(techMap)
      .map((t) => ({
        ...t,
        avgWait: t.waitTimes.length ? Math.round(t.waitTimes.reduce((a: number, b: number) => a + b, 0) / t.waitTimes.length) : null,
        avgAttn: t.attnTimes.length ? Math.round(t.attnTimes.reduce((a: number, b: number) => a + b, 0) / t.attnTimes.length) : null,
      }))
      .sort((a, b) => b.completados - a.completados);
  }, [entries, from, to]);

  const totales = useMemo(() => ({
    total: reporteData.reduce((s, t) => s + t.total, 0),
    completados: reporteData.reduce((s, t) => s + t.completados, 0),
    noEscucho: reporteData.reduce((s, t) => s + t.noEscucho, 0),
  }), [reporteData]);

  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const rows: any[] = [];

    reporteData.forEach((tech) => {
      rows.push({
        Técnico: tech.techName,
        Área: tech.area,
        Total: tech.total,
        Completados: tech.completados,
        "No escuchó": tech.noEscucho,
        "Espera prom.": fmtMin(tech.avgWait),
        "Atención prom.": fmtMin(tech.avgAttn),
      });

      tech.tramites.forEach((trm: any) => {
        rows.push({
          Técnico: `  └─ ${trm.tramiteCode}`,
          Área: "",
          Total: "",
          Completados: trm.status,
          "No escuchó": trm.clientName,
          "Espera prom.": `${trm.arrivalTime} → ${trm.attendedTime}`,
          "Atención prom.": fmtMin(trm.attnMin),
        });
      });

      rows.push({ Técnico: "", Área: "", Total: "", Completados: "", "No escuchó": "", "Espera prom.": "", "Atención prom.": "" });
    });

    rows.push({
      Técnico: "TOTAL",
      Área: "",
      Total: totales.total,
      Completados: totales.completados,
      "No escuchó": totales.noEscucho,
      "Espera prom.": "",
      "Atención prom.": "",
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `reporte-supervision-${periodo}-${selectedDate}.xlsx`);
  }

  if (!isSupervisor) {
    return (
      <AppShell title="Reportes de Supervisión" description="Acceso restringido" eyebrow="SUPERVISIÓN">
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-6 text-center">
          <p className="text-lg font-bold text-red-800">🔒 Acceso restringido</p>
          <p className="text-sm text-red-700 mt-2">Solo supervisores pueden ver este reporte.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Reportes de Supervisión" description="Resumen detallado de desempeño de todos los técnicos" eyebrow="SUPERVISIÓN">
      <div className="space-y-6">

        {/* Filtros */}
        <section className="rounded-4xl border-2 border-blue-200 bg-blue-50 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-800">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-700">Fecha</span>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-lg border-2 border-blue-300 px-4 py-3 focus:border-blue-500 focus:outline-none" />
            </label>
            <div className="flex gap-2 items-end">
              {(["dia", "semana", "mes"] as const).map((p) => (
                <button key={p} onClick={() => setPeriodo(p)}
                  className={`px-4 py-3 rounded-lg text-sm font-semibold cursor-pointer transition ${periodo === p ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}>
                  {p === "dia" ? "Día" : p === "semana" ? "Semana" : "Mes"}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={exportarExcel}
                className="px-6 py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 cursor-pointer transition">
                📥 Descargar Excel
              </button>
            </div>
          </div>
        </section>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total atendidos", value: totales.completados, color: "green" },
            { label: "Total sin atender", value: totales.total - totales.completados, color: "orange" },
            { label: "No escucharon", value: totales.noEscucho, color: "red" },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl border-2 border-${color}-200 bg-${color}-50 p-4`}>
              <p className="text-xs text-gray-600 uppercase">{label}</p>
              <p className={`text-3xl font-bold text-${color}-900 mt-2`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tabla expandible */}
        <section className="rounded-4xl border-2 border-blue-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4">
            <h2 className="text-2xl font-bold">Desempeño por Técnico (Click para expandir)</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {reporteData.map((tech) => (
              <div key={tech.techId}>
                {/* Fila resumen clickeable */}
                <button
                  onClick={() => setExpandedTechId(expandedTechId === tech.techId ? null : tech.techId)}
                  className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition text-left flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <span className={`text-xl ${expandedTechId === tech.techId ? "rotate-90" : ""} transition`}>▶</span>
                    <div>
                      <p className="font-bold text-gray-800">{tech.techName}</p>
                      <p className="text-xs text-gray-600">{tech.area}</p>
                    </div>
                  </div>
                  <div className="flex gap-6 text-sm font-semibold">
                    <span>📋 Total: {tech.total}</span>
                    <span className="text-green-700">✅ Completados: {tech.completados}</span>
                    <span className="text-red-700">🔇 No escuchó: {tech.noEscucho}</span>
                  </div>
                </button>

                {/* Detalles expandidos */}
                {expandedTechId === tech.techId && (
                  <div className="bg-white p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left font-bold">Trámite</th>
                            <th className="px-3 py-2 text-left font-bold">Cliente</th>
                            <th className="px-3 py-2 text-left font-bold">Estado</th>
                            <th className="px-3 py-2 text-center font-bold">Llegada</th>
                            <th className="px-3 py-2 text-center font-bold">Llamó</th>
                            <th className="px-3 py-2 text-center font-bold">Atendido</th>
                            <th className="px-3 py-2 text-center font-bold">Terminó</th>
                            <th className="px-3 py-2 text-center font-bold">Espera</th>
                            <th className="px-3 py-2 text-center font-bold">Atención</th>
                            <th className="px-3 py-2 text-left font-bold">Obs.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {tech.tramites.map((trm: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-mono font-bold">{trm.tramiteCode}</td>
                              <td className="px-3 py-2">{trm.clientName}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                  trm.status === "completado" ? "bg-green-100 text-green-800" :
                                  trm.status === "no-escucho" ? "bg-red-100 text-red-800" :
                                  trm.status === "regreso" ? "bg-yellow-100 text-yellow-800" :
                                  "bg-gray-100 text-gray-800"
                                }`}>
                                  {trm.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center text-blue-700">{trm.arrivalTime}</td>
                              <td className="px-3 py-2 text-center text-purple-700">{trm.calledTime}</td>
                              <td className="px-3 py-2 text-center text-blue-700">{trm.attendedTime}</td>
                              <td className="px-3 py-2 text-center text-green-700 font-bold">{trm.completedTime}</td>
                              <td className="px-3 py-2 text-center font-semibold">{fmtMin(trm.esperaMin)}</td>
                              <td className="px-3 py-2 text-center font-semibold">{fmtMin(trm.attnMin)}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{trm.observations}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Total */}
            <div className="bg-gray-100 px-6 py-4 font-bold flex justify-between">
              <span>TOTAL</span>
              <div className="flex gap-6 text-sm">
                <span>📋 {totales.total}</span>
                <span className="text-green-700">✅ {totales.completados}</span>
                <span className="text-red-700">🔇 {totales.noEscucho}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
