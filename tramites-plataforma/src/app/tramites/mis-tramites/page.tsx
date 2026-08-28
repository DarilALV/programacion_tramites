"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { formatDate, getStatusTone, useTramitesStore } from "@/lib/tramites-store";
import { Search, ChevronLeft, ChevronRight, X } from "lucide-react";

export default function MisTramitesPage() {
  const { currentUser, myEntries, removeEntry } = useTramitesStore();
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Filtrar por búsqueda
  const filteredBySearch = useMemo(() => {
    if (!searchTerm.trim()) return myEntries;
    
    const term = searchTerm.toLowerCase();
    return myEntries.filter(
      (entry) =>
        entry.tramiteCode.toLowerCase().includes(term) ||
        entry.registrationNumber.toLowerCase().includes(term) ||
        entry.technicianName.toLowerCase().includes(term) ||
        entry.observations.toLowerCase().includes(term)
    );
  }, [myEntries, searchTerm]);

  // Filtrar por fecha si está seleccionada
  const filteredEntries = useMemo(() => {
    if (!selectedDate) return filteredBySearch;
    return filteredBySearch.filter((entry) => entry.registrationDate === selectedDate);
  }, [filteredBySearch, selectedDate]);

  // Agrupar por fecha para mostrar
  const entriesByDate = useMemo(() => {
    const map = new Map<string, typeof myEntries>();
    filteredEntries.forEach((entry) => {
      const date = entry.registrationDate;
      if (!map.has(date)) {
        map.set(date, []);
      }
      map.get(date)!.push(entry);
    });

    return Array.from(map.entries())
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([date, entries]) => ({
        date,
        entries: entries.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      }));
  }, [filteredEntries]);

  // Mapeo de trámites por fecha para el calendario
  const entriesByDateMap = useMemo(() => {
    const map = new Map<string, number>();
    myEntries.forEach((entry) => {
      const date = entry.registrationDate;
      map.set(date, (map.get(date) ?? 0) + 1);
    });
    return map;
  }, [myEntries]);

  // Lógica del calendario
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days = [
    ...Array.from({ length: firstDay }, (_, i) => ({
      day: daysInPrevMonth - firstDay + i + 1,
      isCurrentMonth: false,
      date: new Date(year, month - 1, daysInPrevMonth - firstDay + i + 1),
    })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      isCurrentMonth: true,
      date: new Date(year, month, i + 1),
    })),
    ...Array.from(
      { length: 42 - firstDay - daysInMonth },
      (_, i) => ({
        day: i + 1,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i + 1),
      })
    ),
  ];

  const formatDateKey = (date: Date) => date.toISOString().slice(0, 10);
  const monthName = new Date(year, month, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    const dateKey = formatDateKey(date);
    setSelectedDate(selectedDate === dateKey ? null : dateKey);
  };

  return (
    <AppShell
      title="Mis registros"
      description="Aquí cada usuaria ve sus registros ya guardados directamente en el sistema."
      eyebrow="Seguimiento personal"
    >
      <section className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* SIDEBAR IZQUIERDO - Sin cambios, tu diseño original */}
        <aside className="rounded-4xl border border-black/10 bg-[#fffaf1] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <h2 className="font-serif text-3xl text-[#1a140d]">Usuaria activa</h2>
          <p className="mt-2 text-sm leading-6 text-black/70">
            Esta vista muestra solamente el trabajo de {currentUser.name}.
          </p>

          <div className="mt-6 rounded-3xl border border-black/10 bg-white p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-black/45">Perfil</div>
            <div className="mt-2 text-xl font-semibold">Registradora</div>
            <div className="text-sm text-black/60">Programación de trámites</div>
          </div>

          <div className="mt-4 rounded-3xl border border-black/10 bg-white p-4 text-sm text-black/70">
            Total de registros propios: <strong className="text-black">{myEntries.length}</strong>
          </div>

          <Link
            href="/tramites/nuevo"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#151515] px-5 py-3 text-sm font-semibold text-white"
          >
            Crear nuevo registro
          </Link>
        </aside>

        {/* CONTENIDO PRINCIPAL - MEJORADO CON BÚSQUEDA Y CALENDARIO */}
        <article className="rounded-4xl border border-black/10 bg-[#975c95] p-6 text-white shadow-[0_16px_40px_rgba(17,17,17,0.16)]">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="font-serif text-3xl text-white">Listado personal</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Todos los registros aquí ya están visibles para supervisión de forma automática.
              </p>
            </div>
            <div className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/75">
              {currentUser.name}
            </div>
          </div>

          {/* BUSCADOR */}
          <div className="mb-6 relative">
            <Search size={18} className="absolute left-4 top-3.5 text-white/50" />
            <input
              type="text"
              placeholder="Buscar código, técnico, observaciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full border border-white/10 bg-white/5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          {/* CALENDARIO MINI */}
          <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4">
            {/* Header calendario */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-white/10 rounded-full transition"
              >
                <ChevronLeft size={16} className="text-white/70" />
              </button>
              <h3 className="font-semibold text-sm capitalize text-white">{monthName}</h3>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-white/10 rounded-full transition"
              >
                <ChevronRight size={16} className="text-white/70" />
              </button>
            </div>

            {/* Días de la semana */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {["D", "L", "M", "X", "J", "V", "S"].map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-white/50">
                  {day}
                </div>
              ))}
            </div>

            {/* Días del calendario */}
            <div className="grid grid-cols-7 gap-2">
              {days.map((dayObj, idx) => {
                const dateKey = formatDateKey(dayObj.date);
                const count = entriesByDateMap.get(dateKey) ?? 0;
                const isSelected = selectedDate === dateKey;

                return (
                  <button
                    key={idx}
                    onClick={() => handleDateClick(dayObj.date)}
                    className={`aspect-square p-1 rounded-lg text-xs font-semibold transition ${
                      !dayObj.isCurrentMonth
                        ? "bg-transparent text-white/30"
                        : isSelected
                          ? "bg-white text-[#151515]"
                          : count > 0
                            ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
                            : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    <div>{dayObj.day}</div>
                    {count > 0 && <div className="text-xs">{count}</div>}
                  </button>
                );
              })}
            </div>

            {/* Info de fecha seleccionada */}
            {selectedDate && (
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                  <div className="text-xs text-white/60">
                    {filteredEntries.filter((e) => e.registrationDate === selectedDate).length} trámite
                    {filteredEntries.filter((e) => e.registrationDate === selectedDate).length !== 1
                      ? "s"
                      : ""}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-1 hover:bg-white/10 rounded-full transition"
                >
                  <X size={16} className="text-white/70" />
                </button>
              </div>
            )}
          </div>

          {/* LISTADO DE TRÁMITES */}
          <div className="mt-5 grid gap-3">
            {filteredEntries.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/70">
                {searchTerm || selectedDate
                  ? "No se encontraron registros con los criterios de búsqueda."
                  : "Aún no tienes registros."}
              </div>
            ) : (
              entriesByDate.map((group) => (
                <div key={group.date}>
                  {/* Header de fecha */}
                  <div className="text-xs uppercase tracking-[0.18em] text-white/50 font-semibold mb-2 px-1">
                    {new Date(`${group.date}T00:00:00`).toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    <span className="text-white/40 ml-2">
                      ({group.entries.length} {group.entries.length === 1 ? "trámite" : "trámites"})
                    </span>
                  </div>

                  {/* Trámites de esa fecha */}
                  {group.entries.map((entry) => (
                    <div key={entry.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 mb-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{entry.registrationNumber}</div>
                          <div className="text-sm text-white/65">
                            {entry.tramiteCode} · {entry.technicianName}
                          </div>
                        </div>
                        <div
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(
                            entry.status
                          )}`}
                        >
                          {entry.status}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/75">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          {entry.technicianArea}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          Programación: {formatDate(entry.scheduleDate)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          Registro: {formatDate(entry.registrationDate)}
                        </span>
                      </div>

                      {entry.observations && (
                        <p className="mt-3 text-sm leading-6 text-white/70">{entry.observations}</p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            removeEntry(entry.id);
                            setMessage(`El trámite ${entry.registrationNumber} fue eliminado.`);
                            setTimeout(() => setMessage(""), 5000);
                          }}
                          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 transition"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {message ? (
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
              ✓ {message}
            </div>
          ) : null}
        </article>
      </section>
    </AppShell>
  );
}
