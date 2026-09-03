import type { Lesson, ScheduleChange } from "./types";
const strict = (l: Lesson) => `${l.year}-${l.isoWeek}-${l.date}-${l.start}-${l.subject}`;
const loose = (l: Lesson) => `${l.year}-${l.isoWeek}-${l.subject}`;
const eq = (a: Lesson, b: Lesson) => a.date === b.date && a.start === b.start && a.end === b.end && a.subject === b.subject && a.room === b.room && a.teacher === b.teacher && !!a.cancelled === !!b.cancelled;
const message = (old: Lesson, next: Lesson) => {
  if (old.date !== next.date) return `Flyttad från ${old.date} ${old.start} till ${next.date} ${next.start}`;
  if (old.start !== next.start || old.end !== next.end) return `Tid ändrad: ${old.start}–${old.end} → ${next.start}–${next.end}`;
  if (old.room !== next.room) return `Plats ändrad${next.room ? `: ${next.room}` : ""}`;
  return "Uppgifter ändrade";
};
export function diffSchedules(previous: Lesson[], current: Lesson[], now = new Date().toISOString()): ScheduleChange[] {
  const result: ScheduleChange[] = [], used = new Set<string>(); const byStrict = new Map(previous.map(x => [strict(x), x])); const byLoose = new Map(previous.map(x => [loose(x), x]));
  for (const lesson of current) { const old = byStrict.get(strict(lesson)) ?? byLoose.get(loose(lesson)); if (!old) { result.push({ id: `added:${lesson.id}`, kind: "added", lesson, detectedAt: now, message: "Ny post i schemat" }); continue; } used.add(old.id); if (eq(old, lesson)) continue; const kind = lesson.cancelled ? "cancelled" : old.date !== lesson.date ? "moved" : "changed"; result.push({ id: `${kind}:${old.id}:${lesson.id}:${now}`, kind, lesson, previous: old, detectedAt: now, message: kind === "cancelled" ? "Lektionen är inställd" : message(old, lesson) }); }
  for (const old of previous) if (!used.has(old.id) && !current.some(x => x.id === old.id)) result.push({ id: `cancelled:${old.id}:${now}`, kind: "cancelled", lesson: { ...old, cancelled: true }, previous: old, detectedAt: now, message: "Lektionen saknas i den senaste källversionen" });
  return result;
}
