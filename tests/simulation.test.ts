import { beforeEach, describe, expect, it } from "vitest";
import { setSimulation } from "@/lib/simulation";
import { syncSchedule } from "@/lib/sync";

process.env.SCHEDULE_PROVIDER = "mock";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

beforeEach(async () => {
  // Rensa minnesstore och simulering mellan tester (vitest isolerar per fil).
  (globalThis as { __cs26Store?: undefined }).__cs26Store = undefined;
  await setSimulation({ enabled: false });
});

describe("Testmiljö – simulering av schemaändringar", () => {
  it("startar avslagen – baslinje ger inga ändringar", async () => {
    const a = await syncSchedule();
    expect(a.changes).toEqual([]);
    const b = await syncSchedule();
    expect(b.changes).toEqual([]);
  });

  it("slår man på simulering upptäcks inställd, ändrad tid, flyttad dag och ny post", async () => {
    await syncSchedule(); // baslinje
    await setSimulation({ enabled: true });
    const res = await syncSchedule();
    const kinds = res.changes.map((c) => c.kind);
    expect(kinds).toContain("cancelled");
    expect(kinds).toContain("changed");
    expect(kinds).toContain("moved");
    expect(kinds).toContain("added");
    const cancelled = res.changes.find((c) => c.kind === "cancelled");
    expect(cancelled?.lesson.cancelled).toBe(true);
  });

  it("stänger man av simulering återgår schemat och registreras som ändring", async () => {
    await syncSchedule();
    await setSimulation({ enabled: true });
    await syncSchedule();
    await setSimulation({ enabled: false });
    const res = await syncSchedule();
    // När sim stängs av återställs schemat, vilket också är en (motrörlig) ändring.
    expect(res.changes.length).toBeGreaterThan(0);
  });
});