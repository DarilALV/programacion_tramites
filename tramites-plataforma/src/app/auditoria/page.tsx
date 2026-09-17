"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { getAuditLogs, type AuditLog, useTramitesStore } from "@/lib/tramites-store";

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState<"all" | "create" | "update" | "delete">("all");
  const { entries, updateEntry } = useTramitesStore();

  useEffect(() => {
    const allLogs = getAuditLogs();
    setLogs(allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  }, []);

  const filtered = logs.filter((log) => filter === "all" || log.operation === filter);

  const stats = {
    total: logs.length,
    creates: logs.filter((l) => l.operation === "create").length,
    updates: logs.filter((l) => l.operation === "update").length,
    deletes: logs.filter((l) => l.operation === "delete").length,
    success: logs.filter((l) => l.status === "success").length,
    partial: logs.filter((l) => l.status === "partial").length,
    failed: logs.filter((l) => l.status === "failed").length,
  };

  const downloadLogs = () => {
    const csv = [
      ["Timestamp", "Operation", "Type", "Entity ID", "Code", "User", "Saved To", "Status", "Details"].join(","),
      ...logs.map((log) =>
        [
          log.timestamp,
          log.operation,
          log.entityType,
          log.entityId,
          log.entityCode || "",
          log.userName,
          log.savedTo.join("|"),
          log.status,
          (log.details || "").replace(/"/g, '""'),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const clearLogs = () => {
    if (confirm("¿Eliminar todos los logs de auditoría?")) {
      localStorage.removeItem("gmc-tramites-audit");
      setLogs([]);
    }
  };

  const handleRecoverEntry = (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    updateEntry(entryId, { ...entry, deleted: undefined });
  };

  const deletedEntries = entries.filter((e) => e.deleted === true);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell title="Auditoría" description="Registro de cambios en la BD" eyebrow="AUDITORÍA">
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-3xl font-bold">📋 Auditoría de Cambios</h1>
          <div className="flex gap-2">
            <button
              onClick={downloadLogs}
              className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 cursor-pointer"
            >
              📥 Descargar CSV
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 cursor-pointer"
            >
              🗑️ Limpiar
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-gray-600">Total de operaciones</p>
            <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
          </div>
          <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
            <p className="text-sm text-gray-600">Guardadas correctamente</p>
            <p className="text-3xl font-bold text-green-900">{stats.success}</p>
          </div>
          <div className="rounded-lg border-2 border-orange-200 bg-orange-50 p-4">
            <p className="text-sm text-gray-600">Con problemas (parcial/fallo)</p>
            <p className="text-3xl font-bold text-orange-900">{stats.partial + stats.failed}</p>
          </div>
        </div>

        {/* OPERATION BREAKDOWN */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border-2 border-pink-200 bg-pink-50 p-4">
            <p className="text-xs text-gray-600 uppercase">Creaciones</p>
            <p className="text-2xl font-bold text-pink-700">{stats.creates}</p>
          </div>
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
            <p className="text-xs text-gray-600 uppercase">Actualizaciones</p>
            <p className="text-2xl font-bold text-blue-700">{stats.updates}</p>
          </div>
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
            <p className="text-xs text-gray-600 uppercase">Eliminaciones</p>
            <p className="text-2xl font-bold text-red-700">{stats.deletes}</p>
          </div>
        </div>

        {/* FILTERS */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "create", "update", "delete"] as const).map((op) => (
            <button
              key={op}
              onClick={() => setFilter(op)}
              className={`px-4 py-2 rounded-lg font-semibold cursor-pointer transition ${
                filter === op
                  ? "bg-pink-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {op === "all" ? "Todos" : op === "create" ? "Crear" : op === "update" ? "Editar" : "Eliminar"} ({
                op === "all"
                  ? filtered.length
                  : op === "create"
                    ? stats.creates
                    : op === "update"
                      ? stats.updates
                      : stats.deletes
              })
            </button>
          ))}
        </div>

        {/* TABLE */}
        <div className="rounded-lg border-2 border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Hora</th>
                <th className="px-4 py-3 text-left font-semibold">Operación</th>
                <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold">Código</th>
                <th className="px-4 py-3 text-left font-semibold">Usuario</th>
                <th className="px-4 py-3 text-left font-semibold">Guardado en</th>
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    No hay registros
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {new Date(log.timestamp).toLocaleTimeString("es-ES")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          log.operation === "create"
                            ? "bg-green-100 text-green-800"
                            : log.operation === "update"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {log.operation === "create"
                          ? "➕ Crear"
                          : log.operation === "update"
                            ? "✏️ Editar"
                            : "🗑️ Eliminar"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {log.entityType === "entry" ? "📋 Trámite" : "📦 Junta"}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{log.entityCode || "—"}</td>
                    <td className="px-4 py-3 text-sm">{log.userName}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {log.savedTo.includes("localStorage") && (
                          <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700 font-bold">
                            💾 Local
                          </span>
                        )}
                        {log.savedTo.includes("firestore") && (
                          <span className="px-2 py-1 rounded text-xs bg-orange-100 text-orange-700 font-bold">
                            ☁️ Firestore
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          log.status === "success"
                            ? "bg-green-100 text-green-800"
                            : log.status === "partial"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {log.status === "success"
                          ? "✅ OK"
                          : log.status === "partial"
                            ? "⚠️ Parcial"
                            : "❌ Error"}
                      </span>
                      {log.details && (
                        <p className="text-xs text-gray-500 mt-1" title={log.details}>
                          {log.details.substring(0, 50)}...
                        </p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* TRÁMITES BORRADOS */}
        {deletedEntries.length > 0 && (
          <section className="rounded-4xl border-2 border-red-200 p-6">
            <h2 className="text-2xl font-bold mb-4">🗑️ Trámites Borrados</h2>
            <div className="rounded-lg border-2 border-red-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-red-100 border-b-2 border-red-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Hora Borrado</th>
                    <th className="px-4 py-3 text-left font-semibold">Trámite</th>
                    <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                    <th className="px-4 py-3 text-left font-semibold">Técnico</th>
                    <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {deletedEntries.map((entry) => {
                    const deleteLog = logs.find(
                      (l) => l.operation === "delete" && l.entityId === entry.id
                    );
                    const deleteTime = deleteLog ? new Date(deleteLog.timestamp).toLocaleTimeString("es-ES") : "—";

                    return (
                      <tr key={entry.id} className="border-b border-red-100 hover:bg-red-50">
                        <td className="px-4 py-3 text-xs text-gray-600">{deleteTime}</td>
                        <td className="px-4 py-3 font-mono font-semibold">{entry.tramiteCode}</td>
                        <td className="px-4 py-3 text-sm">
                          {entry.followUps?.[0]?.clientName ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm">{entry.technicianName}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleRecoverEntry(entry.id)}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 cursor-pointer"
                          >
                            ↩️ Recuperar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* INFO */}
        <div className="rounded-lg bg-blue-50 border-2 border-blue-200 p-4">
          <p className="text-sm text-blue-700">
            <strong>ℹ️ Qué ves:</strong> Cada operación registra dónde se guardó (localStorage vs Firestore). Si ves
            "⚠️ Parcial", significa que se guardó en localStorage pero falló en Firestore. Esto es lo que puede causar
            pérdida de datos si limpias el cache.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
