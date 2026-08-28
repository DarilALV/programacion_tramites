"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  countEntriesForTechnicianOnDate,
  formatDate,
  getAreaTone,
  getNextRegistrationNumber,
  initialForm,
  technicians,
  useTramitesStore,
} from "@/lib/tramites-store";
import { validateEntryForm, type FormErrors } from "@/lib/validators";

export default function NuevoTramitePage() {
  const { currentUser, createEntry, entries } = useTramitesStore();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");

  const technician = technicians.find((item) => item.id === form.technicianId) ?? technicians[0];
  const registrationNumber = useMemo(() => getNextRegistrationNumber(entries), [entries]);
  const technicianCount = useMemo(
    () => countEntriesForTechnicianOnDate(entries, technician.id, form.scheduleDate),
    [entries, form.scheduleDate, technician.id],
  );

function handleCreateEntry() {
  const validation = validateEntryForm(form);

  if (!validation.success) {
    setErrors(validation.errors);
    setMessageType("error");
    setMessage("Por favor corrige los errores marcados");
    return;
  }

  // Calcular hora programada
  const scheduledTimeData = calculateScheduledTime();
  
  // Agregar hora al entry
  const entryWithTime = {
    ...validation.data,
    scheduledTime: scheduledTimeData.time,
    scheduledEndTime: scheduledTimeData.endTime,
  };

  setErrors({});
  createEntry(entryWithTime);
  setForm(initialForm);
  setMessageType("success");
  setMessage("✅ Registro guardado correctamente a las " + scheduledTimeData.time);

  setTimeout(() => setMessage(""), 3000);
}
// Calcular hora automáticamente
const calculateScheduledTime = () => {
  if (!form.scheduleDate) return { time: "--:--", endTime: "--:--" };
  
  // Contar cuántos trámites ya hay programados para ese técnico en esa fecha
  const tramitesEnEsaFecha = entries.filter(
    (e) =>
      e.scheduleDate === form.scheduleDate &&
      e.technicianId === form.technicianId
  ).length;
  
  const DURACION_TRAMITE = 15; // minutos promedio
  const HORA_INICIO = 8; // 08:00
  
  // Calcular minutos totales desde inicio
  const minutosDesdeInicio = tramitesEnEsaFecha * DURACION_TRAMITE;
  
  // Hora y minuto de INICIO
  const horaCalculada = HORA_INICIO + Math.floor(minutosDesdeInicio / 60);
  const minutosCalculados = minutosDesdeInicio % 60;
  
  // Hora y minuto de FIN (inicio + duración)
  const minutosTotalFin = minutosDesdeInicio + DURACION_TRAMITE;
  const horaFin = HORA_INICIO + Math.floor(minutosTotalFin / 60);
  const minutosFin = minutosTotalFin % 60;
  
  const time = `${String(horaCalculada).padStart(2, '0')}:${String(minutosCalculados).padStart(2, '0')}`;
  const endTime = `${String(horaFin).padStart(2, '0')}:${String(minutosFin).padStart(2, '0')}`;
  
  return { time, endTime };
};

const scheduledTimeCalculated = calculateScheduledTime();

  return (
    <AppShell
      title="Registro directo de programación"
      description="El registro se guarda de forma directa para evitar doble trabajo."
      eyebrow="Registro"
    >
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl text-[#1a140d]">Formulario de programación</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/70">
                Registra trámite, técnico, fecha de programación y observaciones. El sistema asigna número de registro automáticamente.
              </p>
            </div>
            <div className="rounded-full border border-black/10 bg-[#f7f4ee] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-black/65">
              {currentUser.name}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/45">Número de registro</div>
              <div className="mt-2 text-2xl font-semibold text-[#151515]">{registrationNumber}</div>
            </div>
            <div className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/45">Fecha de registro</div>
              <div className="mt-2 text-lg font-semibold text-[#151515]">{formatDate(new Date().toISOString().slice(0, 10))}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                   Nro. de trámite / código largo
                 </span>
                <input
                  value={form.tramiteCode}
                   onChange={(event) => setForm({ ...form, tramiteCode: event.target.value })}
                  className={`rounded-2xl border-2 border-pink-200 px-4 py-3 bg-pink-50 focus:border-pink-500 focus:outline-none transition ${
                    errors.tramiteCode
                       ? "border-red-300 bg-red-50 focus:ring-2 focus:ring-red-300/50"
                      : "border-black/10 bg-[#fcfcfb] focus:ring-2 focus:ring-[#151515]/15"
                }`}
                placeholder="Ej: 2026016618"
              />
              {errors.tramiteCode && (
               <span className="text-xs font-medium text-red-600">⚠️ {errors.tramiteCode}</span>
             )}
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                Técnico asignado
              </span>
              <select
                value={form.technicianId}
                onChange={(event) => setForm({ ...form, technicianId: event.target.value })}
                className="rounded-2xl border-2 border-pink-200 px-4 py-3 bg-pink-50 focus:border-pink-500 focus:outline-none transition"
              >
                {technicians.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.areaLabel}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                  Fecha de programación
              </span>
              <input
                type="date"
                value={form.scheduleDate}
                onChange={(event) => setForm({ ...form, scheduleDate: event.target.value })}
                className={`rounded-2xl border-2 border-pink-200 px-4 py-3 bg-pink-50 focus:border-pink-500 focus:outline-none transition ${
                    errors.scheduleDate
                      ? "border-red-300 bg-red-50 focus:ring-2 focus:ring-red-300/50"
                      : "border-black/10 bg-[#fcfcfb] focus:ring-2 focus:ring-[#151515]/15"
                }`}
              />
              {errors.scheduleDate && (
                <span className="text-xs font-medium text-red-600">⚠️ {errors.scheduleDate}</span>
              )}
            </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                Hora programada
              </span>
            <div className="rounded-2xl border-2 border-pink-200 bg-pink-50 px-4 py-3 flex items-center justify-between">
              <span className="text-lg font-semibold text-pink-900">
                {scheduledTimeCalculated.time}
              </span>
              <span className="text-xs text-pink-600">
                  (hasta {scheduledTimeCalculated.endTime})
              </span>
            </div>
              <p className="text-xs text-gray-500">
                Calculada automáticamente: 15 min por trámite
              </p>
            </label>
  
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                Duración estimada
              </span>
              <div className="rounded-2xl border-2 border-pink-200 bg-pink-50 px-4 py-3">
                <span className="text-lg font-semibold text-pink-900">15 minutos</span>
              </div>
                <p className="text-xs text-gray-500">
                  Rango: 15-20 minutos
              </p>
            </label>
          </div>  

            <label className="grid gap-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                  Observaciones
                  <span className="text-black/45 ml-1">
                    ({form.observations.length}/500)
                  </span>
                </span>
                <textarea
                  value={form.observations}
                  onChange={(event) => setForm({ ...form, observations: event.target.value })}
                  rows={4}
                  className={`rounded-2xl border-2 border-pink-200 px-4 py-3 bg-pink-50 focus:border-pink-500 focus:outline-none transition ${
                    errors.observations
                      ? "border-red-300 bg-red-50 focus:ring-2 focus:ring-red-300/50"
                      : "border-black/10 bg-[#fcfcfb] focus:ring-2 focus:ring-[#151515]/15"
                  }`}
                  placeholder="Observación operativa, pendiente, seguimiento..."
                />
                {errors.observations && (
                  <span className="text-xs font-medium text-red-600">⚠️ {errors.observations}</span>
                )}
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCreateEntry}
              className="rounded-full bg-pink-600 px-6 py-3 font-semibold text-white hover:bg-pink-700 shadow-md transition"
            >
              Registrar trámite
            </button>
            <Link
              href="/tramites/mis-tramites"
              className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-black"
            >
              Ver mis registros
            </Link>
          </div>

          {message && (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm transition ${
                messageType === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : messageType === "error"
                    ? "border-red-200 bg-red-50 text-pink-700"
                    : "border-black/10 bg-[#f7f3ea] text-black/75"
              }`}
            >
              {message}
            </div>
            )}
        </article>

        <aside className="grid gap-4">
          <div className="rounded-4xl border border-black/10 bg-[#c684cb] p-6 text-white shadow-[0_16px_40px_rgba(17,17,17,0.16)]">
            <h2 className="font-serif text-3xl text-white">Contador del técnico</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Para la fecha seleccionada, este técnico tiene actualmente:
            </p>
            <div className="mt-4 text-5xl font-semibold">{technicianCount}</div>
            <div className="mt-2 text-sm text-white/70">registros programados</div>
          </div>

          <div className="rounded-4xl border border-black/10 bg-[#fffaf1] p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
            <h3 className="font-serif text-2xl text-[#1a140d]">Técnico seleccionado</h3>
            <div className="mt-4">
              <div className="text-lg font-semibold text-[#151515]">{technician.name}</div>
              <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getAreaTone(technician.areaLabel)}`}>
                {technician.areaLabel}
              </div>
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
