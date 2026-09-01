'use client';

import Link from "next/link";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { formatDate, getStatusTone, technicians, useTramitesStore } from "@/lib/tramites-store";
import { Search, ChevronLeft, ChevronRight, X, Pencil, Trash2, Check } from "lucide-react";

export default function MisProgramacionesPage() {
  const { currentUser, myEntries, removeEntry, updateEntry } = useTramitesStore();
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ tramiteCode: string; scheduleDate: string; technicianId: string; observations: string }>({
    tramiteCode: "", scheduleDate: "", technicianId: "", observations: "",
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function showMsg(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(""), 4000);
  }

  const filteredBySearch = useMemo(() => {
    if (!searchTerm.trim()) return myEntries;
    const term = searchTerm.toLowerCase();
    return myEntries.filter(
      (e) =>
        e.tramiteCode.toLowerCase().includes(term) ||
        e.registrationNumber.toLowerCase().includes(term) ||
        e.technicianName.toLowerCase().includes(term) ||
        e.observations.toLowerCase().includes(term)
    );
  }, [myEntries, searchTerm]);

  const filteredEntries = useMemo(() => {
    if (!selectedDate) return filteredBySearch;
    return filteredBySearch.filter((e) => e.registrationDate === selectedDate);
  }, [filteredBySearch, selectedDate]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, typeof myEntries>();
    filteredEntries.forEach((e) => {
      const date = e.registrationDate;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(e);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, entries]) => ({
        date,
        entries: entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      }));
  }, [filteredEntries]);

  const entriesByDateMap = useMemo(() => {
    const map = new Map<string, number>();
    myEntries.forEach((e) => map.set(e.registrationDate, (map.get(e.registrationDate) ?? 0) + 1));
    return map;
  }, [myEntries]);

  // Calendario
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days = [
    ...Array.from({ length: firstDay }, (_, i) => ({ day: daysInPrevMonth - firstDay + i + 1, isCurrentMonth: false, date: new Date(year, month - 1, daysInPrevMonth - firstDay + i + 1) })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, isCurrentMonth: true, date: new Date(year, month, i + 1) })),
    ...Array.from({ length: 42 - firstDay - daysInMonth }, (_, i) => ({ day: i + 1, isCurrentMonth: false, date: new Date(year, month + 1, i + 1) })),
  ];

  const fmtKey = (d: Date) => d.toISOString().slice(0, 10);
  const monthName = new Date(year, month, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  function startEdit(entryId: string) {
    const entry = myEntries.find((e) => e.id === entryId);
    if (!entry) return;
    setEditForm({
      tramiteCode: entry.tramiteCode,
      scheduleDate: entry.scheduleDate,
      technicianId: entry.technicianId,
      observations: entry.observations,
    });
    setEditingId(entryId);
    setConfirmDeleteId(null);
  }

  function saveEdit(entryId: string) {
    const entry = myEntries.find((e) => e.id === entryId);
    if (!entry) return;
    const tech = technicians.find((t) => t.id === editForm.technicianId) ?? technicians.find((t) => t.id === entry.technicianId)!;
    updateEntry(entryId, {
      ...entry,
      tramiteCode: editForm.tramiteCode.trim(),
      scheduleDate: editForm.scheduleDate,
      technicianId: tech.id,
      technicianName: tech.name,
      technicianArea: tech.areaLabel,
      observations: editForm.observations.trim(),
    });
    setEditingId(null);
    showMsg(`✓ ${entry.registrationNumber} actualizado correctamente`);
  }

  function confirmDelete(entryId: string) {
    const entry = myEntries.find((e) => e.id === entryId);
    if (!entry) return;
    removeEntry(entryId);
    setConfirmDeleteId(null);
    showMsg(`Programación ${entry.registrationNumber} eliminada`);
  }

  return (
    <AppShell
      title="Mis Programaciones"
      description="Tus programaciones registradas. Puedes editar o eliminar cada una."
      eyebrow="MIS PROGRAMACIONES"
    >
      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* SIDEBAR */}
        <aside className="rounded-4xl border border-black/10 bg-[#fffaf1] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)] space-y-4">
          <h2 className="font-serif text-3xl text-[#1a140d]">Usuaria activa</h2>
          <p className="text-sm text-black/70">Vista de: <strong>{currentUser.name}</strong></p>

          <div className="rounded-3xl border border-black/10 bg-white p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-black/45">Total registros propios</div>
            <div className="mt-2 text-3xl font-bold text-[#151515]">{myEntries.length}</div>
          </div>

          <Link
            href="/tramites/nuevo"
            className="inline-flex w-full items-center justify-center rounded-full bg-[#151515] px-5 py-3 text-sm font-semibold text-white"
          >
            + Nueva programación
          </Link>

          {/* Calendario mini */}
          <div className="rounded-3xl border border-black/10 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-1 hover:bg-gray-100 rounded-full">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold capitalize">{monthName}</span>
              <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-1 hover:bg-gray-100 rounded-full">
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["D","L","M","X","J","V","S"].map((d) => (
                <div key={d} className="text-center text-xs text-black/40 font-semibold">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((dayObj, i) => {
                const key = fmtKey(dayObj.date);
                const cnt = entriesByDateMap.get(key) ?? 0;
                const isSelected = selectedDate === key;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(isSelected ? null : key)}
                    className={`aspect-square rounded-lg text-xs font-semibold transition ${
                      !dayObj.isCurrentMonth ? "text-black/20" :
                      isSelected ? "bg-pink-600 text-white" :
                      cnt > 0 ? "bg-pink-100 text-pink-800 hover:bg-pink-200" :
                      "text-black/60 hover:bg-gray-100"
                    }`}
                  >
                    <div>{dayObj.day}</div>
                    {cnt > 0 && <div className="text-[9px]">{cnt}</div>}
                  </button>
                );
              })}
            </div>
            {selectedDate && (
              <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
                <span className="text-black/60">{filteredEntries.filter((e) => e.registrationDate === selectedDate).length} programación(es)</span>
                <button onClick={() => setSelectedDate(null)} className="hover:bg-gray-100 rounded-full p-1"><X size={14} /></button>
              </div>
            )}
          </div>
        </aside>

        {/* LISTADO */}
        <article className="rounded-4xl border border-black/10 bg-[#975c95] p-6 text-white shadow-[0_16px_40px_rgba(17,17,17,0.16)]">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <h2 className="font-serif text-3xl text-white">Listado personal</h2>
            {message && (
              <div className="rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-sm text-white">
                {message}
              </div>
            )}
          </div>

          {/* Buscador */}
          <div className="mb-5 relative">
            <Search size={16} className="absolute left-4 top-3.5 text-white/50" />
            <input
              type="text"
              placeholder="Buscar código, técnico, observaciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-full bg-white/10 border border-white/15 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
            />
          </div>

          {/* Entradas */}
          <div className="space-y-3">
            {filteredEntries.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-8 text-sm text-white/60 text-center">
                {searchTerm || selectedDate ? "No hay resultados para esa búsqueda." : "Aún no tienes programaciones registradas."}
              </div>
            ) : (
              entriesByDate.map((group) => (
                <div key={group.date}>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/50 font-semibold mb-2 px-1">
                    {new Date(`${group.date}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    <span className="text-white/35 ml-2">({group.entries.length})</span>
                  </p>

                  {group.entries.map((entry) => (
                    <div key={entry.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 mb-3">
                      {editingId === entry.id ? (
                        /* ── MODO EDICIÓN ── */
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">Editando {entry.registrationNumber}</p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="grid gap-1">
                              <span className="text-xs text-white/60">Código trámite</span>
                              <input
                                value={editForm.tramiteCode}
                                onChange={(e) => setEditForm({ ...editForm, tramiteCode: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                                inputMode="numeric"
                                className="rounded-lg bg-white text-black px-3 py-2 text-sm focus:outline-none"
                                placeholder="Ej: 2026016618"
                              />
                            </label>

                            <label className="grid gap-1">
                              <span className="text-xs text-white/60">Fecha programación</span>
                              <input
                                type="date"
                                value={editForm.scheduleDate}
                                onChange={(e) => setEditForm({ ...editForm, scheduleDate: e.target.value })}
                                className="rounded-lg bg-white text-black px-3 py-2 text-sm focus:outline-none"
                              />
                            </label>

                            <label className="grid gap-1 md:col-span-2">
                              <span className="text-xs text-white/60">Técnico</span>
                              <select
                                value={editForm.technicianId}
                                onChange={(e) => setEditForm({ ...editForm, technicianId: e.target.value })}
                                className="rounded-lg bg-white text-black px-3 py-2 text-sm focus:outline-none"
                              >
                                {technicians.map((t) => (
                                  <option key={t.id} value={t.id}>{t.name} · {t.areaLabel}</option>
                                ))}
                              </select>
                            </label>

                            <label className="grid gap-1 md:col-span-2">
                              <span className="text-xs text-white/60">Observaciones</span>
                              <textarea
                                value={editForm.observations}
                                onChange={(e) => setEditForm({ ...editForm, observations: e.target.value })}
                                rows={2}
                                className="rounded-lg bg-white text-black px-3 py-2 text-sm focus:outline-none"
                              />
                            </label>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => saveEdit(entry.id)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm font-semibold transition cursor-pointer"
                            >
                              <Check size={14} /> Guardar
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-full text-sm font-semibold transition cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── MODO VISTA ── */
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{entry.registrationNumber}</p>
                              <p className="text-sm text-white/65">{entry.tramiteCode} · {entry.technicianName}</p>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(entry.status)}`}>
                              {entry.status}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{entry.technicianArea}</span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Prog: {formatDate(entry.scheduleDate)}</span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Reg: {formatDate(entry.registrationDate)}</span>
                            {entry.scheduledTime && (
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">🕐 {entry.scheduledTime}</span>
                            )}
                          </div>

                          {entry.observations && (
                            <p className="mt-2 text-sm text-white/65">{entry.observations}</p>
                          )}

                          {/* Confirmación de eliminación */}
                          {confirmDeleteId === entry.id ? (
                            <div className="mt-3 flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-2xl px-3 py-2">
                              <span className="text-xs text-white/80 flex-1">¿Eliminar {entry.registrationNumber}?</span>
                              <button
                                onClick={() => confirmDelete(entry.id)}
                                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs font-semibold cursor-pointer"
                              >
                                Sí, eliminar
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-3 py-1 bg-white/15 hover:bg-white/25 text-white rounded-full text-xs font-semibold cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => startEdit(entry.id)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-xs font-semibold transition cursor-pointer"
                              >
                                <Pencil size={12} /> Editar
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(entry.id)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-red-500/60 text-white rounded-full text-xs font-semibold border border-white/15 transition cursor-pointer"
                              >
                                <Trash2 size={12} /> Eliminar
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
