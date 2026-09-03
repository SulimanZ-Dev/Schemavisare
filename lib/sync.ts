import { diffSchedules } from "./diff";
import { lessonEnded, weekStarts } from "./dates";
import { sendChangeNotifications, sendReminderNotifications } from "./notifications";
import { mockProvider } from "./providers/mock";
import { skola24Provider } from "./providers/skola24";
import { store } from "./store";
import type { ScheduleState, ScheduleSnapshot } from "./types";
// Real public data is the safe default. Set SCHEDULE_PROVIDER=mock only for offline UI work and tests.
const provider = () => process.env.SCHEDULE_PROVIDER === "mock" ? mockProvider : skola24Provider;
export function getProviderName() { return provider().name; }
const active = (changes: Awaited<ReturnType<typeof store.changes>>) => changes.filter(x => !lessonEnded(x.lesson.date, x.lesson.end, Date.now()));
export async function syncSchedule(): Promise<ScheduleState> { const previous = (await store.snapshot()) ?? null; try { const lessons = await provider().fetchWeeks(weekStarts()); const snapshot: ScheduleSnapshot = { lessons, fetchedAt: new Date().toISOString(), source: provider().name, version: JSON.stringify(lessons) }; const newChanges = previous ? diffSchedules(previous.lessons, lessons) : []; const changes = [...(await store.changes()), ...newChanges]; await store.setSnapshot(snapshot); await store.setChanges(active(changes)); if (newChanges.length) await sendChangeNotifications(newChanges); await sendReminderNotifications(snapshot); return { snapshot, changes: active(changes), stale: false }; } catch (error) { return { snapshot: previous, changes: active(await store.changes()), stale: true, error: error instanceof Error ? error.message : "Schemat kunde inte uppdateras." }; } }
export async function getPublicSchedule(): Promise<ScheduleState> { const snapshot = await store.snapshot(); return snapshot ? { snapshot, changes: active(await store.changes()), stale: false } : syncSchedule(); }
