export function GET() {
  const now = new Date();
  // Bolivia = UTC-4 (sin horario de verano)
  const bolivia = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const hours = String(bolivia.getUTCHours()).padStart(2, "0");
  const minutes = String(bolivia.getUTCMinutes()).padStart(2, "0");
  const date = bolivia.toISOString().slice(0, 10);

  return Response.json({ time: `${hours}:${minutes}`, date, iso: bolivia.toISOString() });
}
