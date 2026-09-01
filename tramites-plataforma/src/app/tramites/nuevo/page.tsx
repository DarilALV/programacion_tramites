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

// Feriados Bolivia 2026-2027 (nacionales + Cochabamba)
const FERIADOS = new Set([
  "2026-01-01", // Año Nuevo
  "2026-02-16", // Carnaval Lunes
  "2026-02-17", // Carnaval Martes
  "2026-04-03", // Viernes Santo
  "2026-05-01", // Día del Trabajo
  "2026-06-04", // Corpus Christi
  "2026-06-21", // Año Nuevo Andino Amazónico
  "2026-08-06", // Día de la Independencia
  "2026-09-14", // Batalla de la Coronilla (Cbba)
  "2026-11-02", // Día de los Difuntos
  "2026-12-25", // Navidad
  "2027-01-01", // Año Nuevo
  "2027-02-08", // Carnaval Lunes
  "2027-02-09", // Carnaval Martes
  "2027-03-26", // Viernes Santo
  "2027-05-01", // Día del Trabajo
  "2027-05-27", // Corpus Christi
  "2027-06-21", // Año Nuevo Andino
  "2027-08-06", // Independencia
  "2027-09-14", // Coronilla (Cbba)
  "2027-11-02", // Difuntos
  "2027-12-25", // Navidad
]);

function isWeekend(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

function isHoliday(dateStr: string) {
  return FERIADOS.has(dateStr);
}

function getDateError(dateStr: string): string | null {
  if (!dateStr) return "Selecciona una fecha";
  if (isWeekend(dateStr)) return "No se puede programar en fin de semana (sábado o domingo)";
  if (isHoliday(dateStr)) {
    return "Esa fecha es feriado nacional o departamental — elige otro día hábil";
  }
  return null;
}

export default function NuevoTramitePage() {
  const { currentUser, createEntry, entries } = useTramitesStore();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState(() => ({
    ...initialForm,
    scheduleDate: todayStr,
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [registroTime, setRegistroTime] = useState<string>("");

  const technician = technicians.find((item) => item.id === form.technicianId) ?? technicians[0];
  const registrationNumber = useMemo(() => getNextRegistrationNumber(entries), [entries]);
  const technicianCount = useMemo(
    () => countEntriesForTechnicianOnDate(entries, technician.id, form.scheduleDate),
    [entries, form.scheduleDate, technician.id],
  );

  const dateError = form.scheduleDate ? getDateError(form.scheduleDate) : null;

  function handleDateChange(value: string) {
    setForm({ ...form, scheduleDate: value });
    setErrors({ ...errors, scheduleDate: undefined });
  }

  async function handleCreateEntry() {
    if (dateError) {
      setErrors({ ...errors, scheduleDate: dateError });
      return;
    }

    const validation = validateEntryForm(form);
    if (!validation.success) {
      setErrors(validation.errors);
      setMessageType("error");
      setMessage("Por favor corrige los errores marcados");
      return;
    }

    // Hora del servidor para el registro
    let horaActual = "";
    try {
      const res = await fetch("/api/hora", { cache: "no-store" });
      const data = await res.json();
      horaActual = data.time;
    } catch {
      const n = new Date();
      horaActual = `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
    }
    setRegistroTime(horaActual);

    const scheduledTimeData = calculateScheduledTime();
    const entryWithTime = {
      ...validation.data,
      scheduledTime: scheduledTimeData.time,
      scheduledEndTime: scheduledTimeData.endTime,
    };

    setErrors({});
    createEntry(entryWithTime);
    setForm({ ...initialForm, scheduleDate: todayStr });
    setMessageType("success");
    setMessage(`✅ Programación registrada a las ${horaActual} — Hora asignada: ${scheduledTimeData.time}`);
    setTimeout(() => setMessage(""), 4000);
  }

  function calculateScheduledTime() {
    if (!form.scheduleDate) return { time: "--:--", endTime: "--:--" };

    const tramitesEnEsaFecha = entries.filter(
      (e) => e.scheduleDate === form.scheduleDate && e.technicianId === form.technicianId
    ).length;

    const DURACION = 15;
    const HORA_INICIO = 8;
    const minutosDesdeInicio = tramitesEnEsaFecha * DURACION;
    const horaCalculada = HORA_INICIO + Math.floor(minutosDesdeInicio / 60);
    const minutosCalculados = minutosDesdeInicio % 60;
    const minutosTotalFin = minutosDesdeInicio + DURACION;
    const horaFin = HORA_INICIO + Math.floor(minutosTotalFin / 60);
    const minutosFin = minutosTotalFin % 60;

    return {
      time: `${String(horaCalculada).padStart(2, "0")}:${String(minutosCalculados).padStart(2, "0")}`,
      endTime: `${String(horaFin).padStart(2, "0")}:${String(minutosFin).padStart(2, "0")}`,
    };
  }

  const scheduledTimeCalculated = calculateScheduledTime();
  const horaLimiteExcedida = scheduledTimeCalculated.time >= "12:00";

  return (
    <AppShell
      title="Nueva Programación"
      description="Registra un trámite con técnico, fecha y horario automático."
      eyebrow="PROGRAMACIONES"
    >
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-4xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_rgba(26,21,12,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl text-[#1a140d]">Formulario de programación</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/70">
                Registra trámite, técnico y fecha. El sistema asigna número de registro y hora automáticamente.
              </p>
            </div>
            <div className="rounded-full border border-black/10 bg-[#f7f4ee] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-black/65">
              {currentUser.name}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/45">N° de registro</div>
              <div className="mt-2 text-2xl font-semibold text-[#151515]">{registrationNumber}</div>
            </div>
            <div className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/45">Fecha de registro</div>
              <div className="mt-2 text-base font-semibold text-[#151515]">{formatDate(todayStr)}</div>
            </div>
            <div className="rounded-3xl border border-black/10 bg-[#f7f4ee] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/45">Hora de registro</div>
              <div className="mt-2 text-base font-semibold text-[#151515]">
                {registroTime || <span className="text-black/40 text-sm">Se registra al guardar</span>}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                Nro. de trámite / código largo
              </span>
              <input
                value={form.tramiteCode}
                onChange={(e) => setForm({ ...form, tramiteCode: e.target.value })}
                className={`rounded-2xl border-2 px-4 py-3 focus:outline-none transition ${
                  errors.tramiteCode
                    ? "border-red-300 bg-red-50"
                    : "border-pink-200 bg-pink-50 focus:border-pink-500"
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
                onChange={(e) => setForm({ ...form, technicianId: e.target.value })}
                className="rounded-2xl border-2 border-pink-200 bg-pink-50 px-4 py-3 focus:border-pink-500 focus:outline-none transition"
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
                onChange={(e) => handleDateChange(e.target.value)}
                min={todayStr}
                className={`rounded-2xl border-2 px-4 py-3 focus:outline-none transition ${
                  errors.scheduleDate || dateError
                    ? "border-red-300 bg-red-50"
                    : "border-pink-200 bg-pink-50 focus:border-pink-500"
                }`}
              />
              {(errors.scheduleDate || dateError) && (
                <span className="text-xs font-medium text-red-600">
                  ⚠️ {errors.scheduleDate ?? dateError}
                </span>
              )}
              {!dateError && form.scheduleDate && (
                <span className="text-xs text-green-700 font-medium">✓ Día hábil</span>
              )}
            </label>

            <div className="grid gap-4 md:grid-cols-2 md:col-span-2">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                  Hora programada
                </span>
                <div className={`rounded-2xl border-2 px-4 py-3 flex items-center justify-between ${
                  horaLimiteExcedida ? "border-red-300 bg-red-50" : "border-pink-200 bg-pink-50"
                }`}>
                  <span className={`text-lg font-semibold ${horaLimiteExcedida ? "text-red-700" : "text-pink-900"}`}>
                    {scheduledTimeCalculated.time}
                  </span>
                  <span className="text-xs text-pink-600">→ {scheduledTimeCalculated.endTime}</span>
                </div>
                {horaLimiteExcedida && (
                  <span className="text-xs text-red-600 font-semibold">
                    ⛔ Horario fuera del rango 08:00–12:00
                  </span>
                )}
                <p className="text-xs text-gray-500">Automática: 15 min por trámite</p>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                  Trámites programados ese día
                </span>
                <div className="rounded-2xl border-2 border-pink-200 bg-pink-50 px-4 py-3">
                  <span className={`text-2xl font-semibold ${technicianCount >= 14 ? "text-red-700" : "text-pink-900"}`}>
                    {technicianCount}
                  </span>
                  <span className="text-sm text-pink-600 ml-1">/ 16 máx.</span>
                </div>
                {technicianCount >= 16 && (
                  <span className="text-xs text-red-600 font-semibold">⛔ Técnico con agenda llena</span>
                )}
              </label>
            </div>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                Observaciones <span className="text-black/45 ml-1">({form.observations.length}/500)</span>
              </span>
              <textarea
                value={form.observations}
                onChange={(e) => setForm({ ...form, observations: e.target.value })}
                rows={3}
                className={`rounded-2xl border-2 px-4 py-3 focus:outline-none transition ${
                  errors.observations
                    ? "border-red-300 bg-red-50"
                    : "border-pink-200 bg-pink-50 focus:border-pink-500"
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
              disabled={!!dateError || horaLimiteExcedida}
              className={`rounded-full px-6 py-3 font-semibold text-white shadow-md transition ${
                dateError || horaLimiteExcedida
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-pink-600 hover:bg-pink-700 cursor-pointer"
              }`}
            >
              Registrar programación
            </button>
            <Link
              href="/tramites/mis-tramites"
              className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-black"
            >
              Ver mis programaciones
            </Link>
          </div>

          {message && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm transition ${
              messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {message}
            </div>
          )}
        </article>

        <aside className="grid gap-4 content-start">
          <div className="rounded-4xl border border-black/10 bg-[#c684cb] p-6 text-white shadow-[0_16px_40px_rgba(17,17,17,0.16)]">
            <h2 className="font-serif text-3xl text-white">Técnico</h2>
            <p className="mt-2 text-sm text-white/70">Programaciones para la fecha seleccionada:</p>
            <div className={`mt-4 text-6xl font-semibold ${technicianCount >= 14 ? "text-red-200" : ""}`}>
              {technicianCount}
            </div>
            <div className="mt-1 text-sm text-white/70">de 16 máximo</div>
            <div className="mt-3 w-full bg-white/20 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${technicianCount >= 16 ? "bg-red-400" : technicianCount >= 12 ? "bg-yellow-300" : "bg-green-300"}`}
                style={{ width: `${Math.min((technicianCount / 16) * 100, 100)}%` }}
              />
            </div>
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

          <div className="rounded-4xl border-2 border-blue-200 bg-blue-50 p-5 text-sm space-y-2 text-blue-900">
            <p className="font-bold">ℹ️ Reglas de programación</p>
            <ul className="space-y-1 text-xs">
              <li>✓ Solo días de lunes a viernes</li>
              <li>✓ Horario: 08:00 – 12:00</li>
              <li>✓ 15 minutos por trámite (máx. 16)</li>
              <li>✓ No se programan feriados nacionales ni departamentales</li>
            </ul>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
