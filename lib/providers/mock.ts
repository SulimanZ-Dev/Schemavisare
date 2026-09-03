import { isoWeek } from "@/lib/dates";
import { getSimulation } from "@/lib/simulation";
import type { Lesson, ScheduleProvider } from "@/lib/types";

const samples = [
  ["09:00", "11:30", "Webbutveckling"],
  ["13:00", "15:30", "Databaser"],
  ["09:00", "12:00", "JavaScript"],
  ["13:00", "16:00", "Projektarbete"],
  ["09:00", "11:30", "UX och tillgänglighet"],
] as const;
const rooms = ["Sal 3", "Sal 5", undefined, "Labbsal", "Sal 2"];

const shiftTime = (t: string, minutes: number) => {
  const [hh, mm] = t.split(":").map(Number);
  const total = (hh * 60 + mm + minutes + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// Det deterministiska basschemat för de fyra veckorna.
export function buildMockLessons(starts: string[]): Lesson[] {
  return starts.flatMap((start, weekIndex) =>
    samples.flatMap(([begin, end, subject], day) => {
      const date = new Date(`${start}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + day);
      const dateKey = date.toISOString().slice(0, 10);
      if (day === 2 && weekIndex % 2 === 0) return []; // JavaScript "går in" varannan vecka
      return [{
        id: `mock-${dateKey}-${begin}-${subject}`,
        year: date.getUTCFullYear(),
        isoWeek: isoWeek(date),
        date: dateKey,
        start: begin,
        end,
        subject,
        room: rooms[day],
      } as Lesson];
    })
  );
}

// Testmiljö: deterministiska mutationer som var för sig kan översättas till en
// realistisk schemaändring. applySimulation(strs, base, kinds) applicerar den
// begärda uppsättningen så att Testmiljön kan visa en typ i taget.
export type MockChangeKind = "cancelled" | "changed-time" | "moved" | "added";
export const ALL_MOCK_CHANGES: MockChangeKind[] = ["cancelled", "changed-time", "moved", "added"];

const weekKey = (dateStr: string) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return `${d.getUTCFullYear()}-${isoWeek(d)}`;
};

// 1) Inställd: markera "Projektarbete" som inställd i veckan +2 (behålls i
//    schemat så att korten visar den röd/överstruken – precis som Skola24
//    representerar inställda lektioner med en cancelled-flagga).
function mutateCancelled(starts: string[], lessons: Lesson[]): void {
  const target = weekKey(starts[2]);
  for (const l of lessons) {
    if (`${l.year}-${l.isoWeek}` === target && l.subject === "Projektarbete") l.cancelled = true;
  }
}

// 2) Ändrad tid: förläng "Databaser" med 60 minuter i veckan +1.
function mutateChangedTime(starts: string[], lessons: Lesson[]): void {
  const target = weekKey(starts[1]);
  for (const l of lessons) {
    if (`${l.year}-${l.isoWeek}` === target && l.subject === "Databaser") l.end = shiftTime(l.end, 60);
  }
}

// 3) Andrad dag: flytta "UX och tillgänglighet" från fredag till tisdag (samma ISO-vecka +1).
function mutateMovedDay(starts: string[], lessons: Lesson[]): void {
  const tue = new Date(`${starts[1]}T12:00:00Z`);
  tue.setUTCDate(tue.getUTCDate() + 1);
  const tueKey = tue.toISOString().slice(0, 10);
  const target = weekKey(starts[1]);
  for (const l of lessons) {
    if (`${l.year}-${l.isoWeek}` === target && l.subject === "UX och tillgänglighet") l.date = tueKey;
  }
}

// 4) Ny post: lägg till "Redovisning" på måndag förmiddag i veckan +3.
function mutateAdded(starts: string[], lessons: Lesson[]): void {
  const mon = new Date(`${starts[3]}T12:00:00Z`);
  const monKey = mon.toISOString().slice(0, 10);
  lessons.push({
    id: `mock-added-${monKey}-09:00-Redovisning`,
    year: mon.getUTCFullYear(),
    isoWeek: isoWeek(mon),
    date: monKey,
    start: "09:00",
    end: "11:00",
    subject: "Redovisning",
    room: "Sal 4",
  });
}

export function applySimulation(starts: string[], base: Lesson[], kinds: MockChangeKind[] = ALL_MOCK_CHANGES): Lesson[] {
  const lessons = base.map((l) => ({ ...l }));
  for (const kind of kinds) {
    if (kind === "cancelled") mutateCancelled(starts, lessons);
    else if (kind === "changed-time") mutateChangedTime(starts, lessons);
    else if (kind === "moved") mutateMovedDay(starts, lessons);
    else if (kind === "added") mutateAdded(starts, lessons);
  }
  return lessons;
}

export const mockProvider: ScheduleProvider = {
  name: "mock",
  async fetchWeeks(starts) {
    const base = buildMockLessons(starts);
    const simulation = await getSimulation();
    return simulation.enabled ? applySimulation(starts, base) : base;
  },
};
