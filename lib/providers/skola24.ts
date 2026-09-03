import { isoWeek } from "@/lib/dates";
import type { Lesson, ScheduleProvider } from "@/lib/types";

const host = "kgyh.skola24.se";
const school = "Kunskapsgruppen Yrkeshögskola";
const className = "CS26";
const scope = "8a22163c-8662-4535-9050-bc5e1923df48";
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type ApiEnvelope<T> = { data?: T; error?: unknown; exception?: unknown };
type Unit = { unitGuid: string; unitId: string };
type LessonInfo = { guidId?: string; texts?: string[]; timeStart?: string; timeEnd?: string; dayOfWeekNumber?: number; cancelled?: boolean };
type RenderData = { lessonInfo?: LessonInfo[] };

async function request<T>(path: string, body: unknown, attempt = 0): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`https://web.skola24.se/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Scope": scope, "User-Agent": "Enkel-CS26-Schema/1.0" }, body: JSON.stringify(body), signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Skola24 svarade ${response.status}`);
    const envelope = await response.json() as ApiEnvelope<T>;
    if (envelope.error || envelope.exception || !envelope.data) throw new Error("Skola24 returnerade ett ogiltigt svar.");
    return envelope.data;
  } catch (error) { if (attempt >= 2) throw error; await pause(400 * 2 ** attempt); return request<T>(path, body, attempt + 1); } finally { clearTimeout(timer); }
}
function parseWeek(data: RenderData, monday: Date): Lesson[] { return (data.lessonInfo ?? []).flatMap(item => { const day = item.dayOfWeekNumber, start = item.timeStart?.slice(0, 5), end = item.timeEnd?.slice(0, 5); const texts = (item.texts ?? []).map(x => x.trim()).filter(Boolean); if (!day || day < 1 || day > 5 || !start || !end || !texts[0]) return []; const date = new Date(monday); date.setUTCDate(monday.getUTCDate() + day - 1); const dateKey = date.toISOString().slice(0, 10); return [{ id: item.guidId ? `s24-${item.guidId}` : `s24-${dateKey}-${start}-${texts[0]}`, year: date.getUTCFullYear(), isoWeek: isoWeek(date), date: dateKey, start, end, subject: texts[0], room: texts[1], teacher: texts[2], cancelled: item.cancelled }]; }); }

export const skola24Provider: ScheduleProvider = { name: "skola24", async fetchWeeks(starts) {
  // Bootstrap values are fetched once; week renders then happen strictly one at a time.
  const units = await request<{ getTimetableViewerUnitsResponse?: { units?: Unit[] } }>("services/skola24/get/timetable/viewer/units", { getTimetableViewerUnitsRequest: { hostName: host } });
  const unitGuid = units.getTimetableViewerUnitsResponse?.units?.find(x => x.unitId === school)?.unitGuid;
  if (!unitGuid) throw new Error("Kunde inte hitta Kunskapsgruppen Yrkeshögskola i Skola24.");
  const selection = await request<{ signature?: string }>("encrypt/signature", { signature: className });
  const schoolYears = await request<{ activeSchoolYears?: { guid: string }[] }>("get/active/school/years", { hostName: host, checkSchoolYearsFeatures: false });
  const schoolYear = schoolYears.activeSchoolYears?.[0]?.guid;
  const renderKey = await request<{ key?: string }>("get/timetable/render/key", {});
  if (!selection.signature || !schoolYear || !renderKey.key) throw new Error("Kunde inte förbereda schemahämtningen från Skola24.");
  const all: Lesson[] = [];
  for (const start of starts) { const monday = new Date(`${start}T12:00:00Z`); const rendered = await request<RenderData>("render/timetable", { renderKey: renderKey.key, selection: selection.signature, scheduleDay: 0, week: isoWeek(monday), year: monday.getUTCFullYear(), host, unitGuid, schoolYear, startDate: null, endDate: null, blackAndWhite: false, width: 125, height: 550, selectionType: 4, showHeader: false, periodText: "", privateFreeTextMode: false, privateSelectionMode: null, customerKey: "" }); all.push(...parseWeek(rendered, monday)); await pause(350); }
  return all;
} };
