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

  // Solo supervisores pueden acceder
  const isSupervisor = currentUser.role === "supervisor";

  let from: string, to: string;
  if (periodo === "dia") { from = to = selectedDate; }
  else if (periodo === "semana") { const r = weekRange(selectedDate); from = r.from; to = r.to; }
  else { const r = monthRange(selectedDate); from = r.from; to = r.to; }

  // Datos agregados por técnico
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
        esperando: 0,
        regreso: 0,
        waitTimes: [] as number[],
        attnTimes: [] as number[],
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
          esperando: 0,
          regreso: 0,
          waitTimes: [] as number[],
          attnTimes: [] as number[],
        };
      }

      const st = e.followUp.followUpStatus ?? "esperando";
      techMap[tid].total++;

      if (st === "completado") {
        techMap[tid].completados++;
        if (e.followUp.arrivalTime && e.followUp.attendedTime) {
          const w = minDiff(e.followUp.arrivalTime, e.followUp.attendedTime);
          if (w >= 0) techMap[tid].waitTimes.push(w);
        }
        if (e.followUp.attendedTime && e.followUp.completedTime) {
          const a = minDiff(e.followUp.attendedTime, e.followUp.completedTime);
          if (a >= 0) techMap[tid].attnTimes.push(a);
        }
      } else if (st === "no-escucho") techMap[tid].noEscucho++;
      else if (st === "esperando") techMap[tid].esperando++;
      else if (st === "regreso") techMap[tid].regreso++;
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
    const rows = reporteData.map((t) => ({
      Técnico: t.techName,
      Área: t.area,
      Total: t.total,
      Completados: t.completados,
      "No escuchó": t.noEscucho,
      Esperando: t.esperando,
      "Regresó": t.regreso,
      "Espera promedio": fmtMin(t.avgWait),
      "Atención promedio": fmtMin(t.avgAttn),
    }));

    rows.push({
      Técnico: "TOTAL",
      Área: "",
      Total: totales.total,
      Completados: totales.completados,
      "No escuchó": totales.noEscucho,
      Esperando: 0,
      Regresó: 0,
      "Espera promedio": "",
      "Atención promedio": "",
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 15 }, { wch: 15 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];
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
    <AppShell title="Reportes de Supervisión" description="Resumen de desempeño de todos los técnicos" eyebrow="SUPERVISIÓN">
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

        {/* Resumen rápido */}
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

        {/* Tabla de técnicos */}
        <section className="rounded-4xl border-2 border-blue-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4">
            <h2 className="text-2xl font-bold">Desempeño por Técnico</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Técnico</th>
                  <th className="px-4 py-3 text-left font-bold">Área</th>
                  <th className="px-4 py-3 text-center font-bold">Total</th>
                  <th className="px-4 py-3 text-center font-bold">✅ Completados</th>
                  <th className="px-4 py-3 text-center font-bold">🔇 No escuchó</th>
                  <th className="px-4 py-3 text-center font-bold">⏳ Esperando</th>
                  <th className="px-4 py-3 text-center font-bold">↩️ Regresó</th>
                  <th className="px-4 py-3 text-center font-bold">Espera prom.</th>
                  <th className="px-4 py-3 text-center font-bold">Atención prom.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reporteData.map((t) => (
                  <tr key={t.techId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold">{t.techName}</td>
                    <td className="px-4 py-3 text-gray-600">{t.area}</td>
                    <td className="px-4 py-3 text-center font-bold">{t.total}</td>
                    <td className="px-4 py-3 text-center text-green-700 font-bold">{t.completados}</td>
                    <td className="px-4 py-3 text-center text-red-700 font-bold">{t.noEscucho}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{t.esperando}</td>
                    <td className="px-4 py-3 text-center text-yellow-600">{t.regreso}</td>
                    <td className="px-4 py-3 text-center text-blue-700">{fmtMin(t.avgWait)}</td>
                    <td className="px-4 py-3 text-center text-purple-700">{fmtMin(t.avgAttn)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td colSpan={2} className="px-4 py-3">TOTAL</td>
                  <td className="px-4 py-3 text-center">{totales.total}</td>
                  <td className="px-4 py-3 text-center text-green-700">{totales.completados}</td>
                  <td className="px-4 py-3 text-center text-red-700">{totales.noEscucho}</td>
                  <td colSpan={4} className="px-4 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
