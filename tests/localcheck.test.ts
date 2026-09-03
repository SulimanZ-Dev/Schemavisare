// Lokalt "dubbelkolla"-test: kör hela kärnpipen (mock-provider + minnesstore)
// utan nätverk och utan Redis. Kör med:  npm run test:local
// Detta är tänkt som ett snabbt sanity-check innan deploy – inte som ett
// substitut för integrationstester mot en riktig databas.
import { describe, expect, it } from "vitest";
import { isoWeek, weekStarts } from "@/lib/dates";
import { mockProvider } from "@/lib/providers/mock";
import { store } from "@/lib/store";
import type { ScheduleSnapshot } from "@/lib/types";

// Säkerställ att vi testar mot mock och minnesstore, aldrig mot nätet/Redis.
process.env.SCHEDULE_PROVIDER = "mock";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

const resetRefreshLock = () => {
  const g = globalThis as unknown as { __cs26Store?: { refreshAt?: number } };
  if (g.__cs26Store) g.__cs26Store.refreshAt = undefined;
};

describe("Dubbelkolla lokalt (mock + minne)", () => {
  it("mock-providern är deterministisk och ger bara vardagar (mån–fre)", async () => {
    const starts = weekStarts(new Date("2026-09-01T12:00:00Z"));
    const lessons = await mockProvider.fetchWeeks(starts);
    expect(lessons.length).toBeGreaterThan(0);
    const weekdays = new Set(lessons.map((l) => new Date(`${l.date}T12:00:00Z`).getUTCDay()));
    expect([...weekdays].every((d) => d >= 1 && d <= 5)).toBe(true);
    // Fyra veckor ger fyra unika ISO-veckor.
    expect(new Set(lessons.map((l) => `${l.year}-${l.isoWeek}`)).size).toBe(4);
  });

  it("första synk skapar en baslinje – inga ändringar och inga notiser", async () => {
    const { syncSchedule } = await import("@/lib/sync");
    const res = await syncSchedule();
    expect(res.snapshot).toBeTruthy();
    expect(res.stale).toBe(false);
    expect(res.error).toBeUndefined();
    expect(res.changes).toEqual([]);
  });

  it("en efterföljande oförändrad synk skapar inga nya ändringar", async () => {
    const { syncSchedule } = await import("@/lib/sync");
    const res = await syncSchedule();
    expect(res.changes.length).toBe(0);
  });

  it("när snapshot skiljer sig hittar synken ändringar", async () => {
    const { syncSchedule } = await import("@/lib/sync");
    const snap = await store.snapshot();
    expect(snap).toBeTruthy();
    const mutated: ScheduleSnapshot = JSON.parse(JSON.stringify(snap!));
    // Välj en lektion i en garanterat framtida vecka så att ändringen inte
    // filtreras bort av "endast aktiva ändringar" oavsett när testet körs.
    const nowWeek = isoWeek(new Date());
    const victim = mutated.lessons.findIndex((l) => l.isoWeek > nowWeek);
    expect(victim).toBeGreaterThanOrEqual(0);
    mutated.lessons[victim] = { ...mutated.lessons[victim], end: "23:59" };
    await store.setSnapshot(mutated);
    const res = await syncSchedule();
    expect(res.changes.length).toBeGreaterThan(0);
    // Efter lyckad synk ska snapshot vara det färska (ej ändrade) schemat.
    expect(res.snapshot?.lessons[victim].end).not.toBe("23:59");
  });

  it("manuell uppdatering är rate-limitad (cooldown)", async () => {
    resetRefreshLock();
    expect(await store.refreshAllowed(120000)).toBe(true);
    expect(await store.refreshAllowed(120000)).toBe(false);
  });

  it("notis-dedup: samma nyckel skickas bara en gång", async () => {
    expect(await store.claimNotification("sub:change:abc")).toBe(true);
    expect(await store.claimNotification("sub:change:abc")).toBe(false);
  });

  it("push-prenumerationer sparas och tas bort", async () => {
    const sub = {
      endpoint: "https://push.example/end",
      keys: { p256dh: "k", auth: "a" },
      settings: { changes: true, reminders: false },
    };
    await store.saveSubscription(sub);
    expect((await store.subscriptions())["https://push.example/end"]).toBeTruthy();
    await store.removeSubscription("https://push.example/end");
    expect((await store.subscriptions())["https://push.example/end"]).toBeUndefined();
  });

  it("diffning: inställd, ändrad dag, ändrad tid, ny post, baslinje", async () => {
    const { diffSchedules } = await import("@/lib/diff");
    const base = { id: "a", year: 2026, isoWeek: 4, date: "2026-01-19", start: "10:00", end: "12:00", subject: "JavaScript" };
    expect(diffSchedules([], [])).toEqual([]); // baslinje
    expect(diffSchedules([base], [{ ...base, end: "13:00" }])[0].kind).toBe("changed");
    expect(diffSchedules([base], [{ ...base, date: "2026-01-20", start: "09:00" }])[0].kind).toBe("moved");
    expect(diffSchedules([base], [])[0].kind).toBe("cancelled");
    expect(diffSchedules([], [base])[0].kind).toBe("added");
  });
});