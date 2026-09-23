"use client";

import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import { AppShell } from "@/components/app-shell";
import { ToastAlert } from "@/components/toast-alert";
import { technicians, useTramitesStore, type Entry, type FollowUp } from "@/lib/tramites-store";
import { getServerNow } from "@/lib/server-time";

type FollowUpStatus = "esperando" | "llamado" | "no-escucho" | "regreso" | "completado" | "atendiendo" | "en-revision";

function minDiff(from: string, to?: string) {
  const [fh, fm] = from.split(":").map(Number);
  if (to) { const [th, tm] = to.split(":").map(Number); return (th * 60 + tm) - (fh * 60 + fm); }
  const n = new Date(); return (n.getHours() * 60 + n.getMinutes()) - (fh * 60 + fm);
}
function fmtMin(m: number) {
  if (m <= 0) return "< 1 min"; if (m < 60) return `${m} min`;
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

function notifyBrowser(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}

const STATUS_LABEL: Record<FollowUpStatus, string> = {
  "esperando":    "⏳ Esperando",
  "llamado":      "📣 Llamado",
  "no-escucho":   "🔇 No escuchó",
  "regreso":      "↩️ Regresó",
  "completado":   "✅ Completado",
  "atendiendo":   "👤 Atendiendo (antiguo)",
  "en-revision":  "📋 En revisión (antiguo)",
};

interface AgendaRowProps {
  entry: Entry;
  followUp?: FollowUp;
  onSaliALlamar: (id: string, followUpCreatedAt?: string) => void;
  onAtendi: (id: string, followUpCreatedAt?: string) => void;
  onNoRespondio: (id: string, followUpCreatedAt?: string) => void;
  onTermineDeAtender: (id: string, followUpCreatedAt?: string) => void;
  onContinuarEtapa?: (id: string) => void;
}

const AgendaRow = memo(function AgendaRow({
  entry,
  followUp: propsFollowUp,
  onSaliALlamar,
  onAtendi,
  onNoRespondio,
  onTermineDeAtender,
  onContinuarEtapa,
}: AgendaRowProps) {
  const fu = propsFollowUp ?? entry.followUps?.[0];
  const st = (fu?.followUpStatus ?? (fu ? "esperando" : undefined)) as FollowUpStatus | undefined;

  const rowBg =
    st === "completado"   ? "bg-green-50 border-green-400" :
    st === "llamado"      ? "bg-purple-50 border-purple-400" :
    st === "regreso"      ? "bg-yellow-50 border-yellow-400" :
    st === "no-escucho"   ? "bg-orange-50 border-orange-300" :
    st === "esperando"    ? "bg-red-100 border-red-500 animate-pulse" :
    "bg-white border-gray-200";

  const esperaMinutos = fu?.arrivalTime ? minDiff(fu.arrivalTime, fu.completedTime) : null;
  const atencionMinutos = fu?.attendedTime && fu?.completedTime ? minDiff(fu.attendedTime, fu.completedTime) : null;
  const llamadoHaceMin = st === "llamado" && fu?.calledTime ? minDiff(fu.calledTime) : null;

  return (
    <div className={`p-5 border-l-4 ${rowBg}`}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
        {/* Trámite */}
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Trámite</p>
          <p className="font-mono font-bold text-base">{entry.tramiteCode}</p>
          <p className="text-xs text-gray-400">{entry.registrationNumber}</p>
          {entry.scheduledTime && (
            <p className="text-xs text-blue-700 mt-1">{entry.scheduledTime}{entry.scheduledEndTime ? ` – ${entry.scheduledEndTime}` : ""}</p>
          )}
          {fu?.isUnscheduled && <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded mt-1 inline-block">sin prog.</span>}
        </div>

        {/* Cliente + tiempos */}
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Cliente</p>
          <p className="font-semibold">{fu?.clientName ?? "—"}</p>
          {fu?.arrivalTime && <p className="text-xs text-pink-700 font-semibold mt-1">📍 Llegó: {fu.arrivalTime}</p>}
          {fu?.calledTime && <p className="text-xs text-purple-700">📣 Salí: {fu.calledTime}</p>}
          {fu?.returnedTime && <p className="text-xs text-yellow-700">↩️ Regresé: {fu.returnedTime}</p>}
          {fu?.attendedTime && <p className="text-xs text-blue-700">👤 Atendido: {fu.attendedTime}</p>}
          {fu?.completedTime && <p className="text-xs text-green-700 font-semibold">✅ Terminé: {fu.completedTime}</p>}
        </div>

        {/* Estado + métricas */}
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Estado</p>
          <p className="font-bold">{st ? STATUS_LABEL[st] : "🕐 Sin llegada"}</p>
          {llamadoHaceMin !== null && llamadoHaceMin >= 0 && (
            <p className={`text-xs mt-1 font-semibold ${llamadoHaceMin > 10 ? "text-red-600" : "text-purple-700"}`}>
              Salí hace {fmtMin(llamadoHaceMin)}
            </p>
          )}
          {st === "completado" && esperaMinutos !== null && (
            <div className="mt-1 space-y-0.5">
              <p className="text-xs text-gray-500">Espera: <strong>{fmtMin(esperaMinutos)}</strong></p>
              {atencionMinutos !== null && <p className="text-xs text-gray-500">Atención: <strong>{fmtMin(atencionMinutos)}</strong></p>}
            </div>
          )}
        </div>

        {/* ── ACCIONES ── */}
        <div className="flex flex-col gap-2">
          {!fu && (
            <p className="text-xs text-gray-400 italic">Sin llegada registrada</p>
          )}

          {st === "esperando" && (
            <button onClick={() => onSaliALlamar(entry.id, fu?.createdAt)}
              className="px-3 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 cursor-pointer shadow">
              🚶 Salgo a llamar
            </button>
          )}

          {st === "llamado" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-semibold">Al regresar:</p>
              <button onClick={() => onAtendi(entry.id, fu?.createdAt)}
                className="w-full px-3 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 cursor-pointer shadow">
                ✅ Lo atendí
              </button>
              <button onClick={() => onNoRespondio(entry.id, fu?.createdAt)}
                className="w-full px-3 py-2 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 cursor-pointer shadow">
                ↩️ No respondió
              </button>
            </div>
          )}

          {st === "no-escucho" && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
              <p className="text-xs text-orange-800 font-semibold">⏳ Esperando regreso</p>
            </div>
          )}

          {st === "regreso" && (
            <div className="space-y-2">
              <div className="rounded-lg bg-yellow-50 border border-yellow-300 p-2">
                <p className="text-xs text-yellow-800 font-semibold">↩️ Regresó</p>
              </div>
              <button onClick={() => onTermineDeAtender(entry.id, fu?.createdAt)}
                className="w-full px-3 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 cursor-pointer shadow">
                ✅ Terminé
              </button>
            </div>
          )}

          {st === "completado" && (
            <div className="space-y-2">
              <span className="text-sm text-green-700 font-bold">✓ Finalizado</span>
              {/* TEMPORALMENTE DESHABILITADO: Continuar en (en desarrollo) */}
              {false && onContinuarEtapa && (
                <button onClick={() => onContinuarEtapa?.(entry.id)}
                  className="w-full px-3 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 cursor-pointer shadow">
                  ➡️ Continuar en...
                </button>
              )}
            </div>
          )}

          {(st === "atendiendo" || st === "en-revision") && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 bg-yellow-50 px-2 py-1 rounded">
                ⚠️ Estado antiguo, haz clic para completar
              </p>
              <button onClick={() => onTermineDeAtender(entry.id, fu?.createdAt)}
                className="w-full px-3 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 cursor-pointer shadow">
                ✅ Completar
              </button>
            </div>
          )}
        </div>
      </div>

      {entry.observations && (
        <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-100">📌 {entry.observations}</p>
      )}
    </div>
  );
});

export default function AgendaTecnicoPage() {
  const { entries, updateEntry, currentTechnicianId, loginTechnician, logoutTechnician, juntas, updateJunta, removeEntry, deleteJunta, crearSiguienteEtapa } = useTramitesStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [reportePeriodo, setReportePeriodo] = useState<"dia" | "semana" | "mes">("dia");
  const [notifAllowed, setNotifAllowed] = useState(false);
  const [toastShow, setToastShow] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [expandedJuntaId, setExpandedJuntaId] = useState<string | null>(null);
  const [autoDownloadedToday, setAutoDownloadedToday] = useState(false);
  const [continuingEntryId, setContinuingEntryId] = useState<string | null>(null);
  const [continuingToTechId, setContinuingToTechId] = useState("");

  const currentTechnician = technicians.find((t) => t.id === currentTechnicianId);
  const today = new Date().toISOString().slice(0, 10);

  // Si no hay técnico logged in, mostrar login modal
  const showLoginModal = !currentTechnicianId;

  function handlePinDigit(digit: string) {
    if (pinInput.length >= 4) return;
    const next = pinInput + digit;
    setPinInput(next);
  }

  function handleLogin() {
    if (!selectedTechnicianId || pinInput.length !== 4) return;
    if (pinInput === "0000") { // PIN maestro para demo
      loginTechnician(selectedTechnicianId);
      setPinInput("");
      setSelectedTechnicianId("");
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  }

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const checkAndRequest = async () => {
      if (Notification.permission === "granted") { setNotifAllowed(true); return; }
      if (Notification.permission !== "denied") {
        const p = await Notification.requestPermission();
        setNotifAllowed(p === "granted");
      }
    };
    void checkAndRequest();
  }, []);

  // Track known follow-up IDs in localStorage to survive page reloads
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentTechnicianId) return;
    // Load from localStorage on mount
    const stored = typeof window !== "undefined" ? localStorage.getItem(`notifIds-${currentTechnicianId}`) : null;
    if (stored) {
      knownIdsRef.current = new Set(JSON.parse(stored));
    }
  }, [currentTechnicianId]);

  useEffect(() => {
    if (!currentTechnicianId) return;
    const techEntries = entries.filter((e) => {
      const fu = e.followUps?.[0];
      const isThisTech = e.technicianId === currentTechnicianId || fu?.actualTechnicianId === currentTechnicianId;
      const isToday = e.scheduleDate === today || fu?.createdAt?.startsWith(today);
      return isThisTech && isToday && fu;
    });
    techEntries.forEach((e) => {
      const fu = e.followUps?.[0];
      if (!fu) return;
      const key = `${e.id}-arrived`;
      if (!knownIdsRef.current.has(key) && fu.arrivalTime) {
        if (knownIdsRef.current.size > 0) {
          notifyBrowser("🚶 Contribuyente llegó", `Trámite ${e.tramiteCode} — ${fu.clientName ?? "sin nombre"}`);
          setToastMessage(`🚶 ${fu.clientName ?? "Contribuyente"} llegó\nTrámite ${e.tramiteCode}`);
          setToastShow(true);
        }
        knownIdsRef.current.add(key);
      }
      const keyReg = `${e.id}-regreso`;
      if (!knownIdsRef.current.has(keyReg) && fu.followUpStatus === "regreso") {
        if (knownIdsRef.current.size > 0) {
          notifyBrowser("↩️ Contribuyente regresó", `Trámite ${e.tramiteCode} — ${fu.clientName ?? "sin nombre"}`);
          setToastMessage(`↩️ ${fu.clientName ?? "Contribuyente"} regresó\nTrámite ${e.tramiteCode}`);
          setToastShow(true);
        }
        knownIdsRef.current.add(keyReg);
      }
    });
    if (knownIdsRef.current.size === 0) {
      techEntries.forEach((e) => {
        const fu = e.followUps?.[0];
        if (!fu) return;
        if (fu.arrivalTime) knownIdsRef.current.add(`${e.id}-arrived`);
        if (fu.followUpStatus === "regreso") knownIdsRef.current.add(`${e.id}-regreso`);
      });
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(`notifIds-${currentTechnicianId}`, JSON.stringify(Array.from(knownIdsRef.current)));
    }
  }, [entries, currentTechnicianId, today]);

  // Auto-descarga de auditoría y reportes a las 16:30
  useEffect(() => {
    const checkAndDownload = async () => {
      if (autoDownloadedToday) return;
      const { time } = await getServerNow();
      if (time === "16:30") {
        await descargarReportesAutomatico();
        setAutoDownloadedToday(true);
      }
    };
    const interval = setInterval(checkAndDownload, 60000);
    return () => clearInterval(interval);
  }, [autoDownloadedToday, currentTechnicianId, entries, today]);

  const descargarReportesAutomatico = async () => {
    if (!currentTechnicianId) return;
    const XLSX = await import("xlsx");
    const { date } = await getServerNow();

    // CSV Auditoría
    const logs = localStorage.getItem("gmc-tramites-audit");
    if (logs) {
      const allLogs = JSON.parse(logs);
      const todayLogs = allLogs.filter((l: any) => l.timestamp?.startsWith(today));
      const csv = [
        ["Timestamp", "Operation", "Type", "Entity ID", "Code", "User", "Saved To", "Status", "Details"].join(","),
        ...todayLogs.map((log: any) =>
          [log.timestamp, log.operation, log.entityType, log.entityId, log.entityCode || "", log.userName,
            log.savedTo.join("|"), log.status, (log.details || "").replace(/"/g, '""')].join(",")
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reportes_auditoria_${date}.csv`;
      a.click();
    }

    // Excel Reportes Técnicos (calcular sobre la marcha)
    const todayEntries = entries.filter((e) => {
      const isThisTech = e.technicianId === currentTechnicianId;
      const hasFollowUpsToday = e.followUps?.some((fu) => fu.createdAt?.startsWith(today));
      return isThisTech && hasFollowUpsToday;
    });
    const rows = todayEntries.flatMap((entry) =>
      (entry.followUps ?? [])
        .filter((fu) => fu.createdAt?.startsWith(today))
        .map((followUp) => ({
          Hora: followUp.arrivalTime ?? "", Trámite: entry.tramiteCode, Registro: entry.registrationNumber,
          Cliente: followUp.clientName ?? "", Estado: followUp.followUpStatus ?? "",
          "Espera (min)": followUp.arrivalTime && followUp.attendedTime ? Math.round((new Date(`2000-01-01T${followUp.attendedTime}`).getTime() - new Date(`2000-01-01T${followUp.arrivalTime}`).getTime()) / 60000) : "",
          "Atención (min)": followUp.attendedTime && followUp.completedTime ? Math.round((new Date(`2000-01-01T${followUp.completedTime}`).getTime() - new Date(`2000-01-01T${followUp.attendedTime}`).getTime()) / 60000) : "",
          Observaciones: followUp.observations ?? "",
        }))
    );
    if (rows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Atenciones");
      XLSX.writeFile(wb, `reportes_tecnicos_${date}.xlsx`);
    }
  };

  const handleContinuarEtapa = (entryId: string, newTechId: string) => {
    const newTech = technicians.find((t) => t.id === newTechId);
    if (!newTech) return;

    crearSiguienteEtapa(entryId, newTechId, newTech.name, newTech.areaLabel);

    setToastMessage(`✅ Trámite derivado a ${newTech.name}`);
    setToastShow(true);
    setContinuingEntryId(null);
    setContinuingToTechId("");
  };

  const misJuntas = useMemo(() => {
    if (!currentTechnicianId) return [];
    return juntas
      .filter((j) => j.technicianId === currentTechnicianId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [juntas, currentTechnicianId]);

  const entriesByJunta = useMemo(() => {
    const map = new Map<string, Entry[]>();
    entries.forEach((e) => {
      if (e.juntaId) {
        if (!map.has(e.juntaId)) map.set(e.juntaId, []);
        map.get(e.juntaId)!.push(e);
      }
    });
    return map;
  }, [entries]);

  const agendaHoy = useMemo(() => {
    if (!currentTechnicianId) return [];
    return entries
      .filter((e) => {
        const hasTodayFollowUp = (e.followUps ?? []).some((fu) => {
          if (fu.createdAt?.startsWith(selectedDate)) {
            const isThisTech = e.technicianId === currentTechnicianId || fu.actualTechnicianId === currentTechnicianId || fu.technicianId === currentTechnicianId;
            return isThisTech;
          }
          return false;
        });
        if (hasTodayFollowUp) return true;

        const isThisDate = e.scheduleDate === selectedDate;
        const isThisTech = e.technicianId === currentTechnicianId;
        return isThisDate && isThisTech && (e.followUps ?? []).length > 0;
      })
      .sort((a, b) => {
        const ta = a.followUps?.[0]?.arrivalTime ?? a.scheduledTime ?? "00:00";
        const tb = b.followUps?.[0]?.arrivalTime ?? b.scheduledTime ?? "00:00";
        return ta.localeCompare(tb);
      });
  }, [entries, selectedDate, currentTechnicianId]);

  const expandedAgendaHoy = useMemo(() => {
    return agendaHoy.flatMap((entry) => {
      const todayFollowUps = (entry.followUps ?? []).filter((followUp) => {
        if (!followUp.createdAt?.startsWith(selectedDate)) return false;
        return entry.technicianId === currentTechnicianId || followUp.technicianId === currentTechnicianId;
      });
      if (todayFollowUps.length === 0) return [];
      return todayFollowUps.map((followUp) => ({ entry, followUp }));
    });
  }, [agendaHoy, selectedDate, currentTechnicianId]);

  // Report data
  const reportEntries = useMemo(() => {
    if (!currentTechnicianId) return [];
    let from: string, to: string;
    if (reportePeriodo === "dia") { from = to = selectedDate; }
    else if (reportePeriodo === "semana") { const r = weekRange(selectedDate); from = r.from; to = r.to; }
    else { const r = monthRange(selectedDate); from = r.from; to = r.to; }

    // Contar trámites ÚNICOS que tienen al menos un followUp en el rango
    return entries.filter((e) => {
      if (!e.followUps?.length) return false;

      // Verificar si al menos un followUp de este técnico cae en el rango
      return (e.followUps ?? []).some((fu) => {
        const isThisTech = e.technicianId === currentTechnicianId || fu.actualTechnicianId === currentTechnicianId;
        if (!isThisTech) return false;

        const d = fu.createdAt?.slice(0, 10) ?? e.scheduleDate ?? "";
        return d >= from && d <= to;
      });
    });
  }, [entries, currentTechnicianId, selectedDate, reportePeriodo]);

  const reportStats = useMemo(() => {
    const getLastFollowUp = (e: Entry) => e.followUps?.[e.followUps.length - 1];

    const completados = reportEntries.filter((e) => getLastFollowUp(e)?.followUpStatus === "completado");
    const noEscucho = reportEntries.filter((e) => getLastFollowUp(e)?.followUpStatus === "no-escucho");
    const enProceso = reportEntries.filter((e) => {
      const st = getLastFollowUp(e)?.followUpStatus;
      return st && ["esperando", "en-revision", "llamado", "regreso"].includes(st);
    });

    const waitTimes = completados
      .map((e) => {
        const fu = getLastFollowUp(e);
        return fu?.arrivalTime && fu?.attendedTime ? minDiff(fu.arrivalTime, fu.attendedTime) : null;
      })
      .filter((v): v is number => v !== null && v >= 0);
    const attnTimes = completados
      .map((e) => {
        const fu = getLastFollowUp(e);
        return fu?.attendedTime && fu?.completedTime ? minDiff(fu.attendedTime, fu.completedTime) : null;
      })
      .filter((v): v is number => v !== null && v >= 0);
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    return {
      total: reportEntries.length,
      completados: completados.length,
      noEscucho: noEscucho.length,
      enProceso: enProceso.length,
      avgEspera: avg(waitTimes),
      avgAtencion: avg(attnTimes),
    };
  }, [reportEntries]);

  const marcarSaliALlamar = useCallback(async (entryId: string, followUpCreatedAt?: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const fu = followUpCreatedAt
      ? entry.followUps?.find(f => f.createdAt === followUpCreatedAt)
      : entry.followUps?.[0];
    if (!fu) return;
    const { time } = await getServerNow();
    const newFollowUps = (entry.followUps ?? []).map(f => f === fu ? { ...fu, followUpStatus: "llamado" as const, calledTime: time } : f);
    updateEntry(entryId, { ...entry, followUps: newFollowUps });
  }, [entries, updateEntry]);

  const marcarLeAtendi = useCallback(async (entryId: string, followUpCreatedAt?: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const fu = followUpCreatedAt
      ? entry.followUps?.find(f => f.createdAt === followUpCreatedAt)
      : entry.followUps?.[0];
    if (!fu) return;
    const { time } = await getServerNow();
    const newFollowUps = (entry.followUps ?? []).map(f => f === fu ? {
      ...fu,
      followUpStatus: "completado" as const,
      attendedTime: fu.calledTime ?? fu.returnedTime ?? time,
      completedTime: time,
    } : f);
    updateEntry(entryId, { ...entry, followUps: newFollowUps });
  }, [entries, updateEntry]);

  const marcarNoRespondio = useCallback(async (entryId: string, followUpCreatedAt?: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const fu = followUpCreatedAt
      ? entry.followUps?.find(f => f.createdAt === followUpCreatedAt)
      : entry.followUps?.[0];
    if (!fu) return;
    const newFollowUps = (entry.followUps ?? []).map(f => f === fu ? { ...fu, followUpStatus: "no-escucho" as const } : f);
    updateEntry(entryId, { ...entry, followUps: newFollowUps });
  }, [entries, updateEntry]);

  const marcarTermineDeAtender = useCallback(async (entryId: string, followUpCreatedAt?: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const fu = followUpCreatedAt
      ? entry.followUps?.find(f => f.createdAt === followUpCreatedAt)
      : entry.followUps?.[0];
    if (!fu) return;
    const { time } = await getServerNow();
    const newFollowUps = (entry.followUps ?? []).map(f => f === fu ? {
      ...fu,
      followUpStatus: "completado" as const,
      completedTime: time,
    } : f);
    updateEntry(entryId, { ...entry, followUps: newFollowUps });
  }, [entries, updateEntry]);

  async function exportarReporte() {
    const XLSX = await import("xlsx");
    const rows = reportEntries.map((e) => {
      const fu = e.followUps?.[0];
      if (!fu) return null;
      const wait = fu.arrivalTime && fu.attendedTime ? minDiff(fu.arrivalTime, fu.attendedTime) : "";
      const attn = fu.attendedTime && fu.completedTime ? minDiff(fu.attendedTime, fu.completedTime) : "";
      return {
        Fecha: e.scheduleDate, Técnico: currentTechnician?.name ?? "",
        "Trámite": e.tramiteCode, "Registro": e.registrationNumber,
        "Sin programación": fu.isUnscheduled ? "Sí" : "No",
        "Cliente": fu.clientName ?? "", "Llegó": fu.arrivalTime ?? "",
        "Estado": fu.followUpStatus ?? "", "Llamado": fu.calledTime ?? "",
        "Regresó": fu.returnedTime ?? "", "Atendiendo": fu.attendedTime ?? "",
        "Completado": fu.completedTime ?? "",
        "Espera (min)": wait, "Atención (min)": attn,
        "Obs.": fu.observations ?? "",
      };
    }).filter((r): r is any => r !== null);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `reporte-${currentTechnician?.name.replace(/\s/g, "_")}-${reportePeriodo}-${selectedDate}.xlsx`);
  }

  const arrivedNow = expandedAgendaHoy.filter(({ followUp }) => {
    const st = followUp?.followUpStatus as FollowUpStatus | undefined;
    return st && ["esperando", "en-revision", "regreso"].includes(st);
  });

  if (showLoginModal) {
    return (
      <AppShell title="Mi Agenda de Atención" description="Acceso técnico" eyebrow="TÉCNICO">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm mx-4 space-y-6">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Ingreso</p>
              <h3 className="text-2xl font-bold mt-1">Técnico</h3>
              <p className="text-sm text-gray-500 mt-1">Selecciona tu nombre e ingresa tu PIN</p>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-700">Tu nombre</span>
              <select
                value={selectedTechnicianId}
                onChange={(e) => {
                  setSelectedTechnicianId(e.target.value);
                  setPinError(false);
                }}
                className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none bg-white font-semibold"
              >
                <option value="">— Selecciona tu nombre —</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            {selectedTechnicianId && (
              <>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-gray-700">PIN de 4 dígitos</span>
                  {/* Indicador de puntos */}
                  <div className="flex justify-center gap-4 mb-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded-full transition-all duration-150 ${
                          pinInput.length > i
                            ? pinError ? "bg-red-500 scale-110" : "bg-pink-600 scale-110"
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>

                  {pinError && (
                    <p className="text-center text-sm text-red-600 font-semibold animate-pulse mb-2">
                      PIN incorrecto — inténtalo de nuevo
                    </p>
                  )}

                  {/* Teclado numérico */}
                  <div className="grid grid-cols-3 gap-3">
                    {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={!d}
                        onClick={() => {
                          if (d === "⌫") { setPinInput((p) => p.slice(0, -1)); setPinError(false); }
                          else if (d) handlePinDigit(d);
                        }}
                        className={`h-14 rounded-xl text-xl font-bold transition select-none ${
                          !d ? "pointer-events-none" :
                          d === "⌫"
                            ? "bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer"
                            : "bg-pink-50 hover:bg-pink-100 active:bg-pink-200 text-pink-900 cursor-pointer"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </label>

                <button
                  onClick={handleLogin}
                  disabled={pinInput.length !== 4}
                  className={`w-full px-4 py-3 rounded-lg font-bold text-white transition ${
                    pinInput.length === 4
                      ? "bg-pink-600 hover:bg-pink-700 cursor-pointer"
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
                >
                  🔓 Acceder
                </button>

                <p className="text-xs text-gray-400 text-center">PIN demo: 0000</p>
              </>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Mi Agenda de Atención" description="Ver trámites programados y gestionar el workflow de atención" eyebrow="TÉCNICO">
      <ToastAlert
        show={toastShow}
        title="🚨 CLIENTE ESPERANDO"
        message={toastMessage}
        onDismiss={() => setToastShow(false)}
      />
      <div className="space-y-6">

        {/* ── HEADER CON LOGOUT ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">Bienvenido, {currentTechnician?.name}</h2>
            <p className="text-sm text-gray-500">{currentTechnician?.areaLabel}</p>
          </div>
          <button
            onClick={() => logoutTechnician()}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg cursor-pointer"
          >
            🚪 Cerrar sesión
          </button>
        </div>

        {/* ── FILTROS ── */}
        <section className="rounded-4xl border-2 border-pink-200 bg-pink-50 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-lg font-bold text-gray-800">Mi Agenda</h3>
            {!notifAllowed && "Notification" in (typeof window !== "undefined" ? window : {}) && (
              <button onClick={() => Notification.requestPermission().then((p) => setNotifAllowed(p === "granted"))}
                className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-amber-200">
                🔔 Activar notificaciones
              </button>
            )}
            {notifAllowed && <span className="text-xs text-green-700 font-semibold">🔔 Notificaciones activas</span>}
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-700">Fecha</span>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none w-full md:w-48" />
          </label>
        </section>

        {/* ── ALERTA: CLIENTES QUE ESPERAN ── */}
        {arrivedNow.length > 0 && (
          <section className="rounded-4xl border-4 border-red-400 bg-gradient-to-r from-red-50 to-orange-50 p-6">
            <p className="text-sm font-semibold text-red-700 uppercase mb-3">⚠️ {arrivedNow.length} cliente{arrivedNow.length > 1 ? "s" : ""} esperando atención</p>
            <div className="space-y-2">
              {arrivedNow.map(({ entry: e, followUp: fu }) => {
                const st = (fu.followUpStatus ?? "esperando") as FollowUpStatus;
                return (
                  <div key={`${e.id}-${fu.createdAt}`} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-red-200 flex-wrap gap-2">
                    <div className="flex gap-4 text-sm">
                      <span className="font-mono font-bold">{e.tramiteCode}</span>
                      <span className="font-semibold">{fu.clientName ?? "—"}</span>
                      <span className="text-pink-700 font-bold">Llegó: {fu.arrivalTime}</span>
                      <span className="text-gray-500">{STATUS_LABEL[st]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── AGENDA ── */}
        <section className="rounded-4xl border-2 border-pink-200 overflow-hidden">
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-2xl font-bold">Agenda — {selectedDate}</h2>
            <div className="flex items-center gap-3 text-sm">
              <span>📋 {expandedAgendaHoy.length} seguimientos</span>
              <span>✅ {expandedAgendaHoy.filter(({ followUp }) => followUp.followUpStatus === "completado").length} completados</span>
            </div>
          </div>

          {expandedAgendaHoy.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500">No hay trámites para esta fecha.</div>
          ) : (
            <div className="divide-y-2 divide-pink-100">
              {expandedAgendaHoy.map(({ entry, followUp }, idx) => (
                <AgendaRow
                  key={`${entry.id}-${followUp.createdAt}`}
                  entry={entry}
                  followUp={followUp}
                  onSaliALlamar={marcarSaliALlamar}
                  onAtendi={marcarLeAtendi}
                  onNoRespondio={marcarNoRespondio}
                  onTermineDeAtender={marcarTermineDeAtender}
                  onContinuarEtapa={(id) => setContinuingEntryId(id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── MIS JUNTAS ASIGNADAS ── */}
        {misJuntas.length > 0 && (
          <section className="rounded-4xl border-2 border-emerald-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4">
              <h2 className="text-2xl font-bold">
                📥 Mis Juntas Asignadas
                <span className="text-sm font-normal ml-2">({misJuntas.length})</span>
              </h2>
            </div>
            <div className="divide-y-2 divide-emerald-100">
              {misJuntas.map((junta) => {
                const juntaEntries = entriesByJunta.get(junta.id) ?? [];
                const isExpanded = expandedJuntaId === junta.id;
                return (
                  <div key={junta.id} className="bg-emerald-50">
                    <button
                      onClick={() => setExpandedJuntaId(isExpanded ? null : junta.id)}
                      className="w-full text-left px-6 py-4 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="font-bold text-emerald-900">
                          {isExpanded ? "▼" : "▶"} {junta.name}
                        </p>
                        <div className="text-sm text-emerald-700 mt-1 space-y-0.5">
                          <p>📅 Ingresada: {junta.date && new Date(junta.date + "T00:00:00").toLocaleDateString("es-ES")} {junta.createdAt && new Date(junta.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>
                          <p>📊 {junta.tramiteCount} trámites | Registrado por: {junta.registeredBy}</p>
                          {junta.observations && <p>📌 {junta.observations}</p>}
                          <p className={`font-semibold ${junta.status === "completado" ? "text-green-700" : junta.status === "en-proceso" ? "text-blue-700" : "text-green-700"}`}>
                            Status: {junta.status === "completado" ? "✓ Revisada" : junta.status === "en-proceso" ? "🔄 En revisión" : "✓ Recibida"}
                          </p>
                        </div>
                      </div>
                      <span className="text-3xl ml-2">📦</span>
                    </button>

                    {isExpanded && (
                      <div className="px-6 py-4 bg-white border-t border-emerald-100 space-y-4">
                        {juntaEntries.length > 0 && (
                          <>
                            <p className="text-sm font-semibold text-emerald-900">Trámites:</p>
                            <div className="space-y-3">
                              {juntaEntries.map((entry) => {
                                const fu = entry.followUps?.[0];
                                const status = fu?.followUpStatus || "esperando";
                                const statusColor = status === "completado" ? "green" : status === "en-revision" ? "blue" : "amber";
                                const statusLabel = status === "completado" ? "✓ Revisado" : status === "en-revision" ? "🔄 En revisión" : "⏳ Pendiente";

                                return (
                                  <div key={entry.id} className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1">
                                        <p className="font-mono font-bold text-emerald-900">{entry.tramiteCode}</p>
                                        <p className="text-sm text-emerald-700">{fu?.clientName || "—"}</p>
                                        {fu?.observations && <p className="text-xs text-emerald-600 mt-1">📝 {fu.observations}</p>}
                                      </div>
                                      <span className={`text-xs whitespace-nowrap px-2.5 py-1 rounded font-semibold bg-${statusColor}-100 text-${statusColor}-800`}>
                                        {statusLabel}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── REPORTES ── */}
        <section className="rounded-4xl border-2 border-pink-200 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-2xl font-bold">Mis Reportes</h2>
            <div className="flex gap-2 flex-wrap">
              {(["dia", "semana", "mes"] as const).map((p) => (
                <button key={p} onClick={() => setReportePeriodo(p)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold cursor-pointer transition ${reportePeriodo === p ? "bg-pink-600 text-white" : "bg-pink-100 text-pink-700 hover:bg-pink-200"}`}>
                  {p === "dia" ? "Hoy" : p === "semana" ? "Semana" : "Mes"}
                </button>
              ))}
              {reportEntries.length > 0 && (
                <button onClick={exportarReporte}
                  className="px-4 py-1.5 rounded-full text-sm font-semibold bg-green-600 text-white hover:bg-green-700 cursor-pointer transition">
                  📥 Excel
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: "Total", value: reportStats.total, color: "blue" },
              { label: "Completados", value: reportStats.completados, color: "green" },
              { label: "En Proceso", value: reportStats.enProceso, color: "yellow" },
              { label: "No escucharon", value: reportStats.noEscucho, color: "orange" },
              { label: "Espera prom.", value: reportStats.avgEspera !== null ? fmtMin(reportStats.avgEspera) : "—", color: "purple" },
              { label: "Atención prom.", value: reportStats.avgAtencion !== null ? fmtMin(reportStats.avgAtencion) : "—", color: "pink" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl border-2 border-${color}-200 bg-${color}-50 p-4`}>
                <p className="text-xs text-gray-600 uppercase leading-tight">{label}</p>
                <p className={`text-2xl font-bold text-${color}-900 mt-1`}>{value}</p>
              </div>
            ))}
          </div>

          {reportEntries.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">Sin seguimientos en el periodo.</p>
          )}
        </section>

        {/* ── MODAL CONTINUAR ETAPA ── */}
        {continuingEntryId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Continuar en...</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Selecciona a quién le pasas el trámite
                </p>
              </div>

              {entries.find((e) => e.id === continuingEntryId) && (() => {
                const e = entries.find((e) => e.id === continuingEntryId)!;
                return (
                  <div className="rounded-xl bg-purple-50 border-2 border-purple-200 p-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-600">Trámite</p>
                        <p className="font-bold">{e.tramiteCode}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Cliente</p>
                        <p className="font-bold">{e.followUps?.[0]?.clientName ?? "—"}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <label className="block">
                <p className="text-sm font-semibold text-gray-700 mb-2">Técnico destino</p>
                <select value={continuingToTechId} onChange={(e) => setContinuingToTechId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none font-medium">
                  <option value="">Seleccionar técnico...</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.areaLabel})
                    </option>
                  ))}
                </select>
              </label>

              {/* Botones */}
              <div className="flex gap-3">
                <button onClick={() => { setContinuingEntryId(null); setContinuingToTechId(""); }}
                  className="flex-1 px-4 py-3 rounded-lg bg-gray-300 text-gray-700 font-semibold hover:bg-gray-400 cursor-pointer transition">
                  Cancelar
                </button>
                <button onClick={() => handleContinuarEtapa(continuingEntryId, continuingToTechId)}
                  disabled={!continuingToTechId}
                  className={`flex-1 px-4 py-3 rounded-lg font-semibold transition cursor-pointer ${continuingToTechId ? "bg-purple-600 text-white hover:bg-purple-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
                  ➡️ Continuar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
