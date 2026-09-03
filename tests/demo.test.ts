import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_KINDS, getDemoSchedule, resetDemoCache } from "@/lib/demo";

process.env.SCHEDULE_PROVIDER = "mock";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

beforeEach(() => resetDemoCache());

const expectedKindFor = (demoKind: string): string =>
  demoKind === "changed-time" ? "changed" : demoKind === "moved" ? "moved" : demoKind === "added" ? "added" : "cancelled";

describe("Demoläge (inbyggt i hemsidan)", () => {
  it("visa alla samtidigt ger alla fyra ändringstyper", async () => {
    const demo = await getDemoSchedule("all");
    const kinds = demo.changes.map((c) => c.kind);
    expect(kinds).toContain("cancelled");
    expect(kinds).toContain("changed");
    expect(kinds).toContain("moved");
    expect(kinds).toContain("added");
  });

  it.each(DEMO_KINDS.filter((k) => k !== "all"))("endasten %s ger bara den ändringstypen", async (kind) => {
    const demo = await getDemoSchedule(kind);
    const kinds = demo.changes.map((c) => c.kind);
    expect(kinds).toContain(expectedKindFor(kind));
    // En enskild demo ska vara exakt en ändring.
    expect(demo.changes.length).toBe(1);
  });

  it("inställd lektion finns kvar i schemat som cancelled (visas röd/överstruken)", async () => {
    const demo = await getDemoSchedule("cancelled");
    const cancelled = demo.changes.find((c) => c.kind === "cancelled");
    expect(cancelled).toBeTruthy();
    expect(cancelled?.lesson.cancelled).toBe(true);
    // Lektionens id finns bland snapshot-lessons så att dagkortet kan rendera den.
    expect(demo.snapshot?.lessons.some((l) => l.id === cancelled?.lesson.id && l.cancelled)).toBe(true);
    // Den får aldrig räknas som pågående/nästa.
    expect(cancelled?.lesson.subject).toBe("Projektarbete");
  });

  it("är deterministiskt – samma resultat varje anrop", async () => {
    const a = await getDemoSchedule("all");
    const b = await getDemoSchedule("all");
    expect(a.changes.length).toBe(b.changes.length);
    expect(a.snapshot?.lessons.length).toBe(b.snapshot?.lessons.length);
  });
});