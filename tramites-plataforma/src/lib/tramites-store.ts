"use client";

import { useEffect, useMemo, useState } from "react";

export type AreaId = "supervisor" | "ruat" | "legal" | "revision-plano" | "tunari";
export type EntryStatus = "Registrado" | "En revisión" | "Aprobado";

export type Area = {
  id: AreaId;
  label: string;
  people: string[];
};

export type UserRole = "registrador" | "supervisor" | "tecnico";

export type PlannerUser = {
  id: string;
  name: string;
  pin: string;
  role?: UserRole; // "registrador" (default), "supervisor", "tecnico"
  areaId?: AreaId; // si se define, solo ve los técnicos de esa área
};

export type TechnicianOption = {
  id: string;
  name: string;
  areaId: AreaId;
  areaLabel: string;
};

export type Entry = {
  id: string;
  createdBy: string;
  createdByName: string;
  registrationNumber: string;
  tramiteCode: string;
  technicianId: string;
  technicianName: string;
  technicianArea: string;
  scheduleDate: string;
  registrationDate: string;
  observations: string;
  status: EntryStatus;
  createdAt: string;
  deleted?: boolean;     // borrado suave — visible solo en Firestore Console
   // NUEVOS CAMPOS:
  scheduledTime?: string;  // Hora programada (ej: "10:00")
  scheduledEndTime?: string; //Hora fin estimada
  // Datos de seguimiento:
  followUp?: {
    clientName?: string;
    arrivalTime?: string;
    attendedTime?: string;
    completedTime?: string;
    calledTime?: string;
    returnedTime?: string;
    actualTechnicianId?: string;
    actualTechnicianName?: string;
    attended?: boolean;
    followUpStatus?: "esperando" | "en-revision" | "llamado" | "no-escucho" | "regreso" | "atendiendo" | "completado";
    observations?: string;
    createdAt?: string;
    isUnscheduled?: boolean;
  };
};

export type EntryFormValues = {
  tramiteCode: string;
  technicianId: string;
  scheduleDate: string;
  observations: string;
};

type PersistedState = {
  currentUserId: string;
  currentTechnicianId?: string;
  entries: Entry[];
};

export const plannerUsers: PlannerUser[] = [
  { id: "wayra",     name: "WAYRA",     pin: "1111", role: "registrador" },
  { id: "jaqueline", name: "JAQUELINE", pin: "2222", role: "registrador" },
  { id: "tunari",    name: "TUNARI",    pin: "3333", areaId: "tunari", role: "registrador" },
  { id: "roly",      name: "ROLY",      pin: "4444", role: "supervisor" },
];

export const areas: Area[] = [
  {
    id: "supervisor",
    label: "Supervisor",
    people: ["ROLY CH.", "CARLO A.", "OSCAR A."],
  },
  {
    id: "ruat",
    label: "Ruat",
    people: ["IGNACIO G.", "ALEX V.", "VANESA C."],
  },
  {
    id: "legal",
    label: "Legal",
    people: ["HUASCAR A.", "MA.RENEE G.", "DENIZ R.", "MARIANELA S.", "FELIPE M."],
  },
  {
    id: "revision-plano",
    label: "Revision plano",
    people: ["CHRISTIAN D.", "MARTHA M.", "ROGER M.", "ELSA R.", "MERCEDES C.", "LAVINIA L."],
  },
  {
    id: "tunari",
    label: "Tunari",
    people: ["KARLA VARGAS", "MARIA RENNEE F.", "JORGE SOLIZ", "KAREN S.", "ROYER M.", "ALFREDO V.", "KARLA A."],
  },
];

export const technicians: TechnicianOption[] = [
  // Área especial: Archivos (engloba RAM, Firma de Jefatura, Firma Secretaria)
  {
    id: "archivos",
    name: "Archivos",
    areaId: "archivos" as AreaId,
    areaLabel: "Archivos",
  },
  ...areas.flatMap((area) =>
    area.people.map((name) => ({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name,
      areaId: area.id,
      areaLabel: area.label,
    })),
  ),
];

const storageKey = "gmc-tramites-mvp";

export const initialForm: EntryFormValues = {
  tramiteCode: "",
  technicianId: technicians[0].id,
  scheduleDate: "2026-08-11",
  observations: "",
};

export const DURACION_TRAMITE = 15; // minutos
export const HORA_INICIO_ATENCION = 8; // 08:00
export const HORA_FIN_ATENCION = 12;

export function calcularHoraProgramada(
  indexEnFila: number,
  horaInicio: number = HORA_INICIO_ATENCION
): { time: string; endTime: string } {
  const DURACION = DURACION_TRAMITE;
  
  const minutosDesdeInicio = indexEnFila * DURACION;
  const horaCalculada = horaInicio + Math.floor(minutosDesdeInicio / 60);
  const minutosCalculados = minutosDesdeInicio % 60;
  
  const horaFin = horaInicio + Math.floor((minutosDesdeInicio + DURACION) / 60);
  const minutosFin = (minutosDesdeInicio + DURACION) % 60;
  
  const time = `${String(horaCalculada).padStart(2, '0')}:${String(minutosCalculados).padStart(2, '0')}`;
  const endTime = `${String(horaFin).padStart(2, '0')}:${String(minutosFin).padStart(2, '0')}`;
  
  return { time, endTime };
}

export const statusOptions: EntryStatus[] = ["Registrado", "En revisión", "Aprobado"];

function createRegistrationNumber(index: number) {
  return `REG-${String(index).padStart(4, "0")}`;
}

function normalizeDateInput(rawValue: unknown, fallbackDate: string) {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return fallbackDate;
  }

  const value = rawValue.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackDate;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeStoredStatus(rawStatus: unknown): EntryStatus {
  if (rawStatus === "En revisión" || rawStatus === "Aprobado") {
    return rawStatus;
  }

  return "Registrado";
}

function normalizeStoredEntry(rawEntry: Record<string, unknown>, index: number): Entry {
  const fallbackDate = "2026-08-27";
  // Gestión interna tiene IDs especiales como "__ram__" — preservar sin buscar en lista de técnicos
  const rawTechId = typeof rawEntry.technicianId === "string" ? rawEntry.technicianId : "";
  const isGestionInterna = rawTechId.startsWith("__") || rawEntry.technicianArea === "Gestión Interna";

  const technicianFromRecord =
    !isGestionInterna && rawTechId.trim().length > 0
      ? technicians.find((item) => item.id === rawTechId)
      : null;

  const technicianFromName =
    !isGestionInterna && typeof rawEntry.technicianName === "string" && rawEntry.technicianName.trim().length > 0
      ? technicians.find((item) => item.name === rawEntry.technicianName)
      : null;

  const technician = technicianFromRecord ?? technicianFromName ?? technicians[0];

  const scheduleDate = normalizeDateInput(rawEntry.scheduleDate ?? rawEntry.fecha, fallbackDate);
  const registrationDate = normalizeDateInput(rawEntry.registrationDate, scheduleDate);

  const creatorId =
    typeof rawEntry.createdBy === "string" && plannerUsers.some((user) => user.id === rawEntry.createdBy)
      ? rawEntry.createdBy
      : plannerUsers[0].id;

  const creatorName = plannerUsers.find((user) => user.id === creatorId)?.name ?? plannerUsers[0].name;

  return {
    id:
      typeof rawEntry.id === "string" && rawEntry.id.trim().length > 0
        ? rawEntry.id
        : `legacy-${Date.now()}-${index}`,
    createdBy: creatorId,
    createdByName:
      typeof rawEntry.createdByName === "string" && rawEntry.createdByName.trim().length > 0
        ? rawEntry.createdByName
        : creatorName,
    registrationNumber:
      typeof rawEntry.registrationNumber === "string" && rawEntry.registrationNumber.trim().length > 0
        ? rawEntry.registrationNumber
        : createRegistrationNumber(index + 1),
    tramiteCode:
      typeof rawEntry.tramiteCode === "string" && rawEntry.tramiteCode.trim().length > 0
        ? rawEntry.tramiteCode
        : typeof rawEntry.expediente === "string"
          ? rawEntry.expediente
          : "",
    technicianId: isGestionInterna ? rawTechId : technician.id,
    technicianName: isGestionInterna
      ? (typeof rawEntry.technicianName === "string" ? rawEntry.technicianName : rawTechId)
      : technician.name,
    technicianArea: isGestionInterna ? "Gestión Interna" : technician.areaLabel,
    scheduleDate,
    registrationDate,
    observations:
      typeof rawEntry.observations === "string"
        ? rawEntry.observations
        : typeof rawEntry.observacion === "string"
          ? rawEntry.observacion
          : "",
    status: normalizeStoredStatus(rawEntry.status),
    deleted: rawEntry.deleted === true ? true : undefined,
    createdAt:
      typeof rawEntry.createdAt === "string" && rawEntry.createdAt.trim().length > 0
        ? rawEntry.createdAt
        : new Date(`${registrationDate}T08:00:00.000Z`).toISOString(),
    
   // NUEVO: Procesar scheduledTime
scheduledTime: typeof rawEntry.scheduledTime === "string" 
  ? rawEntry.scheduledTime 
  : undefined,

// NUEVO: Procesar scheduledEndTime ← AGREGAR ESTA LÍNEA
scheduledEndTime: typeof rawEntry.scheduledEndTime === "string" 
  ? rawEntry.scheduledEndTime 
  : undefined,

followUp: rawEntry.followUp && typeof rawEntry.followUp === "object"
  ? {
      clientName: typeof (rawEntry.followUp as any).clientName === "string" ? (rawEntry.followUp as any).clientName : undefined,
      arrivalTime: typeof (rawEntry.followUp as any).arrivalTime === "string" ? (rawEntry.followUp as any).arrivalTime : undefined,
      attended: typeof (rawEntry.followUp as any).attended === "boolean" ? (rawEntry.followUp as any).attended : undefined,
      attendedTime: typeof (rawEntry.followUp as any).attendedTime === "string" ? (rawEntry.followUp as any).attendedTime : undefined,
      completedTime: typeof (rawEntry.followUp as any).completedTime === "string" ? (rawEntry.followUp as any).completedTime : undefined,
      calledTime: typeof (rawEntry.followUp as any).calledTime === "string" ? (rawEntry.followUp as any).calledTime : undefined,
      returnedTime: typeof (rawEntry.followUp as any).returnedTime === "string" ? (rawEntry.followUp as any).returnedTime : undefined,
      followUpStatus: typeof (rawEntry.followUp as any).followUpStatus === "string" ? (rawEntry.followUp as any).followUpStatus : undefined,
      actualTechnicianId: typeof (rawEntry.followUp as any).actualTechnicianId === "string" ? (rawEntry.followUp as any).actualTechnicianId : undefined,
      actualTechnicianName: typeof (rawEntry.followUp as any).actualTechnicianName === "string" ? (rawEntry.followUp as any).actualTechnicianName : undefined,
      observations: typeof (rawEntry.followUp as any).observations === "string" ? (rawEntry.followUp as any).observations : undefined,
      createdAt: typeof (rawEntry.followUp as any).createdAt === "string" ? (rawEntry.followUp as any).createdAt : undefined,
      isUnscheduled: typeof (rawEntry.followUp as any).isUnscheduled === "boolean" ? (rawEntry.followUp as any).isUnscheduled : undefined,
    }
  : undefined,
  };
}

function makeSeedEntry(params: {
  createdBy: string;
  tramiteCode: string;
  technicianId: string;
  scheduleDate: string;
  observations: string;
  index: number;
}) {
  const creator = plannerUsers.find((user) => user.id === params.createdBy) ?? plannerUsers[0];
  const technician = technicians.find((item) => item.id === params.technicianId) ?? technicians[0];

  return {
    id: `seed-${params.index}`,
    createdBy: creator.id,
    createdByName: creator.name,
    registrationNumber: createRegistrationNumber(params.index + 1),
    tramiteCode: params.tramiteCode,
    technicianId: technician.id,
    technicianName: technician.name,
    technicianArea: technician.areaLabel,
    scheduleDate: params.scheduleDate,
    registrationDate: params.scheduleDate,
    observations: params.observations,
    status: "Registrado" as EntryStatus,
    createdAt: new Date(`${params.scheduleDate}T08:00:00.000Z`).toISOString(),
  } satisfies Entry;
}

// Obtener HOY
const today = new Date();
const todayString = today.toISOString().slice(0, 10);
const tomorrowString = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);

// Seed data con pruebas para HOY y MAÑANA
const seedEntries: Entry[] = [
  // HOY - VANESA C. (RUAT)
  {
    id: "entry-today-1",
    createdBy: "wayra",
    createdByName: "WAYRA",
    registrationNumber: "REG-0001",
    tramiteCode: "2026016618",
    technicianId: "vanesa-c",
    technicianName: "VANESA C.",
    technicianArea: "Ruat",
    scheduleDate: todayString,
    registrationDate: todayString,
    observations: "Documento importante, cliente VIP",
    status: "Registrado",
    createdAt: new Date().toISOString(),
    scheduledTime: "08:00",
    scheduledEndTime: "08:15",
  },
  {
    id: "entry-today-2",
    createdBy: "wayra",
    createdByName: "WAYRA",
    registrationNumber: "REG-0002",
    tramiteCode: "2026016619",
    technicianId: "vanesa-c",
    technicianName: "VANESA C.",
    technicianArea: "Ruat",
    scheduleDate: todayString,
    registrationDate: todayString,
    observations: "Revisión de expediente",
    status: "Registrado",
    createdAt: new Date().toISOString(),
    scheduledTime: "08:15",
    scheduledEndTime: "08:30",
    followUp: {
      clientName: "Juan Pérez",
      arrivalTime: "08:15",
      attended: false,
      observations: "Cliente llegó",
      createdAt: new Date().toISOString(),
    },
  },
  {
    id: "entry-today-3",
    createdBy: "wayra",
    createdByName: "WAYRA",
    registrationNumber: "REG-0003",
    tramiteCode: "2026016620",
    technicianId: "vanesa-c",
    technicianName: "VANESA C.",
    technicianArea: "Ruat",
    scheduleDate: todayString,
    registrationDate: todayString,
    observations: "Trámite urgente",
    status: "Registrado",
    createdAt: new Date().toISOString(),
    scheduledTime: "08:30",
    scheduledEndTime: "08:45",
    followUp: {
      clientName: "María García",
      arrivalTime: "08:28",
      attended: true,
      attendedTime: "08:35",
      observations: "Ya fue atendido",
      createdAt: new Date().toISOString(),
    },
  },
  {
    id: "entry-today-4",
    createdBy: "wayra",
    createdByName: "WAYRA",
    registrationNumber: "REG-0004",
    tramiteCode: "2026016621",
    technicianId: "vanesa-c",
    technicianName: "VANESA C.",
    technicianArea: "Ruat",
    scheduleDate: todayString,
    registrationDate: todayString,
    observations: "Revisión de planos",
    status: "Registrado",
    createdAt: new Date().toISOString(),
    scheduledTime: "08:45",
    scheduledEndTime: "09:00",
  },
  {
    id: "entry-today-5",
    createdBy: "jaqueline",
    createdByName: "JAQUELINE",
    registrationNumber: "REG-0005",
    tramiteCode: "2026016622",
    technicianId: "ignacio-g",
    technicianName: "IGNACIO G.",
    technicianArea: "Ruat",
    scheduleDate: todayString,
    registrationDate: todayString,
    observations: "Revisión de documentos",
    status: "Registrado",
    createdAt: new Date().toISOString(),
    scheduledTime: "08:00",
    scheduledEndTime: "08:15",
    followUp: {
      clientName: "Carlos López",
      arrivalTime: "08:02",
      attended: false,
      observations: "Llegó hace poco",
      createdAt: new Date().toISOString(),
    },
  },
  {
    id: "entry-today-6",
    createdBy: "jaqueline",
    createdByName: "JAQUELINE",
    registrationNumber: "REG-0006",
    tramiteCode: "2026016623",
    technicianId: "ignacio-g",
    technicianName: "IGNACIO G.",
    technicianArea: "Ruat",
    scheduleDate: todayString,
    registrationDate: todayString,
    observations: "Trámite normal",
    status: "Registrado",
    createdAt: new Date().toISOString(),
    scheduledTime: "08:15",
    scheduledEndTime: "08:30",
  },
  {
    id: "entry-today-7",
    createdBy: "wayra",
    createdByName: "WAYRA",
    registrationNumber: "REG-0007",
    tramiteCode: "2026016624",
    technicianId: "alex-v",
    technicianName: "ALEX V.",
    technicianArea: "Ruat",
    scheduleDate: todayString,
    registrationDate: todayString,
    observations: "Revisión de carpeta",
    status: "Registrado",
    createdAt: new Date().toISOString(),
    scheduledTime: "08:00",
    scheduledEndTime: "08:15",
  },
  {
    id: "entry-today-8",
    createdBy: "wayra",
    createdByName: "WAYRA",
    registrationNumber: "REG-0008",
    tramiteCode: "2026016625",
    technicianId: "alex-v",
    technicianName: "ALEX V.",
    technicianArea: "Ruat",
    scheduleDate: todayString,
    registrationDate: todayString,
    observations: "Documento incompleto",
    status: "Registrado",
    createdAt: new Date().toISOString(),
    scheduledTime: "08:15",
    scheduledEndTime: "08:30",
    followUp: {
      clientName: "Ana Rodríguez",
      arrivalTime: "08:14",
      attended: false,
      observations: "Cliente esperando",
      createdAt: new Date().toISOString(),
    },
  },

  // MAÑANA - Algunos datos para prueba futura
  {
    id: "entry-tomorrow-1",
    createdBy: "wayra",
    createdByName: "WAYRA",
    registrationNumber: "REG-0009",
    tramiteCode: "2026016626",
    technicianId: "vanesa-c",
    technicianName: "VANESA C.",
    technicianArea: "Ruat",
    scheduleDate: tomorrowString,
    registrationDate: tomorrowString,
    observations: "Mañana",
    status: "Registrado",
    createdAt: new Date().toISOString(),
    scheduledTime: "08:00",
    scheduledEndTime: "08:15",
  },
];

/*const seedEntries: Entry[] = [
  makeSeedEntry({
    createdBy: "wayra",
    tramiteCode: "2026016618",
    technicianId: "vanesa-c",
    scheduleDate: "2026-08-11",
    observations: "Registro inicial de ejemplo.",
    index: 0,
  }),
  makeSeedEntry({
    createdBy: "jaqueline",
    tramiteCode: "202501359",
    technicianId: "huascar-a",
    scheduleDate: "2026-08-11",
    observations: "Registro inicial de ejemplo.",
    index: 1,
  }),
]; */

export function formatDate(dateString: string) {
  const normalized = normalizeDateInput(dateString, "2026-08-11");
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${normalized}T00:00:00`));
}

export function getStatusTone(status: EntryStatus) {
  if (status === "Registrado") return "border-slate-200 bg-slate-50 text-slate-800";
  if (status === "Aprobado") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function getAreaTone(areaLabel: string) {
  if (areaLabel === "Supervisor") return "border-slate-200 bg-slate-50 text-slate-800";
  if (areaLabel === "Ruat") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (areaLabel === "Legal") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

export function getNextRegistrationNumber(entries: Entry[]) {
  return createRegistrationNumber(entries.length + 1);
}

export function countEntriesForTechnicianOnDate(entries: Entry[], technicianId: string, date: string) {
  return entries.filter((entry) => entry.technicianId === technicianId && entry.scheduleDate === date).length;
}

export function groupEntriesByTechnician(entries: Entry[]) {
  return technicians.map((technician) => ({
    technician,
    total: entries.filter((entry) => entry.technicianId === technician.id).length,
  }));
}

export function groupEntriesByCreator(entries: Entry[]) {
  return plannerUsers.map((user) => ({
    user,
    total: entries.filter((entry) => entry.createdBy === user.id).length,
  }));
}

export function groupEntriesByDateAndCreator(entries: Entry[]) {
  const map = new Map<string, { date: string; byUser: Record<string, number>; total: number }>();

  for (const entry of entries) {
    const key = entry.registrationDate;
    if (!map.has(key)) {
      map.set(key, {
        date: key,
        byUser: plannerUsers.reduce(
          (accumulator, user) => {
            accumulator[user.id] = 0;
            return accumulator;
          },
          {} as Record<string, number>,
        ),
        total: 0,
      });
    }

    const bucket = map.get(key)!;
    bucket.byUser[entry.createdBy] = (bucket.byUser[entry.createdBy] ?? 0) + 1;
    bucket.total += 1;
  }

  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

//registro por fecha y tecnico
export function groupEntriesByDateAndTechnician(entries: Entry[]) {
  const map = new Map<string, { date: string; byTechnician: Record<string, number>; total: number }>();

  for (const entry of entries) {
    const key = entry.registrationDate;
    if (!map.has(key)) {
      map.set(key, {
        date: key,
        byTechnician: technicians.reduce(
          (accumulator, tech) => {
            accumulator[tech.id] = 0;
            return accumulator;
          },
          {} as Record<string, number>,
        ),
        total: 0,
      });
    }

    const bucket = map.get(key)!;
    bucket.byTechnician[entry.technicianId] = (bucket.byTechnician[entry.technicianId] ?? 0) + 1;
    bucket.total += 1;
  }

  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function useTramitesStore() {
  const [hydrated, setHydrated] = useState(false);
  const [entries, setEntries] = useState<Entry[]>(seedEntries);
  const [currentUserId, setCurrentUserId] = useState(plannerUsers[0].id);
  const [currentTechnicianId, setCurrentTechnicianId] = useState<string | undefined>(undefined);

useEffect(() => {
  const savedUserId = localStorage.getItem('currentUserId');
  if (savedUserId && plannerUsers.some(u => u.id === savedUserId)) {
    setCurrentUserId(savedUserId);
  }

  const savedTechnicianId = localStorage.getItem('currentTechnicianId');
  if (savedTechnicianId && technicians.some(t => t.id === savedTechnicianId)) {
    setCurrentTechnicianId(savedTechnicianId);
  }

  let unsubscribe: (() => void) | undefined;

  (async () => {
    try {
      const { firestore } = await import('@/lib/firebase');
      const { collection, onSnapshot } = await import('firebase/firestore');

      unsubscribe = onSnapshot(
        collection(firestore, 'entries'),
        (snapshot) => {
          if (!snapshot.empty) {
            const firestoreEntries = snapshot.docs
              .map((docSnap, i) =>
                normalizeStoredEntry({ ...docSnap.data(), id: docSnap.id } as Record<string, unknown>, i)
              )
              .filter((e) => !e.deleted);   // ocultar borrados suaves
            setEntries(firestoreEntries);
          } else {
            setEntries(seedEntries);
          }
          setHydrated(true);
        },
        (error) => {
          console.warn('Firestore listener error:', error);
          setEntries(seedEntries);
          setHydrated(true);
        }
      );
    } catch (error) {
      console.warn('Error setting up Firestore listener:', error);
      setEntries(seedEntries);
      setHydrated(true);
    }
  })();

  return () => { if (unsubscribe) unsubscribe(); };
}, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ currentUserId, currentTechnicianId, entries } satisfies PersistedState),
    );
  }, [currentUserId, currentTechnicianId, entries, hydrated]);

  const currentUser = useMemo(
    () => plannerUsers.find((user) => user.id === currentUserId) ?? plannerUsers[0],
    [currentUserId],
  );

  const myEntries = useMemo(
    () => entries.filter((entry) => entry.createdBy === currentUserId),
    [currentUserId, entries],
  );

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayEntries = entries.filter((entry) => entry.registrationDate === today);

    return [
      ["Usuarias registradoras", String(plannerUsers.length)],
      ["Registros hoy", String(todayEntries.length)],
      ["Total acumulado", String(entries.length)],
    ] as const;
  }, [entries]);

function persistState(nextEntries: Entry[], nextUserId?: string) {
  setEntries(nextEntries);
  if (nextUserId) {
    setCurrentUserId(nextUserId);
    localStorage.setItem('currentUserId', nextUserId);
  }
}

  function stripUndefined(obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map(stripUndefined);
    if (obj !== null && typeof obj === "object") {
      return Object.fromEntries(
        Object.entries(obj as Record<string, unknown>)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, stripUndefined(v)])
      );
    }
    return obj;
  }

  function firestoreSet(entryId: string, data: Entry) {
    (async () => {
      try {
        const { firestore } = await import('@/lib/firebase');
        const { doc, setDoc } = await import('firebase/firestore');
        await setDoc(doc(firestore, 'entries', entryId), stripUndefined(data));
      } catch (error) {
        console.error('Error escribiendo en Firestore:', error);
      }
    })();
  }

  function firestoreDelete(entryId: string) {
    (async () => {
      try {
        const { firestore } = await import('@/lib/firebase');
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(firestore, 'entries', entryId));
      } catch (error) {
        console.error('Error eliminando de Firestore:', error);
      }
    })();
  }

  function createEntry(form: EntryFormValues | Partial<Entry>) {
    if ('id' in form && form.id) {
      persistState([form as Entry, ...entries]);
      firestoreSet(form.id, form as Entry);
      return;
    }

    const formData = form as EntryFormValues;
    const technician = technicians.find((item) => item.id === formData.technicianId) ?? technicians[0];
    const creator = plannerUsers.find((user) => user.id === currentUserId) ?? plannerUsers[0];

    const nextEntry: Entry = {
      id: `entry-${Date.now()}`,
      createdBy: creator.id,
      createdByName: creator.name,
      registrationNumber: getNextRegistrationNumber(entries),
      tramiteCode: formData.tramiteCode.trim(),
      technicianId: technician.id,
      technicianName: technician.name,
      technicianArea: technician.areaLabel,
      scheduleDate: formData.scheduleDate,
      registrationDate: new Date().toISOString().slice(0, 10),
      observations: formData.observations.trim(),
      status: "Registrado",
      createdAt: new Date().toISOString(),
      scheduledTime: 'scheduledTime' in form ? (form as any).scheduledTime : undefined,
      scheduledEndTime: 'scheduledEndTime' in form ? (form as any).scheduledEndTime : undefined,
    };

    persistState([nextEntry, ...entries], currentUserId);
    firestoreSet(nextEntry.id, nextEntry);
  }

  function updateEntry(entryId: string, updatedEntry: Entry) {
    const nextEntries = entries.map((entry) =>
      entry.id === entryId ? updatedEntry : entry
    );
    persistState(nextEntries);
    firestoreSet(entryId, updatedEntry);
  }

  function updateEntryStatus(entryId: string, nextStatus: EntryStatus) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    updateEntry(entryId, { ...entry, status: nextStatus });
  }

  function removeEntry(entryId: string) {
    // Borrado suave: marca deleted=true en Firestore, filtra en UI
    // Para recuperar: ir a Firestore Console y cambiar deleted a false
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const softDeleted = { ...entry, deleted: true };
    const nextEntries = entries.filter((e) => e.id !== entryId);
    persistState(nextEntries);
    firestoreSet(entryId, softDeleted);
  }

  function resetDemo() {
    window.localStorage.removeItem(storageKey);
    setEntries(seedEntries);
    setCurrentUserId(plannerUsers[0].id);
  }

  

  return {
    hydrated,
    entries,
    metrics,
    areas,
    technicians,
    plannerUsers,
    currentUserId,
    setCurrentUserId,
    currentUser,
    myEntries,
    getNextRegistrationNumber: () => getNextRegistrationNumber(entries),
    countEntriesForTechnicianOnDate: (technicianId: string, date: string) =>
      countEntriesForTechnicianOnDate(entries, technicianId, date),
    groupEntriesByTechnician: () => groupEntriesByTechnician(entries),
    groupEntriesByCreator: () => groupEntriesByCreator(entries),
    groupEntriesByDateAndCreator: () => groupEntriesByDateAndCreator(entries),
    groupEntriesByDateAndTechnician: () => groupEntriesByDateAndTechnician(entries),
    createEntry,
    updateEntryStatus,
    updateEntry,
    removeEntry,
    resetDemo,
    currentTechnicianId,
    loginTechnician: (technicianId: string) => {
      setCurrentTechnicianId(technicianId);
      localStorage.setItem('currentTechnicianId', technicianId);
    },
    logoutTechnician: () => {
      setCurrentTechnicianId(undefined);
      localStorage.removeItem('currentTechnicianId');
    },
  };
}
