"use client";

import { useEffect, useMemo, useState } from "react";

export type AreaId = "supervisor" | "ruat" | "legal" | "revision-plano";
export type EntryStatus = "Registrado" | "En revisión" | "Aprobado";

export type Area = {
  id: AreaId;
  label: string;
  people: string[];
};

export type PlannerUser = {
  id: string;
  name: string;
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
};

export type EntryFormValues = {
  tramiteCode: string;
  technicianId: string;
  scheduleDate: string;
  observations: string;
};

type PersistedState = {
  currentUserId: string;
  entries: Entry[];
};

export const plannerUsers: PlannerUser[] = [
  { id: "wayra", name: "WAYRA" },
  { id: "jaqueline", name: "JAQUELINE" },
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
];

export const technicians: TechnicianOption[] = areas.flatMap((area) =>
  area.people.map((name) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    areaId: area.id,
    areaLabel: area.label,
  })),
);

const storageKey = "gmc-tramites-mvp";

export const initialForm: EntryFormValues = {
  tramiteCode: "",
  technicianId: technicians[0].id,
  scheduleDate: "2026-08-11",
  observations: "",
};

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
  const fallbackDate = "2026-08-11";
  const technicianFromRecord =
    typeof rawEntry.technicianId === "string" && rawEntry.technicianId.trim().length > 0
      ? technicians.find((item) => item.id === rawEntry.technicianId)
      : null;

  const technicianFromName =
    typeof rawEntry.technicianName === "string" && rawEntry.technicianName.trim().length > 0
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
    technicianId: technician.id,
    technicianName: technician.name,
    technicianArea: technician.areaLabel,
    scheduleDate,
    registrationDate,
    observations:
      typeof rawEntry.observations === "string"
        ? rawEntry.observations
        : typeof rawEntry.observacion === "string"
          ? rawEntry.observacion
          : "",
    status: normalizeStoredStatus(rawEntry.status),
    createdAt:
      typeof rawEntry.createdAt === "string" && rawEntry.createdAt.trim().length > 0
        ? rawEntry.createdAt
        : new Date(`${registrationDate}T08:00:00.000Z`).toISOString(),
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

const seedEntries: Entry[] = [
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
];

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

  useEffect(() => {
    const rawState = window.localStorage.getItem(storageKey);

    if (rawState) {
      try {
        const parsed = JSON.parse(rawState) as PersistedState;
        if (Array.isArray(parsed.entries) && parsed.entries.length > 0) {
          const normalizedEntries = parsed.entries.map((entry, index) =>
            normalizeStoredEntry(entry as unknown as Record<string, unknown>, index),
          );
          setEntries(normalizedEntries);
        }
        if (parsed.currentUserId && plannerUsers.some((user) => user.id === parsed.currentUserId)) {
          setCurrentUserId(parsed.currentUserId);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ currentUserId, entries } satisfies PersistedState),
    );
  }, [currentUserId, entries, hydrated]);

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

  function persistState(nextEntries: Entry[], nextUserId = currentUserId) {
    setEntries(nextEntries);
    setCurrentUserId(nextUserId);
  }

  function createEntry(form: EntryFormValues) {
    const technician = technicians.find((item) => item.id === form.technicianId) ?? technicians[0];
    const creator = plannerUsers.find((user) => user.id === currentUserId) ?? plannerUsers[0];

    const nextEntry: Entry = {
      id: `entry-${Date.now()}`,
      createdBy: creator.id,
      createdByName: creator.name,
      registrationNumber: getNextRegistrationNumber(entries),
      tramiteCode: form.tramiteCode.trim(),
      technicianId: technician.id,
      technicianName: technician.name,
      technicianArea: technician.areaLabel,
      scheduleDate: form.scheduleDate,
      registrationDate: new Date().toISOString().slice(0, 10),
      observations: form.observations.trim(),
      status: "Registrado",
      createdAt: new Date().toISOString(),
    };

    persistState([nextEntry, ...entries]);
  }

  function updateEntryStatus(entryId: string, nextStatus: EntryStatus) {
    const nextEntries = entries.map((entry) =>
      entry.id === entryId ? { ...entry, status: nextStatus } : entry,
    );
    persistState(nextEntries);
  }

  function removeEntry(entryId: string) {
    const nextEntries = entries.filter((entry) => entry.id !== entryId);
    persistState(nextEntries);
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
    removeEntry,
    resetDemo,
  };
}
