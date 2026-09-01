export async function getServerNow(): Promise<{ time: string; date: string; iso: string }> {
  try {
    const res = await fetch("/api/hora", { cache: "no-store" });
    if (!res.ok) throw new Error("no-ok");
    return await res.json();
  } catch {
    // Fallback a hora local si el servidor no responde
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return {
      time: `${hours}:${minutes}`,
      date: now.toISOString().slice(0, 10),
      iso: now.toISOString(),
    };
  }
}
