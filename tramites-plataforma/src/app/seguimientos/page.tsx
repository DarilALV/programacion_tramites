"use client";

import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useTramitesStore, areas, type Entry, type FollowUp } from "@/lib/tramites-store";
import { getServerNow } from "@/lib/server-time";
import { Search, Plus, Trash2 } from "lucide-react";

const LIMITE = 15;

function minutesDiff(from: string, to?: string) {
  const [fh, fm] = from.split(":").map(Number);
  if (to) { const [th, tm] = to.split(":").map(Number); return (th * 60 + tm) - (fh * 60 + fm); }
  const n = new Date(); return (n.getHours() * 60 + n.getMinutes()) - (fh * 60 + fm);
}
function fmtMin(m: number) {
  if (m < 0) return "—"; if (m === 0) return "< 1 min";
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function techColor(count: number, isArchivos: boolean = false): { dot: string; bar: string; label: string } {
  if (isArchivos) return { dot: "📁", bar: "bg-blue-500", label: `${count} (ilimitado)` };
  if (count >= LIMITE) return { dot: "🔴", bar: "bg-red-500", label: `⚠️ ${count}/${LIMITE}` };
  if (count >= 12)     return { dot: "🔴", bar: "bg-red-400", label: `${count}/${LIMITE}` };
  if (count >= 7)      return { dot: "🟠", bar: "bg-amber-400", label: `${count}/${LIMITE}` };
  if (count > 0)       return { dot: "🟢", bar: "bg-green-500", label: `${count}/${LIMITE}` };
  return { dot: "⚪", bar: "bg-gray-300", label: `0/${LIMITE}` };
}

type EditState = { clientName: string; technicianId: string; observations: string };
type FormMode = "tecnico" | "interna";
type GestionInterna = "RAM" | "Firma de Jefatura" | "Firma Secretaria";

const GESTIONES_INTERNAS: GestionInterna[] = ["RAM", "Firma de Jefatura", "Firma Secretaria"];

const GESTION_COLOR: Record<GestionInterna, { bg: string; badge: string; dot: string }> = {
  "RAM":                 { bg: "bg-blue-50 border-blue-300",   badge: "bg-blue-100 text-blue-800",   dot: "🗂️" },
  "Firma de Jefatura":   { bg: "bg-violet-50 border-violet-300", badge: "bg-violet-100 text-violet-800", dot: "✍️" },
  "Firma Secretaria":    { bg: "bg-teal-50 border-teal-300",   badge: "bg-teal-100 text-teal-800",   dot: "📝" },
};

export default function SeguimientosPage() {
  const [formMode, setFormMode] = useState<FormMode>("tecnico");
  const [tramiteCode, setTramiteCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [selectedGestion, setSelectedGestion] = useState<GestionInterna | "">("");
  const [observations, setObservations] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  // const [programadosExpanded, setProgramadosExpanded] = useState(false); // Oculto de momento para no confundir
  const [searchFollowUps, setSearchFollowUps] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [showJuntaModal, setShowJuntaModal] = useState(false);
  const [juntaTechnicianId, setJuntaTechnicianId] = useState("");
  const [juntaName, setJuntaName] = useState("");
  const [juntaTramites, setJuntaTramites] = useState<{ code: string; clientName: string }[]>([]);
  const [juntaObservations, setJuntaObservations] = useState("");
  const [expandedJuntaId, setExpandedJuntaId] = useState<string | null>(null);
  const [editingJuntaId, setEditingJuntaId] = useState<string | null>(null);
  const [editingJuntaTramites, setEditingJuntaTramites] = useState<{ code: string; clientName: string }[]>([]);
  const [editState, setEditState] = useState<EditState>({ clientName: "", technicianId: "", observations: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [derivingEntryId, setDerivingEntryId] = useState<string | null>(null);
  const [derivingToTechId, setDerivingToTechId] = useState("");

  const { entries, updateEntry, createEntry, removeEntry, technicians, currentUser, getNextRegistrationNumber, juntas, createJunta, updateJunta, deleteJunta } =
    useTramitesStore();

  const availableTechnicians = useMemo(
    () => currentUser.areaId ? technicians.filter((t) => t.areaId === currentUser.areaId) : technicians,
    [currentUser.areaId, technicians],
  );
  const availableAreas = useMemo(
    () => currentUser.areaId ? areas.filter((a) => a.id === currentUser.areaId) : areas,
    [currentUser.areaId],
  );

  const today = new Date().toISOString().slice(0, 10);

  const juntasHoy = useMemo(
    () => juntas.filter((j) => j.date === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [juntas, today],
  );

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

  // Debounce search: wait 300ms after user stops typing before filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchFollowUps);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchFollowUps]);

  const foundEntry = useMemo(() => {
    if (!tramiteCode.trim()) return null;
    return entries.find((e) => e.tramiteCode === tramiteCode.trim()) ?? null;
  }, [tramiteCode, entries]);

  const effectiveTechnician = technicians.find((t) => t.id === selectedTechnicianId);

  const todayFollowUps = useMemo(() => entries
    .filter((e) => {
      // Excluir trámites de junta (type === "junta_ingreso")
      const fu = e.followUps?.[0];
      if (fu?.type === "junta_ingreso") return false;

      const hasFollowUpsToday = e.followUps?.some((fu) => fu.createdAt?.startsWith(today) || (e.scheduleDate === today && fu));
      if (!hasFollowUpsToday) return false;
      if (currentUser.areaId) {
        const technicianArea = e.technicianArea;
        return areas.some((a) => a.id === currentUser.areaId && a.label === technicianArea);
      }
      return true;
    })
    .sort((a, b) => {
      const aTime = a.followUps?.[0]?.arrivalTime ?? "";
      const bTime = b.followUps?.[0]?.arrivalTime ?? "";
      return bTime.localeCompare(aTime);
    }),
    [entries, today, currentUser.areaId]);

  const filteredFollowUps = useMemo(() => {
    if (!debouncedSearch.trim()) return todayFollowUps;
    const q = debouncedSearch.toLowerCase();
    return todayFollowUps.filter((e) => {
      const clientName = e.followUps?.[0]?.clientName ?? "";
      return e.tramiteCode.includes(q) ||
        clientName.toLowerCase().includes(q) ||
        e.technicianName.toLowerCase().includes(q);
    });
  }, [todayFollowUps, debouncedSearch]);

  const techCountToday = useMemo(() => {
    const c: Record<string, number> = {};
    todayFollowUps.forEach((e) => {
      const tid = e.followUps?.[0]?.actualTechnicianId ?? e.technicianId;
      c[tid] = (c[tid] ?? 0) + 1;
    });
    return c;
  }, [todayFollowUps]);

  const programadosHoy = useMemo(() => {
    const m: Record<string, { name: string; area: string; entries: Entry[] }> = {};
    entries.filter((e) => e.scheduleDate === today).forEach((e) => {
      if (!m[e.technicianId]) m[e.technicianId] = { name: e.technicianName, area: e.technicianArea, entries: [] };
      m[e.technicianId].entries.push(e);
    });
    return m;
  }, [entries, today]);

  const technicianLoad = useMemo(() => {
    const load: Record<string, { name: string; programados: number; llegadas: number; atendidos: number; completados: number }> = {};
    entries.filter((e) => {
      const isToday = e.scheduleDate === today;
      if (!isToday) return false;
      if (currentUser.areaId) {
        const technicianArea = e.technicianArea;
        return areas.some((a) => a.id === currentUser.areaId && a.label === technicianArea);
      }
      return true;
    }).forEach((e) => {
      if (!load[e.technicianId]) load[e.technicianId] = { name: e.technicianName, programados: 0, llegadas: 0, atendidos: 0, completados: 0 };
      load[e.technicianId].programados++;
    });
    todayFollowUps.forEach((e) => {
      const fu = e.followUps?.[0];
      const tid = fu?.actualTechnicianId ?? e.technicianId;
      const tn = fu?.actualTechnicianName ?? e.technicianName;
      if (!load[tid]) load[tid] = { name: tn, programados: 0, llegadas: 0, atendidos: 0, completados: 0 };
      load[tid].llegadas++;
      if (fu?.attendedTime) load[tid].atendidos++;
      if (fu?.completedTime) load[tid].completados++;
    });
    return load;
  }, [entries, todayFollowUps, today, currentUser.areaId]);

  function showMsg(text: string, type: "success" | "error" = "success") {
    setMessage(text); setMessageType(type); setTimeout(() => setMessage(""), 4000);
  }

  async function handleCreateJunta() {
    if (!juntaTechnicianId) return showMsg("⚠️ Selecciona un técnico", "error");
    if (!juntaName.trim()) return showMsg("⚠️ Ingresa un nombre para la junta", "error");
    if (juntaTramites.length === 0) return showMsg("⚠️ Agrega al menos un trámite", "error");

    // Validar que todos tengan código y cliente
    const invalid = juntaTramites.find(t => !t.code.trim() || !t.clientName.trim());
    if (invalid) return showMsg("⚠️ Todos los trámites deben tener código y nombre de cliente", "error");

    // Crear la junta primero
    const junta = createJunta(juntaTechnicianId, juntaName.trim(), juntaTramites.length, juntaObservations.trim() || undefined);

    // Crear Entry para cada trámite
    const { iso } = await getServerNow();
    juntaTramites.forEach((tramite) => {
      const newEntry: Entry = {
        id: `junta-${junta.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        registrationNumber: getNextRegistrationNumber(),
        tramiteCode: tramite.code.trim(),
        technicianId: juntaTechnicianId,
        technicianName: technicians.find(t => t.id === juntaTechnicianId)?.name ?? juntaTechnicianId,
        technicianArea: technicians.find(t => t.id === juntaTechnicianId)?.areaLabel ?? "",
        scheduleDate: today,
        registrationDate: today,
        observations: `Junta: ${juntaObservations || "sin observaciones"}`,
        status: "Registrado",
        createdAt: iso,
        juntaId: junta.id,
        followUps: [{
          type: "junta_ingreso",
          juntaId: junta.id,
          clientName: tramite.clientName.trim(),
          followUpStatus: "esperando",
          createdAt: iso,
        }],
      };
      createEntry(newEntry);
    });

    showMsg(`✅ Junta "${juntaName}" registrada: ${juntaTramites.length} trámites para ${technicians.find(t => t.id === juntaTechnicianId)?.name}`, "success");
    setShowJuntaModal(false);
    setJuntaTechnicianId("");
    setJuntaName("");
    setJuntaTramites([]);
    setJuntaObservations("");
  }

  function handleEditJunta(juntaId: string) {
    const junta = juntas.find(j => j.id === juntaId);
    if (!junta || junta.status === "completado") return;
    const tramitesOfJunta = entriesByJunta.get(juntaId) ?? [];
    const tramitesData = tramitesOfJunta.map(e => ({
      code: e.tramiteCode,
      clientName: e.followUps?.[0]?.clientName || ""
    }));
    setEditingJuntaId(juntaId);
    setEditingJuntaTramites(tramitesData);
  }

  function handleDeleteJunta(juntaId: string) {
    if (!confirm("¿Eliminar esta junta y todos sus trámites?")) return;
    const juntaEntries = entriesByJunta.get(juntaId) ?? [];
    juntaEntries.forEach(e => removeEntry(e.id));
    deleteJunta(juntaId);
    showMsg("✅ Junta eliminada", "success");
  }

  async function handleSaveJuntaEdit(juntaId: string) {
    if (editingJuntaTramites.length === 0) return showMsg("⚠️ Debe haber al menos un trámite", "error");
    const invalid = editingJuntaTramites.find(t => !t.code.trim() || !t.clientName.trim());
    if (invalid) return showMsg("⚠️ Todos los trámites deben tener código y cliente", "error");

    const junta = juntas.find(j => j.id === juntaId);
    if (!junta) return;

    const juntaEntries = entriesByJunta.get(juntaId) ?? [];
    const { iso } = await getServerNow();
    const technicianObj = technicians.find(t => t.id === junta.technicianId);

    juntaEntries.forEach(e => removeEntry(e.id));

    editingJuntaTramites.forEach((tramite) => {
      const newEntry: Entry = {
        id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        registrationNumber: getNextRegistrationNumber(),
        tramiteCode: tramite.code,
        technicianId: junta.technicianId,
        technicianName: technicianObj?.name || "—",
        technicianArea: technicianObj?.areaLabel || "Supervisor",
        scheduleDate: junta.date,
        registrationDate: iso.slice(0, 10),
        observations: "",
        status: "Registrado",
        createdAt: iso,
        juntaId: junta.id,
        followUps: [{
          type: "junta_ingreso",
          juntaId: junta.id,
          clientName: tramite.clientName.trim(),
          followUpStatus: "esperando",
          createdAt: iso,
        }],
      };
      createEntry(newEntry);
    });

    updateJunta(juntaId, { tramiteCount: editingJuntaTramites.length });
    setEditingJuntaId(null);
    setEditingJuntaTramites([]);
    showMsg("✅ Junta actualizada", "success");
  }

  // Validación código trámite
  function validateCode(code: string): string | null {
    if (!code.trim()) return "Ingresa el número de trámite";
    if (!/^\d+$/.test(code)) return "Solo se permiten números";
    if (code.length < 6 || code.length > 10) return "Debe tener entre 6 y 10 dígitos";
    if (!code.startsWith("2")) return "Debe empezar con el año (ej: 2026...)";
    return null;
  }

  async function handleRegisterArrival() {
    const codeErr = validateCode(tramiteCode);
    if (codeErr) return showMsg(`⚠️ ${codeErr}`, "error");
    if (!clientName.trim()) return showMsg("⚠️ Ingresa el nombre de la persona", "error");
    if (!selectedTechnicianId) return showMsg("⚠️ Selecciona el técnico", "error");

    const count = techCountToday[selectedTechnicianId] ?? 0;
    if (count >= LIMITE) {
      showMsg(`⚠️ ${effectiveTechnician?.name} ya atendió ${count} (límite: ${LIMITE}). Continuará registrando.`, "success");
    }

    const { time: arrival, iso } = await getServerNow();

    if (foundEntry) {
      const techChanged = selectedTechnicianId !== foundEntry.technicianId;
      const newFollowUp: FollowUp = {
        type: "normal",
        clientName: clientName.trim(),
        arrivalTime: arrival,
        followUpStatus: "esperando",
        actualTechnicianId: techChanged ? foundEntry.technicianId : undefined,
        actualTechnicianName: techChanged ? foundEntry.technicianName : undefined,
        observations: observations.trim() || undefined,
        createdAt: iso,
      };
      updateEntry(foundEntry.id, {
        ...foundEntry,
        technicianId: selectedTechnicianId,
        technicianName: effectiveTechnician?.name ?? selectedTechnicianId,
        technicianArea: effectiveTechnician?.areaLabel ?? foundEntry.technicianArea,
        followUps: [...(foundEntry.followUps ?? []), newFollowUp],
      });
    } else {
      const newEntry: Entry = {
        id: `unsched-${Date.now()}`,
        createdBy: currentUser.id, createdByName: currentUser.name,
        registrationNumber: getNextRegistrationNumber(),
        tramiteCode: tramiteCode.trim(),
        technicianId: selectedTechnicianId,
        technicianName: effectiveTechnician?.name ?? selectedTechnicianId,
        technicianArea: effectiveTechnician?.areaLabel ?? "",
        scheduleDate: today, registrationDate: today,
        observations: "", status: "Registrado", createdAt: iso,
        followUps: [{ type: "normal", clientName: clientName.trim(), arrivalTime: arrival, followUpStatus: "esperando", observations: observations.trim() || undefined, createdAt: iso, isUnscheduled: true }],
      };
      createEntry(newEntry);
    }
    showMsg(`✅ Llegada registrada a las ${arrival} — ${effectiveTechnician?.name}`, "success");
    setTramiteCode(""); setClientName(""); setSelectedTechnicianId(""); setObservations("");
  }

  async function handleRegisterGestionInterna() {
    const codeErr = validateCode(tramiteCode);
    if (codeErr) return showMsg(`⚠️ ${codeErr}`, "error");
    if (!clientName.trim()) return showMsg("⚠️ Ingresa el nombre de la persona", "error");
    if (!selectedGestion) return showMsg("⚠️ Selecciona el tipo de gestión", "error");

    const { time: arrival, iso } = await getServerNow();

    const archivosId = "archivos";
    const archivosName = "Archivos";
    const archivosArea = "Archivos";

    if (foundEntry) {
      const newFollowUp: FollowUp = {
        type: "normal",
        clientName: clientName.trim(),
        arrivalTime: arrival,
        followUpStatus: "completado",
        observations: (observations.trim() ? `[${selectedGestion}] ${observations.trim()}` : `[${selectedGestion}]`),
        createdAt: iso,
        isUnscheduled: false,
      };
      updateEntry(foundEntry.id, {
        ...foundEntry,
        technicianId: archivosId,
        technicianName: archivosName,
        technicianArea: archivosArea,
        followUps: [...(foundEntry.followUps ?? []), newFollowUp],
      });
    } else {
      const newEntry: Entry = {
        id: `gestion-${Date.now()}`,
        createdBy: currentUser.id, createdByName: currentUser.name,
        registrationNumber: getNextRegistrationNumber(),
        tramiteCode: tramiteCode.trim(),
        technicianId: archivosId,
        technicianName: archivosName,
        technicianArea: archivosArea,
        scheduleDate: today, registrationDate: today,
        observations: "", status: "Registrado", createdAt: iso,
        followUps: [{
          type: "normal",
          clientName: clientName.trim(),
          arrivalTime: arrival,
          followUpStatus: "completado",
          observations: (observations.trim() ? `[${selectedGestion}] ${observations.trim()}` : `[${selectedGestion}]`),
          createdAt: iso,
          isUnscheduled: true,
        }],
      };
      createEntry(newEntry);
    }
    showMsg(`✅ Gestión registrada: ${selectedGestion} → Archivos — ${arrival}`, "success");
    setTramiteCode(""); setClientName(""); setSelectedGestion(""); setObservations("");
  }

  async function handleMarkRegreso(entry: Entry) {
    const { time } = await getServerNow();
    const newFollowUps = [...(entry.followUps ?? [])];
    if (newFollowUps.length === 0) return;
    const last = newFollowUps[newFollowUps.length - 1];
    newFollowUps[newFollowUps.length - 1] = { ...last, followUpStatus: "regreso", returnedTime: time } as FollowUp;
    updateEntry(entry.id, { ...entry, followUps: newFollowUps });
    showMsg(`↩️ Cliente regresó registrado a las ${time}`, "success");
  }

  function handleStartEdit(entry: Entry) {
    const lastFollowUp = entry.followUps?.[entry.followUps.length - 1];
    setEditingFollowUpId(entry.id);
    setEditState({
      clientName: lastFollowUp?.clientName ?? "",
      technicianId: "",
      observations: lastFollowUp?.observations ?? "",
    });
    setConfirmDeleteId(null);
  }

  function handleSaveEdit(entry: Entry) {
    const newFollowUps = [...(entry.followUps ?? [])];
    if (newFollowUps.length === 0) return;
    const last = newFollowUps[newFollowUps.length - 1];
    newFollowUps[newFollowUps.length - 1] = { ...last, clientName: editState.clientName.trim(), observations: editState.observations.trim() || undefined };
    updateEntry(entry.id, { ...entry, followUps: newFollowUps });
    setEditingFollowUpId(null);
    showMsg("✓ Seguimiento actualizado (cliente y observaciones)");
  }

  function handleDeleteFollowUp(entry: Entry) {
    const lastFollowUp = entry.followUps?.[entry.followUps.length - 1];
    if (lastFollowUp?.isUnscheduled && entry.followUps?.length === 1) {
      removeEntry(entry.id);
    } else if (entry.followUps && entry.followUps.length > 0) {
      const newFollowUps = entry.followUps.slice(0, -1);
      updateEntry(entry.id, { ...entry, followUps: newFollowUps.length > 0 ? newFollowUps : undefined });
    }
    setConfirmDeleteId(null);
    showMsg(`Seguimiento de ${entry.tramiteCode} eliminado`);
  }

  async function handleDerivar(entryId: string, newTechId: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const newTech = technicians.find((t) => t.id === newTechId);
    if (!newTech) return;

    // Actualizar technicianId, technicianName Y el followUp con quién lo atiende
    const currentFollowUps = entry.followUps ?? [];
    const updatedFollowUps = currentFollowUps.map((fu, idx) =>
      idx === currentFollowUps.length - 1
        ? { ...fu, actualTechnicianId: newTechId, actualTechnicianName: newTech.name }
        : fu
    );

    updateEntry(entryId, {
      ...entry,
      technicianId: newTechId,
      technicianName: newTech.name,
      technicianArea: newTech.areaLabel,
      followUps: updatedFollowUps,
    });

    showMsg(`✅ Trámite derivado a ${newTech.name}`);
    setDerivingEntryId(null);
    setDerivingToTechId("");
  }

  async function exportarReporte() {
    const XLSX = await import("xlsx");
    const rows = todayFollowUps.flatMap((e) =>
      (e.followUps ?? []).map((fu) => {
        const tech = fu.actualTechnicianName ?? e.technicianName;
        const wait = fu.arrivalTime && fu.attendedTime ? minutesDiff(fu.arrivalTime, fu.attendedTime) : "";
        const attn = fu.attendedTime && fu.completedTime ? minutesDiff(fu.attendedTime, fu.completedTime) : "";
        return {
          Fecha: today, "Trámite": e.tramiteCode, "Registro": e.registrationNumber,
          "Cliente": fu.clientName ?? "", "Técnico": tech, "Área": e.technicianArea,
          "Sin programación": fu.isUnscheduled ? "Sí" : "No",
          "Llegada": fu.arrivalTime ?? "", "Estado": fu.followUpStatus ?? "",
          "Hora llamado": fu.calledTime ?? "", "Regresó": fu.returnedTime ?? "",
          "Atendido": fu.attendedTime ?? "", "Completado": fu.completedTime ?? "",
          "Espera (min)": wait, "Atención (min)": attn,
          "Obs.": fu.observations ?? "", "Por": e.createdByName,
        };
      })
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Seguimientos");
    XLSX.writeFile(wb, `seguimientos-${today}.xlsx`);
  }

  const canSubmitTecnico = tramiteCode.trim() && clientName.trim() && selectedTechnicianId;
  const canSubmitInterna = tramiteCode.trim() && clientName.trim() && selectedGestion;
  const selCount = techCountToday[selectedTechnicianId] ?? 0;
  const selOverLimit = selectedTechnicianId !== "archivos" && selCount >= LIMITE;
  const selColors = selectedTechnicianId ? techColor(selCount, selectedTechnicianId === "archivos") : null;
  const codeValidationError = tramiteCode.trim() ? validateCode(tramiteCode) : null;

  return (
    <AppShell title="Seguimientos del Día" description="Registra llegadas de clientes y gestiona el estado de cada trámite" eyebrow="SEGUIMIENTOS">
      <div className="space-y-6">

        {/* ── FORMULARIO REGISTRO ── */}
        <section className="rounded-4xl border-2 border-pink-200 bg-pink-50 p-6 space-y-4">
          <h2 className="text-2xl font-bold">Registrar Llegada</h2>

          {/* Toggle modo */}
          <div className="flex rounded-xl overflow-hidden border-2 border-pink-300 w-fit">
            <button onClick={() => { setFormMode("tecnico"); setSelectedGestion(""); }}
              className={`px-5 py-2 text-sm font-bold transition cursor-pointer ${formMode === "tecnico" ? "bg-pink-600 text-white" : "bg-white text-pink-700 hover:bg-pink-50"}`}>
              👤 Con Técnico
            </button>
            <button onClick={() => { setFormMode("interna"); setSelectedTechnicianId(""); }}
              className={`px-5 py-2 text-sm font-bold transition cursor-pointer ${formMode === "interna" ? "bg-violet-600 text-white" : "bg-white text-violet-700 hover:bg-violet-50"}`}>
              📋 Gestión Interna
            </button>
          </div>

          {message && (
            <div className={`p-4 rounded-lg text-sm font-medium ${messageType === "success" ? "bg-green-100 text-green-800 border border-green-300" : "bg-red-100 text-red-800 border border-red-300"}`}>
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Código trámite */}
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">Número de Trámite *</span>
              <input
                type="text" value={tramiteCode} autoFocus
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setTramiteCode(val);
                  if (formMode === "tecnico") {
                    const match = entries.find((en) => en.tramiteCode === val);
                    if (match) setSelectedTechnicianId(match.technicianId);
                  }
                }}
                onKeyDown={(e) => e.key === "Enter" && (formMode === "tecnico" ? handleRegisterArrival() : handleRegisterGestionInterna())}
                inputMode="numeric" placeholder="Ej: 2026016618"
                className={`rounded-lg border-2 px-4 py-3 text-lg font-semibold focus:outline-none ${codeValidationError ? "border-red-400 bg-red-50" : formMode === "interna" ? "border-violet-300 bg-white focus:border-violet-500" : "border-pink-300 bg-white focus:border-pink-500"}`}
              />
              {codeValidationError && <p className="text-xs text-red-600 font-medium">⚠️ {codeValidationError}</p>}
            </label>

            {/* Info trámite encontrado */}
            {tramiteCode.trim() && !codeValidationError && foundEntry && (
              <div className="md:col-span-2 rounded-lg bg-blue-50 border-2 border-blue-200 p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase">✓ Trámite encontrado</p>
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  <div><p className="text-xs text-gray-500">Registro</p><p className="font-bold">{foundEntry.registrationNumber}</p></div>
                  <div><p className="text-xs text-gray-500">Fecha programada</p><p className="font-bold">{foundEntry.scheduleDate}</p></div>
                  <div><p className="text-xs text-gray-500">Técnico asignado</p><p className="font-bold text-blue-900">{foundEntry.technicianName}</p></div>
                  {foundEntry.followUps && foundEntry.followUps.length > 0 && <div><p className="text-xs text-orange-600 font-semibold">⚠️ Ya tiene seguimiento</p></div>}
                </div>
              </div>
            )}
            {tramiteCode.trim() && !codeValidationError && !foundEntry && (
              <div className="md:col-span-2 rounded-lg bg-amber-50 border-2 border-amber-200 p-3">
                <p className="text-sm font-semibold text-amber-800">
                  {formMode === "tecnico" ? "⚠️ Trámite no encontrado — selecciona técnico manualmente" : "⚠️ Trámite no encontrado — se registrará como gestión sin programación"}
                </p>
              </div>
            )}

            {/* Nombre */}
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">Nombre de Quién Viene *</span>
              <input type="text" value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (formMode === "tecnico" ? handleRegisterArrival() : handleRegisterGestionInterna())}
                placeholder="Ej: Juan Pérez"
                className={`rounded-lg border-2 px-4 py-3 focus:outline-none ${formMode === "interna" ? "border-violet-300 focus:border-violet-500" : "border-pink-300 focus:border-pink-500"}`}
              />
            </label>

            {/* ── MODO TÉCNICO: selector con agrupación por área ── */}
            {formMode === "tecnico" && (
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-semibold text-gray-700">
                  Técnico que Atenderá *
                  {foundEntry && <span className="text-xs font-normal text-gray-500 ml-2">(puedes cambiar)</span>}
                </span>
                <select value={selectedTechnicianId} onChange={(e) => setSelectedTechnicianId(e.target.value)}
                  className="rounded-lg border-2 border-pink-300 px-4 py-3 focus:border-pink-500 focus:outline-none bg-white">
                  <option value="">— Selecciona área y técnico —</option>
                  {availableAreas.map((area) => {
                    const techsInArea = availableTechnicians.filter((t) => t.areaId === area.id);
                    return (
                      <optgroup key={area.id} label={`── ${area.label.toUpperCase()} ──`}>
                        {techsInArea.map((t) => {
                          const cnt = techCountToday[t.id] ?? 0;
                          const isArchivos = t.id === "archivos";
                          const { dot, label } = techColor(cnt, isArchivos);
                          return (
                            <option key={t.id} value={t.id}>
                              {dot} {t.name} ({label})
                            </option>
                          );
                        })}
                      </optgroup>
                    );
                  })}
                </select>

                {selColors && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">{effectiveTechnician?.name}: <strong>{selCount}</strong> {selectedTechnicianId === "archivos" ? "(ilimitado)" : `de ${LIMITE} hoy`}</span>
                      <span className={`font-semibold ${selOverLimit ? "text-red-600" : selCount >= 12 ? "text-red-500" : selCount >= 7 ? "text-amber-600" : "text-green-700"}`}>
                        {selColors.label}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className={`h-3 rounded-full transition-all ${selColors.bar}`}
                        style={{ width: `${Math.min((selCount / LIMITE) * 100, 100)}%` }} />
                    </div>
                    {selOverLimit && selectedTechnicianId !== "archivos" && <p className="text-xs text-orange-600 font-semibold">⚠️ Este técnico está sobre el límite de {LIMITE} pero puede continuar atendiendo</p>}
                  </div>
                )}
              </label>
            )}

            {/* ── MODO GESTIÓN INTERNA: botones de selección ── */}
            {formMode === "interna" && (
              <div className="grid gap-2 md:col-span-2">
                <span className="text-sm font-semibold text-gray-700">Tipo de Gestión *</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {GESTIONES_INTERNAS.map((g) => {
                    const col = GESTION_COLOR[g];
                    const selected = selectedGestion === g;
                    return (
                      <button key={g} type="button" onClick={() => setSelectedGestion(g)}
                        className={`rounded-xl border-2 p-4 text-left transition cursor-pointer ${selected ? `${col.bg} border-current ring-2 ring-offset-1 ring-violet-400` : "bg-white border-gray-200 hover:border-violet-300"}`}>
                        <p className="text-2xl mb-1">{col.dot}</p>
                        <p className={`text-sm font-bold ${selected ? "" : "text-gray-700"}`}>{g}</p>
                        {selected && <p className="text-xs text-violet-600 mt-0.5">✓ Seleccionado</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">Observaciones (opcional)</span>
              <textarea value={observations} onChange={(e) => setObservations(e.target.value)}
                placeholder="Ej: documento incompleto, urgente…" rows={2}
                className={`rounded-lg border-2 px-4 py-3 focus:outline-none ${formMode === "interna" ? "border-violet-300 focus:border-violet-500" : "border-pink-300 focus:border-pink-500"}`} />
            </label>
          </div>

          {formMode === "tecnico" ? (
            <button onClick={handleRegisterArrival}
              disabled={!canSubmitTecnico || !!codeValidationError}
              className={`w-full rounded-lg px-6 py-3 font-semibold text-white text-lg transition shadow-md ${canSubmitTecnico && !codeValidationError ? "bg-pink-600 hover:bg-pink-700 cursor-pointer" : "bg-gray-400 cursor-not-allowed"}`}>
              ✅ Registrar Llegada con Técnico
            </button>
          ) : (
            <button onClick={handleRegisterGestionInterna}
              disabled={!canSubmitInterna || !!codeValidationError}
              className={`w-full rounded-lg px-6 py-3 font-semibold text-white text-lg transition shadow-md ${canSubmitInterna && !codeValidationError ? "bg-violet-600 hover:bg-violet-700 cursor-pointer" : "bg-gray-400 cursor-not-allowed"}`}>
              📋 Registrar Gestión Interna
            </button>
          )}
        </section>

        {/* ── PROGRAMADOS DE HOY (OCULTO DE MOMENTO PARA NO CONFUNDIR) ──
        <section className="rounded-4xl border-2 border-purple-200 overflow-hidden">
          <button onClick={() => setProgramadosExpanded(!programadosExpanded)}
            className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white cursor-pointer">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">Programaciones de Hoy</h2>
              <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">
                {Object.values(programadosHoy).reduce((s, v) => s + v.entries.length, 0)} trámites
              </span>
            </div>
            <span className="text-sm">{programadosExpanded ? "▲ Ocultar" : "▼ Ver lista"}</span>
          </button>
          {programadosExpanded && (
            <div className="p-6 space-y-4">
              {Object.keys(programadosHoy).length === 0 ? (
                <p className="text-gray-500">No hay programaciones para hoy.</p>
              ) : (
                Object.entries(programadosHoy).map(([tid, data]) => {
                  const cnt = techCountToday[tid] ?? 0;
                  const { dot, bar } = techColor(cnt, tid === "archivos");
                  return (
                    <div key={tid} className="rounded-xl border-2 border-purple-100 bg-purple-50 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-purple-900">{data.name}</p>
                          <p className="text-xs text-purple-600">{data.area}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">{data.entries.length} programados</p>
                          <div className="flex items-center gap-1 text-xs mt-1">
                            <span>{dot}</span>
                            <span>{cnt} seguimientos</span>
                            <div className="w-16 bg-gray-200 rounded-full h-1.5 ml-1">
                              <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${Math.min((cnt / LIMITE) * 100, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-1">
                        {data.entries.sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? "")).map((e) => (
                          <div key={e.id} className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-lg ${e.followUps?.[0]?.attendedTime ? "bg-green-100 text-green-800" : "bg-white text-gray-700 border border-gray-200"}`}>
                            <span className="font-mono font-semibold">{e.tramiteCode}</span>
                            <span>{e.scheduledTime ?? "--:--"}</span>
                            <span>{e.followUps?.[0]?.attendedTime ? `✓ ${e.followUps?.[0]?.clientName ?? "llegó"}` : "⏳ pendiente"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>
        ── FIN PROGRAMADOS OCULTOS ── */}

        {/* ── JUNTAS INGRESADAS HOY ── */}
        {juntasHoy.length > 0 && (
          <section className="rounded-4xl border-2 border-emerald-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4">
              <h2 className="text-2xl font-bold">
                📥 Juntas Ingresadas Hoy
                <span className="text-sm font-normal ml-2">({juntasHoy.length})</span>
              </h2>
            </div>
            <div className="divide-y-2 divide-emerald-100">
              {juntasHoy.map((junta) => {
                const juntaEntries = entriesByJunta.get(junta.id) ?? [];
                const isExpanded = expandedJuntaId === junta.id;
                return (
                  <div key={junta.id} className="bg-emerald-50 border-b border-emerald-200">
                    <button
                      onClick={() => setExpandedJuntaId(isExpanded ? null : junta.id)}
                      className="w-full text-left px-6 py-4 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="font-bold text-emerald-900">
                          {isExpanded ? "▼" : "▶"} {junta.name}
                        </p>
                        <div className="text-sm text-emerald-700 mt-1 space-y-0.5">
                          <p>👤 {junta.technicianName} | 📊 {junta.tramiteCount} trámites | 📝 {junta.registeredBy}</p>
                          <p>📅 {junta.date && new Date(junta.date + "T00:00:00").toLocaleDateString("es-ES")} {junta.createdAt && new Date(junta.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>
                          {junta.observations && <p>📌 {junta.observations}</p>}
                        </div>
                      </div>
                      <span className="text-2xl ml-2">📦</span>
                    </button>

                    {isExpanded && (
                      <div className="px-6 py-4 bg-white border-t border-emerald-100 space-y-3">
                        <div className="flex gap-2">
                          {junta.status !== "completado" && (
                            <button onClick={() => handleEditJunta(junta.id)}
                              className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition font-semibold">
                              ✏️ Editar
                            </button>
                          )}
                          <button onClick={() => handleDeleteJunta(junta.id)}
                            className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-semibold">
                            🗑️ Eliminar
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-emerald-900">Trámites ingresados:</p>
                        {juntaEntries.length === 0 ? (
                          <p className="text-xs text-gray-500 italic">Sin trámites registrados aún</p>
                        ) : (
                          juntaEntries.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between text-sm bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                              <div className="flex-1">
                                <p className="font-mono font-bold text-emerald-900">{entry.tramiteCode}</p>
                                <p className="text-emerald-700">{entry.followUps?.[0]?.clientName || "—"}</p>
                              </div>
                              <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-1 rounded">
                                ⏳ Pendiente
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── SEGUIMIENTOS DE HOY ── */}
        <section className="rounded-4xl border-2 border-pink-200 overflow-hidden">
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-2xl font-bold">
              Seguimientos de Hoy
              <span className="text-sm font-normal ml-2">({todayFollowUps.length})</span>
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm">🟢 {todayFollowUps.filter((e) => !e.followUps?.[0]?.attendedTime).length} en espera</span>
              <span className="text-sm">✅ {todayFollowUps.filter((e) => e.followUps?.[0]?.completedTime).length} completados</span>
              {todayFollowUps.length > 0 && (
                <button onClick={exportarReporte} className="bg-white text-pink-700 font-semibold text-sm px-4 py-1.5 rounded-lg hover:bg-pink-50 transition cursor-pointer">
                  📥 Exportar Excel
                </button>
              )}
            </div>
          </div>

          {/* Buscador en la lista */}
          <div className="px-6 py-3 border-b border-pink-100 bg-pink-50">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-3 text-gray-400" />
              <input type="text" value={searchFollowUps} onChange={(e) => setSearchFollowUps(e.target.value)}
                placeholder="Buscar por trámite, nombre o técnico…"
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-pink-200 bg-white text-sm focus:outline-none focus:border-pink-400"
              />
            </div>
          </div>

          {filteredFollowUps.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              {searchFollowUps ? "Sin resultados para esa búsqueda." : "Aún no hay seguimientos registrados hoy."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-pink-100 border-b-2 border-pink-200">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold">Trámite</th>
                    <th className="px-3 py-3 text-left font-semibold">Cliente</th>
                    <th className="px-3 py-3 text-left font-semibold">Técnico</th>
                    <th className="px-3 py-3 text-left font-semibold">Llegó</th>
                    <th className="px-3 py-3 text-left font-semibold">Estado</th>
                    <th className="px-3 py-3 text-left font-semibold">Espera</th>
                    <th className="px-3 py-3 text-left font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFollowUps.map((entry, idx) => {
                    const fu = entry.followUps?.[0];
                    if (!fu) return null;
                    const tech = fu.actualTechnicianName ?? entry.technicianName;
                    const wait = fu.arrivalTime ? minutesDiff(fu.arrivalTime, fu.attendedTime) : null;
                    const st = fu.followUpStatus ?? "esperando";

                    const rowBg =
                      st === "completado" ? "bg-green-50" :
                      st === "atendiendo" ? "bg-blue-50" :
                      st === "regreso" ? "bg-yellow-50" :
                      st === "no-escucho" ? "bg-orange-50" :
                      st === "llamado" ? "bg-purple-50" :
                      idx % 2 === 0 ? "bg-pink-50" : "bg-white";

                    const statusLabel: Record<string, string> = {
                      "esperando": "⏳ Esperando",
                      "en-revision": "📋 En revisión",
                      "llamado": "📣 Llamado",
                      "no-escucho": "🔇 No escuchó",
                      "regreso": "↩️ Regresó",
                      "atendiendo": "👤 Atendiendo",
                      "completado": "✅ Completado",
                    };

                    if (editingFollowUpId === entry.id) {
                      return (
                        <tr key={entry.id} className="bg-blue-50 border-b border-blue-200">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <label className="grid gap-1">
                                <span className="text-xs text-gray-600">Nombre cliente</span>
                                <input value={editState.clientName}
                                  onChange={(e) => setEditState({ ...editState, clientName: e.target.value })}
                                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                              </label>
                              <label className="grid gap-1">
                                <span className="text-xs text-gray-600">Observaciones</span>
                                <input value={editState.observations}
                                  onChange={(e) => setEditState({ ...editState, observations: e.target.value })}
                                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                              </label>
                            </div>
                            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mt-2">
                              <p className="text-xs text-blue-700 font-semibold">ℹ️ Para cambiar técnico, usa el botón <span className="bg-purple-500 text-white px-2 py-0.5 rounded text-xs font-bold">↗️ Derivar</span></p>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => handleSaveEdit(entry)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-green-700">✓ Guardar</button>
                              <button onClick={() => setEditingFollowUpId(null)} className="px-3 py-1.5 bg-gray-400 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-gray-500">Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={entry.id} className={`${rowBg} border-b border-gray-100`}>
                        <td className="px-3 py-3">
                          <p className="font-mono font-semibold">{entry.tramiteCode}</p>
                          <p className="text-xs text-gray-400">{entry.registrationNumber}</p>
                          {fu.isUnscheduled && <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded">sin prog.</span>}
                        </td>
                        <td className="px-3 py-3">{fu.clientName}</td>
                        <td className="px-3 py-3 text-sm">
                          {entry.technicianArea === "Gestión Interna" ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${GESTION_COLOR[tech as GestionInterna]?.badge ?? "bg-gray-100 text-gray-700"}`}>
                              {GESTION_COLOR[tech as GestionInterna]?.dot ?? "📋"} {tech}
                            </span>
                          ) : (
                            <span className="font-semibold">{tech}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-semibold text-pink-700">{fu.arrivalTime ?? "—"}</td>
                        <td className="px-3 py-3">
                          <span className="text-xs font-semibold">{statusLabel[st] ?? st}</span>
                          {fu.calledTime && st === "llamado" && (
                            <p className="text-xs text-purple-700 font-semibold">
                              📣 Técnico salió a las {fu.calledTime}
                              {(() => { const m = minutesDiff(fu.calledTime!); return m >= 0 ? ` (hace ${fmtMin(m)})` : ""; })()}
                            </p>
                          )}
                          {fu.calledTime && st !== "llamado" && <p className="text-xs text-gray-400">Llamado: {fu.calledTime}</p>}
                          {fu.returnedTime && <p className="text-xs text-yellow-700">↩️ Regresó: {fu.returnedTime}</p>}
                          {st === "no-escucho" && <p className="text-xs text-orange-600 font-semibold">⏳ Pendiente volver</p>}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {wait !== null && <span className={wait > 30 ? "text-red-600 font-semibold" : "text-gray-600"}>{fmtMin(wait)}</span>}
                        </td>
                        <td className="px-3 py-3">
                          {confirmDeleteId === entry.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleDeleteFollowUp(entry)} className="px-2 py-1 bg-red-600 text-white rounded text-xs cursor-pointer">Sí</button>
                              <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-gray-400 text-white rounded text-xs cursor-pointer">No</button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {/* "Cliente regresó" solo si fue llamado y no escuchó */}
                              {st === "no-escucho" && (
                                <button onClick={() => handleMarkRegreso(entry)} className="text-xs px-2 py-1 rounded bg-yellow-500 text-white hover:bg-yellow-600 cursor-pointer whitespace-nowrap">
                                  ↩️ Regresó
                                </button>
                              )}
                              <button onClick={() => { setDerivingEntryId(entry.id); setDerivingToTechId(""); }} className="text-xs px-2 py-1 rounded bg-purple-500 text-white hover:bg-purple-600 cursor-pointer whitespace-nowrap">
                                ↗️ Derivar
                              </button>
                              <button onClick={() => handleStartEdit(entry)} className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 cursor-pointer">✏️ Editar</button>
                              <button onClick={() => setConfirmDeleteId(entry.id)} className="text-xs px-2 py-1 rounded bg-gray-300 text-gray-700 hover:bg-red-100 cursor-pointer">🗑️</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── RESUMEN POR TÉCNICO ── */}
        <section className="rounded-4xl border-2 border-pink-200 p-6">
          <h2 className="text-2xl font-bold mb-4">Técnicos — Resumen del Día</h2>
          {Object.keys(technicianLoad).length === 0 ? (
            <p className="text-gray-500">Sin actividad hoy</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(technicianLoad).map(([tid, data]) => {
                const cnt = techCountToday[tid] ?? 0;
                const { dot, bar } = techColor(cnt, tid === "archivos");
                return (
                  <div key={tid} className="rounded-xl border-2 border-pink-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-bold">{data.name}</p>
                      <span>{dot}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      {/* <span className="text-gray-500">Programados:</span><span className="font-semibold">{data.programados}</span> */}
                      <span className="text-gray-500">Llegadas:</span><span className="font-semibold text-pink-700">{data.llegadas}</span>
                      <span className="text-gray-500">Atendidos:</span><span className="font-semibold text-blue-700">{data.atendidos}</span>
                      <span className="text-gray-500">Completados:</span><span className="font-semibold text-green-700">{data.completados}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Seguimientos: {tid === "archivos" ? `${cnt} (ilimitado)` : `${cnt}/${LIMITE}`}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${bar}`} style={{ width: `${Math.min((cnt / LIMITE) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── MODAL DERIVACIÓN ── */}
        {derivingEntryId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Derivar Trámite</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Reasigna este trámite a otro técnico
                </p>
              </div>

              {/* Información del trámite */}
              {entries.find((e) => e.id === derivingEntryId) && (() => {
                const e = entries.find((e) => e.id === derivingEntryId)!;
                return (
                  <div className="rounded-xl bg-purple-50 border-2 border-purple-200 p-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-600">Trámite</p>
                        <p className="font-bold text-purple-900">{e.tramiteCode}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Cliente</p>
                        <p className="font-bold text-purple-900">{e.followUps?.[0]?.clientName ?? "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-600">Técnico actual</p>
                        <p className="font-bold text-purple-900">{e.technicianName}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Selector nuevo técnico */}
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-gray-700">Nuevo Técnico *</span>
                <select value={derivingToTechId} onChange={(e) => setDerivingToTechId(e.target.value)}
                  className="rounded-lg border-2 border-purple-300 px-4 py-3 focus:border-purple-500 focus:outline-none bg-white">
                  <option value="">— Selecciona técnico —</option>
                  {availableAreas.map((area) => {
                    const techsInArea = availableTechnicians.filter((t) => t.areaId === area.id);
                    return (
                      <optgroup key={area.id} label={`── ${area.label.toUpperCase()} ──`}>
                        {techsInArea.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </label>

              {/* Botones */}
              <div className="flex gap-3">
                <button onClick={() => { setDerivingEntryId(null); setDerivingToTechId(""); }}
                  className="flex-1 px-4 py-3 rounded-lg bg-gray-300 text-gray-700 font-semibold hover:bg-gray-400 cursor-pointer transition">
                  Cancelar
                </button>
                <button onClick={() => handleDerivar(derivingEntryId, derivingToTechId)}
                  disabled={!derivingToTechId}
                  className={`flex-1 px-4 py-3 rounded-lg font-semibold transition cursor-pointer ${derivingToTechId ? "bg-purple-600 text-white hover:bg-purple-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
                  ↗️ Derivar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botón flotante para juntas */}
      <button onClick={() => setShowJuntaModal(true)}
        className="fixed bottom-6 right-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-4 shadow-lg font-bold text-lg">
        📦 Junta
      </button>

      {/* Modal de Junta */}
      {showJuntaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-emerald-900">📦 Registrar Junta de Contribuyentes</h2>
              <p className="text-sm text-gray-500 mt-1">Ingresa los datos de cada trámite de la junta</p>
            </div>

            {/* Técnico */}
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Técnico *</span>
              <select value={juntaTechnicianId} onChange={(e) => setJuntaTechnicianId(e.target.value)}
                className="rounded-lg border-2 border-emerald-300 px-4 py-3 focus:border-emerald-500 focus:outline-none">
                <option value="">Selecciona técnico</option>
                {availableTechnicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>

            {/* Nombre de Junta */}
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Nombre de la Junta *</span>
              <input
                type="text"
                value={juntaName}
                onChange={(e) => setJuntaName(e.target.value)}
                placeholder="Ej: Revisión TUNARI - Semana 1"
                className="rounded-lg border-2 border-emerald-300 px-4 py-3 focus:border-emerald-500 focus:outline-none text-sm"
              />
            </label>

            {/* Observaciones */}
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Observaciones (opcional)</span>
              <textarea value={juntaObservations} onChange={(e) => setJuntaObservations(e.target.value)}
                className="rounded-lg border-2 border-emerald-300 px-4 py-3 focus:border-emerald-500 focus:outline-none text-sm"
                rows={2} placeholder="Notas sobre la junta..." />
            </label>

            {/* Trámites dinámicos */}
            <div className="border-t-2 border-emerald-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-emerald-900">Trámites ({juntaTramites.length})</h3>
                <button
                  onClick={() => setJuntaTramites([...juntaTramites, { code: "", clientName: "" }])}
                  className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 cursor-pointer"
                >
                  ➕ Agregar
                </button>
              </div>

              {juntaTramites.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-4 text-center">Agrega trámites usando el botón de arriba</p>
              ) : (
                <div className="space-y-3">
                  {juntaTramites.map((tramite, idx) => (
                    <div key={idx} className="flex gap-2 items-end bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                      <label className="flex-1 grid gap-1">
                        <span className="text-xs font-semibold text-gray-600">Código trámite</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={tramite.code}
                          onChange={(e) => {
                            const newTramites = [...juntaTramites];
                            newTramites[idx].code = e.target.value.replace(/\D/g, "").slice(0, 10);
                            setJuntaTramites(newTramites);
                          }}
                          placeholder="Ej: 2026001234"
                          className="rounded-lg border border-emerald-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                        />
                      </label>
                      <label className="flex-1 grid gap-1">
                        <span className="text-xs font-semibold text-gray-600">Nombre cliente</span>
                        <input
                          type="text"
                          value={tramite.clientName}
                          onChange={(e) => {
                            const newTramites = [...juntaTramites];
                            newTramites[idx].clientName = e.target.value;
                            setJuntaTramites(newTramites);
                          }}
                          placeholder="Ej: Juan Pérez"
                          className="rounded-lg border border-emerald-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                        />
                      </label>
                      <button
                        onClick={() => {
                          const newTramites = juntaTramites.filter((_, i) => i !== idx);
                          setJuntaTramites(newTramites);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg cursor-pointer"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setShowJuntaModal(false);
                  setJuntaTechnicianId("");
                  setJuntaName("");
                  setJuntaTramites([]);
                  setJuntaObservations("");
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-gray-300 text-gray-800 font-semibold hover:bg-gray-400 cursor-pointer transition"
              >
                ✕ Cancelar
              </button>
              <button
                onClick={handleCreateJunta}
                disabled={!juntaTechnicianId || juntaTramites.length === 0}
                className={`flex-1 px-4 py-3 rounded-lg font-semibold transition cursor-pointer ${
                  juntaTechnicianId && juntaTramites.length > 0
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                ✅ Registrar Junta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición de Junta */}
      {editingJuntaId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-blue-900">✏️ Editar Trámites de Junta</h2>
              <p className="text-sm text-gray-500 mt-1">Agregá o eliminá trámites según sea necesario</p>
            </div>

            {/* Trámites dinámicos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-blue-900">Trámites ({editingJuntaTramites.length})</h3>
                <button
                  onClick={() => setEditingJuntaTramites([...editingJuntaTramites, { code: "", clientName: "" }])}
                  className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 cursor-pointer"
                >
                  ➕ Agregar
                </button>
              </div>

              {editingJuntaTramites.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-4 text-center">Agrega trámites usando el botón de arriba</p>
              ) : (
                <div className="space-y-3">
                  {editingJuntaTramites.map((tramite, idx) => (
                    <div key={idx} className="flex gap-2 items-end bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <label className="flex-1 grid gap-1">
                        <span className="text-xs font-semibold text-gray-600">Código trámite</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={tramite.code}
                          onChange={(e) => {
                            const newTramites = [...editingJuntaTramites];
                            newTramites[idx].code = e.target.value.replace(/\D/g, "").slice(0, 10);
                            setEditingJuntaTramites(newTramites);
                          }}
                          placeholder="Ej: 2026001234"
                          className="rounded-lg border border-blue-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </label>
                      <label className="flex-1 grid gap-1">
                        <span className="text-xs font-semibold text-gray-600">Nombre cliente</span>
                        <input
                          type="text"
                          value={tramite.clientName}
                          onChange={(e) => {
                            const newTramites = [...editingJuntaTramites];
                            newTramites[idx].clientName = e.target.value;
                            setEditingJuntaTramites(newTramites);
                          }}
                          placeholder="Ej: Juan Pérez"
                          className="rounded-lg border border-blue-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </label>
                      <button
                        onClick={() => {
                          const newTramites = editingJuntaTramites.filter((_, i) => i !== idx);
                          setEditingJuntaTramites(newTramites);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg cursor-pointer"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setEditingJuntaId(null);
                  setEditingJuntaTramites([]);
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-gray-300 text-gray-800 font-semibold hover:bg-gray-400 cursor-pointer transition"
              >
                ✕ Cancelar
              </button>
              <button
                onClick={() => handleSaveJuntaEdit(editingJuntaId)}
                disabled={editingJuntaTramites.length === 0}
                className={`flex-1 px-4 py-3 rounded-lg font-semibold transition cursor-pointer ${
                  editingJuntaTramites.length > 0
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                💾 Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
