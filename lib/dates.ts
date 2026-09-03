const stockholm = "Europe/Stockholm";
export const stockholmParts = (input: Date | string) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: stockholm, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(new Date(input)).filter(x => x.type !== "literal").map(x => [x.type, x.value]));
export const stockholmDate = (input = new Date()) => { const p = stockholmParts(input); return `${p.year}-${p.month}-${p.day}`; };
export function mondayFor(date = new Date()): Date { const p = stockholmParts(date); const localNoon = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`); const offset = (localNoon.getUTCDay() + 6) % 7; localNoon.setUTCDate(localNoon.getUTCDate() - offset); return localNoon; }
export const addDays = (date: Date, days: number) => { const copy = new Date(date); copy.setUTCDate(copy.getUTCDate() + days); return copy; };
export const isoWeek = (date: Date) => { const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7); };
export const weekStarts = (now = new Date()) => Array.from({ length: 4 }, (_, i) => addDays(mondayFor(now), i * 7).toISOString().slice(0, 10));
export const formatDate = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: stockholm, weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00Z`));
export const formatUpdated = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: stockholm, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
export function stockholmInstant(date: string, time: string): Date { // Browser-safe zone conversion for schedule comparisons
  const guess = new Date(`${date}T${time}:00Z`); const wanted = `${date}, ${time}`;
  for (let i = -120; i <= 120; i += 30) { const candidate = new Date(guess.getTime() - i * 60000); const p = stockholmParts(candidate); if (`${p.year}-${p.month}-${p.day}, ${p.hour}:${p.minute}` === wanted) return candidate; }
  return guess;
}
export function lessonEnded(date: string, end: string, now: number): boolean {
  return stockholmInstant(date, end).getTime() <= now;
}
export function lessonWithinReminderWindow(date: string, start: string, now: number, windowMs = 60 * 60 * 1000): boolean {
  const when = stockholmInstant(date, start).getTime();
  const delta = when - now;
  return delta > 0 && delta <= windowMs;
}
